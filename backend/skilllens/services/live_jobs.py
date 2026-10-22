"""Optional live job listings for India from free job-search APIs.

Nothing here runs unless a key is configured in backend/.env:

* Adzuna  (ADZUNA_APP_ID + ADZUNA_APP_KEY): free key for personal and academic use.
  Terms: https://developer.adzuna.com/docs/terms_of_service
* Careerjet (CAREERJET_API_KEY): free publisher key. https://www.careerjet.com/partners/api/

Only search keywords (a few skills or a job title) and a city are sent, never resume text or
personal data. Results are cached for 30 minutes to stay well inside free quotas. Any failure
(timeout, bad key, quota reached) returns an empty list so the dataset matches still show.
"""
import base64
import json
import logging
import re
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

from flask import current_app

logger = logging.getLogger(__name__)

TIMEOUT_SECONDS = 6
CACHE_SECONDS = 30 * 60
CACHE_MAX = 200
_cache = {}
_cache_lock = threading.Lock()


def configured_providers():
    cfg = current_app.config
    providers = []
    if cfg.get('ADZUNA_APP_ID') and cfg.get('ADZUNA_APP_KEY'):
        providers.append('adzuna')
    if cfg.get('CAREERJET_API_KEY'):
        providers.append('careerjet')
    return providers


def _get_json(url, headers=None):
    request = urllib.request.Request(url, headers={'Accept': 'application/json', **(headers or {})})
    with urllib.request.urlopen(request, timeout=TIMEOUT_SECONDS) as response:  # noqa: S310 (fixed https hosts)
        return json.loads(response.read().decode('utf-8'))


def _plain(text):
    return re.sub(r'\s+', ' ', re.sub(r'<[^>]+>', ' ', str(text or ''))).strip()


def _adzuna(keywords, city, limit):
    cfg = current_app.config
    params = {
        'app_id': cfg['ADZUNA_APP_ID'], 'app_key': cfg['ADZUNA_APP_KEY'],
        'what_or': keywords, 'results_per_page': limit, 'max_days_old': 30,
        'sort_by': 'relevance', 'content-type': 'application/json',
    }
    if city and city != 'Remote':
        params['where'] = city
    data = _get_json('https://api.adzuna.com/v1/api/jobs/in/search/1?' + urllib.parse.urlencode(params))
    jobs = []
    for item in data.get('results', []):
        salary = None
        if item.get('salary_min') and not item.get('salary_is_predicted') == '1':
            salary = {'min': int(item['salary_min']), 'max': int(item.get('salary_max') or item['salary_min']),
                      'currency': 'INR', 'period': 'year'}
        jobs.append({
            'id': f"adzuna-{item.get('id')}",
            'position': _plain(item.get('title')),
            'company': (item.get('company') or {}).get('display_name', ''),
            'location': (item.get('location') or {}).get('display_name', ''),
            'description': _plain(item.get('description'))[:400],
            'posted': (item.get('created') or '')[:10],
            'salary': salary,
            'job_url': item.get('redirect_url'),
            'source': 'Adzuna',
            'source_url': 'https://www.adzuna.in/',
        })
    return jobs


def _careerjet(keywords, city, limit, user_ip, user_agent):
    key = current_app.config['CAREERJET_API_KEY']
    params = {'locale_code': 'en_IN', 'keywords': keywords, 'page_size': limit, 'sort': 'relevance',
              'user_ip': user_ip or '127.0.0.1', 'user_agent': user_agent or 'SkillLens'}
    if city and city != 'Remote':
        params['location'] = city
    auth = base64.b64encode(f'{key}:'.encode()).decode()
    data = _get_json('https://search.api.careerjet.net/v4/query?' + urllib.parse.urlencode(params),
                     headers={'Authorization': f'Basic {auth}'})
    jobs = []
    for item in data.get('jobs', []) if data.get('type') == 'JOBS' else []:
        salary = None
        if item.get('salary_min') and item.get('salary_currency_code') == 'INR':
            factor = {'Y': 1, 'M': 12}.get(item.get('salary_type'), 0)
            if factor:
                salary = {'min': int(item['salary_min'] * factor), 'max': int((item.get('salary_max') or item['salary_min']) * factor),
                          'currency': 'INR', 'period': 'year'}
        jobs.append({
            'id': f"careerjet-{abs(hash(item.get('url')))}",
            'position': _plain(item.get('title')),
            'company': item.get('company') or '',
            'location': item.get('locations') or '',
            'description': _plain(item.get('description'))[:400],
            'posted': item.get('date') or '',
            'salary': salary,
            'job_url': item.get('url'),
            'source': 'Careerjet',
            'source_url': 'https://www.careerjet.co.in/',
        })
    return jobs


def search(keywords, city=None, limit=10, user_ip=None, user_agent=None):
    """Live listings from every configured provider. Empty list when none is configured or all fail."""
    providers = configured_providers()
    keywords = ' '.join(k for k in keywords if k)[:120]
    if not providers or not keywords:
        return []

    cache_key = (tuple(providers), keywords.lower(), (city or '').lower(), limit)
    now = time.time()
    with _cache_lock:
        hit = _cache.get(cache_key)
        if hit and now - hit[0] < CACHE_SECONDS:
            return hit[1]

    jobs = []
    for provider in providers:
        try:
            if provider == 'adzuna':
                jobs += _adzuna(keywords, city, limit)
            else:
                jobs += _careerjet(keywords, city, limit, user_ip, user_agent)
        except (urllib.error.URLError, TimeoutError, ValueError, KeyError) as exc:
            logger.warning('Live jobs from %s failed: %s', provider, exc)

    with _cache_lock:
        if len(_cache) >= CACHE_MAX:
            _cache.pop(next(iter(_cache)))
        _cache[cache_key] = (now, jobs)
    return jobs


def annotate(jobs, user_skills):
    """Mark which of the user's skills each live listing mentions, and sort by that."""
    patterns = [(s, re.compile(r'(?<![a-z0-9])' + re.escape(s.lower()) + r'(?![a-z0-9])')) for s in user_skills if len(s) > 1]
    for job in jobs:
        text = f"{job['position']} {job['description']}".lower()
        job['matched_skills'] = [s for s, p in patterns if p.search(text)]
    return sorted(jobs, key=lambda j: len(j['matched_skills']), reverse=True)
