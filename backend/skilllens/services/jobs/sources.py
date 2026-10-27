"""Every place SkillLens finds live jobs. Each source takes one search and returns jobs in one shape.

A search is a dict:  {'role': 'Backend Developer', 'city': 'Pune' or '', 'days': 7, 'remote_only': False}
Only these words leave the server. Resume text and personal details are never sent to any source.

    Job boards              JSearch (Google for Jobs), Jooble, Adzuna, Careerjet, TheirStack   need free keys
    Apify scrapers          Naukri, LinkedIn, Wellfound                                        need an Apify token
    Company career pages    Greenhouse, Lever, Ashby boards of companies hiring in India        no key
    Remote job boards       Remotive, Himalayas, Remote OK                                      no key
"""
import base64
import json
import logging
import os
import re
import threading
import time
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass
from typing import Callable, Tuple

from flask import current_app

from models import india_data
from models.job_market import SAME_ROLE, SENIORITY, _compact_title

from .common import SourceError, canonical_city, days_old, make_job, plain, request_json, salary

logger = logging.getLogger(__name__)

BOARDS_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))),
                           'data', 'company_boards.json')
PER_SOURCE = 30  # most jobs kept from one source for one search


# ----- matching a job title to the role searched for -----

_ROLE_WORDS = re.compile(r'\b(?:developer|engineer|programmer|sde)\b')


def _title_text(text):
    """Lower-case title words, keeping bracketed parts ("Software Engineer (Java)") and joining "back end"."""
    return _compact_title(re.sub(r'[^a-z0-9+#.]+', ' ', str(text or '').lower().replace('sr.', 'senior')).strip())


def role_words(role):
    """(words every title must contain, whether it must also name a developer/engineer-type role)."""
    words = [w for w in _title_text(india_data.normalise_title(role)).split() if w not in SENIORITY]
    core = [w for w in words if w not in SAME_ROLE]
    return core, len(core) < len(words)


def title_matches(role, title):
    core, needs_role_word = role_words(role)
    low = ' ' + _title_text(title) + ' '
    if not core and not needs_role_word:
        return False
    if needs_role_word and not _ROLE_WORDS.search(low):
        return False
    return all(re.search(rf'(?<![a-z0-9]){re.escape(w)}(?![a-z0-9])', low) for w in core)


def _fits_place(job, search):
    """Keep jobs in the chosen city (or anywhere in India), plus remote jobs open to India."""
    if job is None:
        return False
    if search.get('remote_only'):
        return job['remote'] and job['open_to_india'] is not False
    if job['remote'] and job['open_to_india'] is not False:
        return True
    if not job['in_india']:
        return False
    city = search.get('city')
    return not city or not job['city'] or job['city'] == canonical_city(city)


def _recent(job, days):
    age = days_old(job['posted'])
    return age is None or age <= days


def _keep(jobs, search, days=None, match_title=False):
    days = days or search['days']
    out = [j for j in jobs if j and _fits_place(j, search) and _recent(j, days)
           and (not match_title or title_matches(search['role'], j['title']))]
    return out[:PER_SOURCE]


# ----- Job boards with keys -----

def _jsearch(search, cfg):
    via_rapidapi = (cfg.get('JSEARCH_VIA') or '').lower() == 'rapidapi'
    url = 'https://jsearch.p.rapidapi.com/search' if via_rapidapi else 'https://api.openwebninja.com/jsearch/search'
    headers = ({'x-rapidapi-key': cfg['JSEARCH_API_KEY'], 'x-rapidapi-host': 'jsearch.p.rapidapi.com'}
               if via_rapidapi else {'x-api-key': cfg['JSEARCH_API_KEY']})
    days = search['days']
    data = request_json(url, params={
        'query': f"{search['role']} jobs in {search['city'] or 'India'}",
        'page': 1, 'num_pages': 1, 'country': 'in', 'language': 'en',
        'date_posted': 'today' if days <= 1 else '3days' if days <= 3 else 'week' if days <= 7 else 'month',
        'work_from_home': 'true' if search.get('remote_only') else None,
    }, headers=headers, timeout=30)
    jobs = []
    for item in data.get('data') or []:
        link = item.get('job_apply_link') or next((o.get('apply_link') for o in item.get('apply_options') or [] if o.get('apply_link')), None)
        months = (item.get('job_required_experience') or {}).get('required_experience_in_months')
        place = ', '.join(p for p in (item.get('job_city'), item.get('job_state')) if p) or item.get('job_location') or ''
        jobs.append(make_job(
            'jsearch', item.get('job_id'), item.get('job_title'), item.get('employer_name'), link,
            location=place, country=item.get('job_country') or '', remote=item.get('job_is_remote'),
            description=item.get('job_description'),
            posted=item.get('job_posted_at_datetime_utc') or item.get('job_posted_at_timestamp'),
            salary_info=salary(item.get('job_min_salary'), item.get('job_max_salary'), item.get('job_salary_currency'),
                               item.get('job_salary_period')),
            experience={'min': round(months / 12), 'max': None} if months else None,
            employment_type=item.get('job_employment_type'), via=item.get('job_publisher') or 'Google for Jobs'))
    return _keep(jobs, search)


def _jooble(search, cfg):
    host = cfg.get('JOOBLE_HOST') or 'in.jooble.org'
    data = request_json(f"https://{host}/api/{cfg['JOOBLE_API_KEY']}", method='POST', body={
        'keywords': search['role'] + (' remote' if search.get('remote_only') else ''),
        'location': search['city'] or 'India', 'page': '1', 'ResultOnPage': '25',
    }, timeout=25)
    jobs = [make_job('jooble', item.get('id'), item.get('title'), item.get('company'), item.get('link'),
                     location=item.get('location'), country='India', description=item.get('snippet'),
                     posted=item.get('updated'), salary_info=salary(text=item.get('salary')),
                     employment_type=item.get('type'), via=item.get('source') or 'Jooble')
            for item in data.get('jobs') or []]
    return _keep(jobs, search)


def _adzuna(search, cfg):
    params = {'app_id': cfg['ADZUNA_APP_ID'], 'app_key': cfg['ADZUNA_APP_KEY'], 'what': search['role'],
              'results_per_page': 25, 'max_days_old': search['days'], 'sort_by': 'relevance', 'content-type': 'application/json'}
    if search['city']:
        params['where'] = search['city']
    data = request_json('https://api.adzuna.com/v1/api/jobs/in/search/1', params=params, timeout=20)
    jobs = []
    for item in data.get('results') or []:
        predicted = str(item.get('salary_is_predicted')) == '1'
        jobs.append(make_job(
            'adzuna', item.get('id'), plain(item.get('title')), (item.get('company') or {}).get('display_name'),
            item.get('redirect_url'), location=(item.get('location') or {}).get('display_name'), country='India',
            description=item.get('description'), posted=item.get('created'),
            salary_info=None if predicted else salary(item.get('salary_min'), item.get('salary_max'), 'INR', 'year'),
            employment_type=item.get('contract_time'), via='Adzuna'))
    return _keep(jobs, search)


def _careerjet(search, cfg):
    params = {'locale_code': 'en_IN', 'keywords': search['role'], 'page_size': 25, 'sort': 'date',
              'user_ip': '127.0.0.1', 'user_agent': 'SkillLens'}
    if search['city']:
        params['location'] = search['city']
    auth = base64.b64encode(f"{cfg['CAREERJET_API_KEY']}:".encode()).decode()
    data = request_json('https://search.api.careerjet.net/v4/query', params=params,
                        headers={'Authorization': f'Basic {auth}'}, timeout=20)
    jobs = []
    for item in data.get('jobs') or [] if data.get('type') == 'JOBS' else []:
        factor = {'Y': 1, 'M': 12}.get(item.get('salary_type'), 0)
        pay = None
        if item.get('salary_min') and item.get('salary_currency_code') == 'INR' and factor:
            pay = salary(item['salary_min'] * factor, (item.get('salary_max') or item['salary_min']) * factor, 'INR', 'year')
        jobs.append(make_job('careerjet', abs(hash(item.get('url'))), item.get('title'), item.get('company'), item.get('url'),
                             location=item.get('locations'), country='India', description=item.get('description'),
                             posted=item.get('date'), salary_info=pay, via='Careerjet'))
    return _keep(jobs, search)


def _theirstack(search, cfg):
    body = {
        'job_title_or': [search['role']], 'job_country_code_or': ['IN'], 'posted_at_max_age_days': search['days'],
        'limit': int(cfg.get('THEIRSTACK_RESULTS') or 10), 'page': 0,
        'order_by': [{'desc': True, 'field': 'date_posted'}], 'include_total_results': False,
    }
    if search.get('remote_only'):
        body['remote'] = True
    data = request_json('https://api.theirstack.com/v1/jobs/search', method='POST', body=body,
                        headers={'Authorization': f"Bearer {cfg['THEIRSTACK_API_KEY']}"}, timeout=30)
    jobs = []
    for item in data.get('data') or []:
        jobs.append(make_job(
            'theirstack', item.get('id'), item.get('job_title'), item.get('company'),
            item.get('final_url') or item.get('url') or item.get('source_url'),
            location=item.get('long_location') or item.get('location') or item.get('short_location'),
            country=item.get('country_code') or item.get('country') or '', remote=item.get('remote'),
            description=item.get('description'), posted=item.get('date_posted'),
            salary_info=salary(item.get('min_annual_salary'), item.get('max_annual_salary'), item.get('salary_currency'),
                               'year', item.get('salary_string')),
            employment_type=', '.join(item.get('employment_statuses') or []), tags=item.get('technology_slugs') or [],
            work_mode='Hybrid' if item.get('hybrid') else '', via='TheirStack'))
    return _keep(jobs, search)


# ----- Apify scrapers -----

def _apify_run(cfg, actor, actor_input):
    """Run an Apify actor and wait for its results (a scraper run takes 20 to 120 seconds)."""
    per_run = int(cfg.get('APIFY_RESULTS_PER_RUN') or 25)
    data = request_json(
        f"https://api.apify.com/v2/acts/{actor.replace('/', '~')}/run-sync-get-dataset-items",
        method='POST', body=actor_input,
        params={'timeout': 150, 'maxItems': per_run, 'maxTotalChargeUsd': cfg.get('APIFY_MAX_USD_PER_RUN') or 0.15,
                'format': 'json', 'clean': 1},
        headers={'Authorization': f"Bearer {cfg['APIFY_TOKEN']}"}, timeout=200)
    if isinstance(data, dict):
        raise SourceError((data.get('error') or {}).get('message') or 'The Apify scraper did not return a list of jobs.')
    return data[:per_run]


def _pick(item, *names):
    for name in names:
        value = item.get(name)
        if value not in (None, '', [], {}):
            return value
    return None


def _apify_generic(source, item, via):
    """Best effort for scrapers whose output we have not mapped field by field."""
    company = _pick(item, 'companyName', 'company', 'employer', 'organization', 'company_name')
    if isinstance(company, dict):
        company = company.get('name')
    location = _pick(item, 'location', 'locations', 'jobLocation', 'locationNames', 'city', 'place')
    if isinstance(location, list):
        location = ', '.join(str(l.get('label') or l.get('name') or l) if isinstance(l, dict) else str(l) for l in location)
    description = _pick(item, 'description', 'descriptionText', 'jobDescription', 'descriptionHtml', 'snippet')
    if isinstance(description, dict):
        description = description.get('full') or description.get('text') or description.get('short')
    return make_job(source, _pick(item, 'id', 'jobId', 'job_id', 'url'), _pick(item, 'title', 'jobTitle', 'position', 'designation'),
                    company, _pick(item, 'url', 'jobUrl', 'applyUrl', 'link', 'portalUrl', 'detailUrl', 'jdURL'),
                    location=location or '', description=description,
                    posted=_pick(item, 'postedAt', 'postedDate', 'datePosted', 'publishedAt', 'createdDate', 'createdAt', 'date'),
                    salary_info=salary(text=_pick(item, 'salaryText', 'salary')) if isinstance(_pick(item, 'salaryText', 'salary'), str) else None,
                    via=via)


def _days_choice(days, allowed):
    return next((a for a in allowed if a >= days), allowed[-1])


def _apify_naukri(search, cfg):
    actor = cfg.get('APIFY_NAUKRI_ACTOR') or 'valig/naukri-jobs-scraper'
    actor_input = {'keywords': search['role'], 'location': search['city'] or '', 'sort': 'r',
                   'jobAge': str(_days_choice(search['days'], [1, 3, 7, 15, 30])),
                   'limit': int(cfg.get('APIFY_RESULTS_PER_RUN') or 25)}
    if search.get('remote_only'):
        actor_input['wfhType'] = ['2']
    jobs = []
    for item in _apify_run(cfg, actor, actor_input):
        if not isinstance(item, dict):
            continue
        if not isinstance(item.get('company'), dict) and 'description' not in item:
            jobs.append(_apify_generic('apify_naukri', item, 'Naukri'))
            continue
        pay, exp, desc = item.get('salary') or {}, item.get('experience') or {}, item.get('description') or {}
        tags = item.get('skills') or {}
        tags = (tags.get('preferred') or []) + (tags.get('other') or []) if isinstance(tags, dict) else tags
        places = ', '.join(l.get('label', '') for l in item.get('locations') or [] if isinstance(l, dict))
        wfh = str(item.get('wfhType') or '')
        jobs.append(make_job(
            'apify_naukri', item.get('id'), item.get('title'), (item.get('company') or {}).get('name'), item.get('url'),
            location=places, country='India', remote=wfh == '2',
            description=desc.get('full') or desc.get('short') if isinstance(desc, dict) else desc,
            posted=item.get('createdDate') or item.get('createdDateText'),
            salary_info=salary(pay.get('minimum'), pay.get('maximum'), pay.get('currency') or 'INR', 'year', pay.get('label'))
            if isinstance(pay, dict) else salary(text=pay),
            experience={'min': int(exp['minimum']), 'max': int(exp['maximum'])}
            if isinstance(exp, dict) and str(exp.get('minimum', '')).isdigit() and str(exp.get('maximum', '')).isdigit() else None,
            employment_type=item.get('employmentType'), tags=tags, via='Naukri',
            work_mode='Hybrid' if wfh == '3' else ''))
    return _keep(jobs, search)


def _apify_linkedin(search, cfg):
    actor = cfg.get('APIFY_LINKEDIN_ACTOR') or 'valig/linkedin-jobs-scraper'
    days = search['days']
    actor_input = {'keywords': search['role'], 'location': search['city'] or 'India',
                   'datePosted': 'r86400' if days <= 1 else 'r604800' if days <= 7 else 'r2592000',
                   'limit': int(cfg.get('APIFY_RESULTS_PER_RUN') or 25)}
    if search.get('remote_only'):
        actor_input['urlParam'] = [{'key': 'f_WT', 'value': '2'}]
    jobs = []
    for item in _apify_run(cfg, actor, actor_input):
        if not isinstance(item, dict):
            continue
        if 'companyName' not in item:
            jobs.append(_apify_generic('apify_linkedin', item, 'LinkedIn'))
            continue
        jobs.append(make_job(
            'apify_linkedin', item.get('id'), item.get('title'), item.get('companyName'), item.get('url'),
            location=item.get('location'), description=item.get('description') or item.get('descriptionHtml'),
            posted=item.get('postedDate'), salary_info=salary(text=item.get('salary')),
            employment_type=item.get('contractType'), via='LinkedIn'))
    return _keep(jobs, search)


WELLFOUND_CITY_SLUGS = {'Bengaluru': 'bangalore', 'Gurugram': 'gurgaon', 'Delhi': 'delhi', 'Delhi NCR': 'delhi'}


def _apify_wellfound(search, cfg):
    actor = cfg.get('APIFY_WELLFOUND_ACTOR') or 'blackfalcondata/wellfound-scraper'
    city = canonical_city(search['city']) if search['city'] else ''
    actor_input = {'query': search['role'],
                   'location': [WELLFOUND_CITY_SLUGS.get(city, re.sub(r'[^a-z0-9]+', '-', city.lower()))] if city else ['india'],
                   'remote': bool(search.get('remote_only')), 'maxResults': int(cfg.get('APIFY_RESULTS_PER_RUN') or 25),
                   'maxAgeMinutes': search['days'] * 1440, 'enrichDetail': True, 'descriptionFormat': 'text',
                   'descriptionMaxLength': 3000, 'excludeEmptyFields': True}
    jobs = []
    for item in _apify_run(cfg, actor, actor_input):
        if not isinstance(item, dict):
            continue
        if 'portalUrl' not in item and 'detailUrl' not in item:
            jobs.append(_apify_generic('apify_wellfound', item, 'Wellfound'))
            continue
        places = item.get('locationNames') or []
        lo, hi = item.get('yearsExperienceMin'), item.get('yearsExperienceMax')
        jobs.append(make_job(
            'apify_wellfound', item.get('id'), item.get('title'), item.get('companyName'),
            item.get('detailUrl') or item.get('portalUrl'),
            location=', '.join(places) if isinstance(places, list) else str(places),
            country=item.get('jobAddressCountry') or '', remote=item.get('remote'),
            description=item.get('description'), posted=item.get('postedAt') or item.get('datePosted'),
            salary_info=salary(item.get('salaryMin'), item.get('salaryMax'), item.get('salaryCurrency'),
                               item.get('salaryPeriod'), item.get('compensation')),
            experience={'min': int(lo), 'max': int(hi) if hi is not None else None} if lo is not None else None,
            employment_type=item.get('jobType'), tags=item.get('skills') or [], via='Wellfound'))
    return _keep(jobs, search)


# ----- Company career pages (Greenhouse, Lever, Ashby) -----

BOARD_CACHE_SECONDS = 3 * 3600
_board_cache = {}
_board_lock = threading.Lock()


def company_boards():
    with open(BOARDS_PATH, encoding='utf-8') as handle:
        data = json.load(handle)
    return {ats: data.get(ats) or {} for ats in ('greenhouse', 'lever', 'ashby')}


def _board(ats, token):
    """One company's open jobs, cached for 3 hours. A board that fails returns no jobs."""
    key = (ats, token)
    with _board_lock:
        hit = _board_cache.get(key)
        if hit and time.time() - hit[0] < BOARD_CACHE_SECONDS:
            return hit[1]
    try:
        if ats == 'greenhouse':
            jobs = request_json(f'https://boards-api.greenhouse.io/v1/boards/{token}/jobs', timeout=20).get('jobs') or []
        elif ats == 'lever':
            jobs = request_json(f'https://api.lever.co/v0/postings/{token}', params={'mode': 'json'}, timeout=20)
            jobs = jobs if isinstance(jobs, list) else []
        else:
            jobs = request_json(f'https://api.ashbyhq.com/posting-api/job-board/{token}',
                                params={'includeCompensation': 'true'}, timeout=20).get('jobs') or []
    except SourceError as exc:
        logger.warning('Career board %s/%s failed: %s', ats, token, exc.message)
        jobs = []
    with _board_lock:
        _board_cache[key] = (time.time(), jobs)
    return jobs


def _greenhouse_detail(token, job_id):
    key = ('greenhouse-detail', f'{token}/{job_id}')
    with _board_lock:
        hit = _board_cache.get(key)
        if hit and time.time() - hit[0] < BOARD_CACHE_SECONDS:
            return hit[1]
    try:
        content = request_json(f'https://boards-api.greenhouse.io/v1/boards/{token}/jobs/{job_id}', timeout=20).get('content') or ''
    except SourceError:
        content = ''
    with _board_lock:
        _board_cache[key] = (time.time(), content)
    return content


def _career_pages(ats):
    def fetch(search, cfg):
        boards = company_boards()[ats]
        days = max(search['days'], 30)  # career pages keep roles open for weeks; anything newer than a month counts
        with ThreadPoolExecutor(max_workers=12) as pool:
            listings = list(pool.map(lambda t: (t, _board(ats, t)), boards))
        candidates = []
        for token, raw_jobs in listings:
            name = boards[token]
            for item in raw_jobs:
                title = item.get('title') if ats != 'lever' else item.get('text')
                if not title_matches(search['role'], title or ''):
                    continue
                if ats == 'greenhouse':
                    job = make_job('greenhouse', item.get('id'), title, item.get('company_name') or name, item.get('absolute_url'),
                                   location=(item.get('location') or {}).get('name', ''),
                                   posted=item.get('first_published') or item.get('updated_at'), via=f'{name} careers')
                    if job:
                        job['_board'] = (token, item.get('id'))
                elif ats == 'lever':
                    cats = item.get('categories') or {}
                    text = '\n'.join([item.get('descriptionPlain') or '']
                                     + [f"{l.get('text', '')}\n{plain(l.get('content'))}" for l in item.get('lists') or []]
                                     + [item.get('additionalPlain') or ''])
                    pay = item.get('salaryRange') or {}
                    job = make_job('lever', item.get('id'), title, name, item.get('hostedUrl') or item.get('applyUrl'),
                                   location=' / '.join(cats.get('allLocations') or [cats.get('location') or '']),
                                   country=item.get('country') or '', remote=item.get('workplaceType') == 'remote',
                                   description=text, posted=item.get('createdAt'),
                                   salary_info=salary(pay.get('min'), pay.get('max'), pay.get('currency'), pay.get('interval')) if pay else None,
                                   employment_type=cats.get('commitment'), via=f'{name} careers',
                                   work_mode='Hybrid' if item.get('workplaceType') == 'hybrid' else '')
                else:
                    places = [item.get('location') or ''] + [s.get('location', '') for s in item.get('secondaryLocations') or []]
                    country = ((item.get('address') or {}).get('postalAddress') or {}).get('addressCountry') or ''
                    comp = item.get('compensation') or {}
                    job = make_job('ashby', item.get('id'), title, name, item.get('jobUrl') or item.get('applyUrl'),
                                   location=' / '.join(p for p in places if p), country=country,
                                   remote=item.get('workplaceType') == 'Remote', description=item.get('descriptionPlain'),
                                   posted=item.get('publishedAt'),
                                   salary_info=salary(text=comp.get('scrapeableCompensationSalarySummary')) if comp else None,
                                   employment_type=item.get('employmentType'), via=f'{name} careers',
                                   work_mode='Hybrid' if item.get('workplaceType') == 'Hybrid' else '')
                candidates.append(job)
        kept = _keep(candidates, search, days=days)
        if ats == 'greenhouse':  # the list has no descriptions; fetch them only for the jobs we keep
            with ThreadPoolExecutor(max_workers=8) as pool:
                contents = list(pool.map(lambda j: _greenhouse_detail(*j['_board']), kept))
            kept = [_with_description(job, content) for job, content in zip(kept, contents)]
        for job in kept:
            job.pop('_board', None)
        return kept
    return fetch


def _with_description(job, content):
    if not content:
        return job
    rebuilt = make_job(job['source'], job['id'].split(':', 1)[1], job['title'], job['company'], job['url'],
                       location=job['location'], description=content, posted=job['posted'], via=job['via'])
    return rebuilt or job


# ----- Remote job boards -----

def _remotive(search, cfg):
    data = request_json('https://remotive.com/api/remote-jobs', params={'search': search['role'], 'limit': 60}, timeout=25)
    jobs = []
    for item in data.get('jobs') or []:
        where = item.get('candidate_required_location') or 'Worldwide'
        jobs.append(make_job('remotive', item.get('id'), item.get('title'), item.get('company_name'), item.get('url'),
                             location=f'Remote ({where})', remote=True, description=item.get('description'),
                             posted=item.get('publication_date'), salary_info=salary(text=item.get('salary')),
                             employment_type=item.get('job_type'), tags=item.get('tags') or [], via='Remotive'))
    # Remotive's free feed is small and its search is loose, so titles are checked here
    return _keep(jobs, {**search, 'remote_only': True}, match_title=True)


def _himalayas(search, cfg):
    headers = {'Authorization': f"Bearer {cfg['HIMALAYAS_API_KEY']}"} if cfg.get('HIMALAYAS_API_KEY') else None
    data = request_json('https://himalayas.app/jobs/api/search', params={'q': search['role'], 'country': 'India', 'sort': 'recent', 'page': 1},
                        headers=headers, timeout=25)
    jobs = []
    for item in data.get('jobs') or []:
        where = item.get('locationRestrictions') or []
        period = {'annual': 'year', 'monthly': 'month', 'hourly': 'hour'}.get(item.get('salaryPeriod'), item.get('salaryPeriod'))
        jobs.append(make_job('himalayas', item.get('guid'), item.get('title'), item.get('companyName'), item.get('applicationLink'),
                             location=f"Remote ({', '.join(where) if where else 'worldwide'})", remote=True,
                             description=item.get('description') or item.get('excerpt'), posted=item.get('pubDate'),
                             salary_info=salary(item.get('minSalary'), item.get('maxSalary'), item.get('currency'), period),
                             employment_type=item.get('employmentType'), tags=item.get('categories') or [], via='Himalayas'))
    return _keep(jobs, {**search, 'remote_only': True}, match_title=True)


_remoteok_cache = {}


def _remoteok(search, cfg):
    """Remote OK serves its whole feed in one call, so it is fetched at most once an hour and searched here."""
    hit = _remoteok_cache.get('feed')
    if not hit or time.time() - hit[0] > 3600:
        feed = request_json('https://remoteok.com/api', timeout=25)
        hit = (time.time(), [i for i in feed if isinstance(i, dict) and i.get('position')])
        _remoteok_cache['feed'] = hit
    jobs = []
    for item in hit[1]:
        if not title_matches(search['role'], item.get('position') or ''):
            continue
        jobs.append(make_job('remoteok', item.get('id'), item.get('position'), item.get('company'), item.get('url') or item.get('apply_url'),
                             location=f"Remote ({item.get('location') or 'location not stated'})", remote=True,
                             description=item.get('description'), posted=item.get('epoch') or item.get('date'),
                             salary_info=salary(item.get('salary_min'), item.get('salary_max'), 'USD', 'year'),
                             tags=item.get('tags') or [], via='Remote OK'))
    return _keep(jobs, {**search, 'remote_only': True})


# ----- registry -----

@dataclass(frozen=True)
class Source:
    name: str
    label: str
    group: str
    covers: str
    fetch: Callable
    needs: Tuple[str, ...] = ()
    daily_limit: int = 50
    cache_hours: int = 6
    attribution: Tuple[str, str] = ('', '')  # (name, URL) shown next to every job from this source
    cost: str = 'Free'


SOURCES = {s.name: s for s in [
    Source('jsearch', 'Google for Jobs', 'Job boards', 'LinkedIn, Indeed, Glassdoor and other sites Google for Jobs indexes, through JSearch',
           _jsearch, needs=('JSEARCH_API_KEY',), daily_limit=6, cache_hours=12, cost='Free: 200 searches a month',
           attribution=('JSearch', 'https://www.openwebninja.com/api/jsearch')),
    Source('jooble', 'Jooble', 'Job boards', 'Jobs Jooble collects from Indian job sites', _jooble,
           needs=('JOOBLE_API_KEY',), daily_limit=3, cache_hours=12, cost='Free: 500 searches in total',
           attribution=('Jooble', 'https://in.jooble.org')),
    Source('adzuna', 'Adzuna', 'Job boards', 'Indian job listings on Adzuna', _adzuna,
           needs=('ADZUNA_APP_ID', 'ADZUNA_APP_KEY'), daily_limit=20, cost='Free key, small quota',
           attribution=('Adzuna', 'https://www.adzuna.in')),
    Source('careerjet', 'Careerjet', 'Job boards', 'Indian job listings on Careerjet', _careerjet,
           needs=('CAREERJET_API_KEY',), daily_limit=20, cost='Free, needs your website address',
           attribution=('Careerjet', 'https://www.careerjet.co.in')),
    Source('theirstack', 'TheirStack', 'Job boards', 'Tech jobs TheirStack finds across job boards and career sites', _theirstack,
           needs=('THEIRSTACK_API_KEY',), daily_limit=1, cache_hours=24, cost='Free: 200 credits, 1 per job',
           attribution=('TheirStack', 'https://theirstack.com')),
    Source('apify_naukri', 'Naukri', 'Apify scrapers', 'Live Naukri.com listings, scraped by Apify', _apify_naukri,
           needs=('APIFY_TOKEN',), daily_limit=3, cache_hours=12, cost='Apify credit: about $0.01 a search',
           attribution=('Naukri via Apify', 'https://www.naukri.com')),
    Source('apify_linkedin', 'LinkedIn', 'Apify scrapers', 'Live LinkedIn job listings, scraped by Apify', _apify_linkedin,
           needs=('APIFY_TOKEN',), daily_limit=3, cache_hours=12, cost='Apify credit: about $0.01 a search',
           attribution=('LinkedIn via Apify', 'https://www.linkedin.com/jobs')),
    Source('apify_wellfound', 'Wellfound', 'Apify scrapers', 'Startup jobs on Wellfound, scraped by Apify', _apify_wellfound,
           needs=('APIFY_TOKEN',), daily_limit=1, cache_hours=12, cost='Apify credit: about $0.08 a search',
           attribution=('Wellfound via Apify', 'https://wellfound.com')),
    Source('greenhouse', 'Greenhouse', 'Company career pages', 'Career pages of companies on Greenhouse', _career_pages('greenhouse'),
           daily_limit=500, cache_hours=3, attribution=('Greenhouse', 'https://www.greenhouse.com')),
    Source('lever', 'Lever', 'Company career pages', 'Career pages of companies on Lever', _career_pages('lever'),
           daily_limit=500, cache_hours=3, attribution=('Lever', 'https://www.lever.co')),
    Source('ashby', 'Ashby', 'Company career pages', 'Career pages of companies on Ashby', _career_pages('ashby'),
           daily_limit=500, cache_hours=3, attribution=('Ashby', 'https://www.ashbyhq.com')),
    Source('remotive', 'Remotive', 'Remote job boards', 'Remote jobs open to India on Remotive', _remotive,
           daily_limit=4, cache_hours=12, attribution=('Remotive', 'https://remotive.com')),
    Source('himalayas', 'Himalayas', 'Remote job boards', 'Remote jobs open to India on Himalayas', _himalayas,
           daily_limit=200, cache_hours=6, attribution=('Himalayas', 'https://himalayas.app')),
    Source('remoteok', 'Remote OK', 'Remote job boards', 'Remote jobs on Remote OK', _remoteok,
           daily_limit=48, cache_hours=1, attribution=('Remote OK', 'https://remoteok.com')),
]}

def _cfg():
    return current_app.config


def configured(source):
    cfg = _cfg()
    if source.name in (cfg.get('JOB_SOURCES_DISABLED') or []):
        return False
    return all(cfg.get(key) for key in source.needs)


def daily_limit(source):
    value = _cfg().get(f'JOB_LIMIT_{source.name.upper()}')
    try:
        return int(value) if value not in (None, '') else source.daily_limit
    except (TypeError, ValueError):
        return source.daily_limit


def fetch(name, search):
    """Jobs from one source. Raises SourceError with a message safe to show."""
    source = SOURCES[name]
    try:
        return [j for j in source.fetch(search, _cfg()) if j]
    except SourceError:
        raise
    except Exception as exc:  # a source changing its format must not break the search
        logger.exception('Job source %s failed', name)
        raise SourceError(f'{source.label} sent back data we could not read ({type(exc).__name__}).')


def boards_count():
    boards = company_boards()
    return {ats: len(items) for ats, items in boards.items()}
