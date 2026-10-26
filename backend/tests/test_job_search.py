"""Live job search. Every source is faked with a sample in the format its documentation describes."""
import json
from datetime import date, timedelta

import pytest

from models.database import JobSourceResult, User
from skilllens.extensions import db
from skilllens.services.jobs import common, ranking, sources

from .conftest import add_resume, create_user, login

TODAY = date.today().isoformat()
RECENT = (date.today() - timedelta(days=3)).isoformat()
OLD = (date.today() - timedelta(days=90)).isoformat()
SEARCH = {'role': 'Backend Developer', 'city': 'Pune', 'days': 14, 'remote_only': False}
RESUME_TEXT = 'Backend Developer\nExperience\nBuilt REST APIs in Java with Spring Boot and PostgreSQL on AWS.\nSECRET-RESUME-WORD'

JSEARCH = {'status': 'OK', 'data': [
    {'job_id': 'js1', 'job_title': 'Backend Developer', 'employer_name': 'Acme Fintech', 'job_publisher': 'LinkedIn',
     'job_apply_link': 'https://www.linkedin.com/jobs/view/1', 'job_city': 'Pune', 'job_state': 'Maharashtra', 'job_country': 'IN',
     'job_is_remote': False, 'job_posted_at_datetime_utc': f'{RECENT}T08:00:00.000Z', 'job_employment_type': 'FULLTIME',
     'job_description': 'We need a backend developer with Java, Spring Boot, Kafka and PostgreSQL. 2-4 years of experience.',
     'job_min_salary': None, 'job_max_salary': None},
    {'job_id': 'js2', 'job_title': 'Backend Developer', 'employer_name': 'Far Away Inc', 'job_apply_link': 'https://example.com/2',
     'job_city': 'Austin', 'job_state': 'Texas', 'job_country': 'US', 'job_is_remote': False,
     'job_posted_at_datetime_utc': f'{RECENT}T08:00:00.000Z', 'job_description': 'Python'},
]}
JOOBLE = {'totalCount': 1, 'jobs': [
    {'id': 11, 'title': 'Backend Developer', 'company': 'Acme Fintech', 'location': 'Pune, Maharashtra', 'link': 'https://in.jooble.org/jdp/11',
     'snippet': 'Java and Spring Boot', 'salary': '₹8 - 12 LPA', 'source': 'Naukri', 'type': 'Full-time', 'updated': f'{RECENT}T12:55:35.387'},
]}
THEIRSTACK = {'data': [
    {'id': 77, 'job_title': 'Backend Engineer', 'company': 'Kite Labs', 'url': 'https://kite.example/jobs/77',
     'long_location': 'Pune, Maharashtra, India', 'country_code': 'IN', 'remote': False, 'hybrid': True, 'date_posted': TODAY,
     'description': '## Role\nGo and Kubernetes', 'min_annual_salary': 1500000, 'max_annual_salary': 2500000, 'salary_currency': 'INR',
     'technology_slugs': ['go', 'kubernetes'], 'employment_statuses': ['full_time']},
]}
# Sample output from the valig/naukri-jobs-scraper README, trimmed
NAUKRI = [{
    'id': '120526025748', 'title': 'Backend Developer', 'url': 'https://www.naukri.com/job-listings-backend-developer-120526025748',
    'company': {'id': 1318400, 'name': 'TECS Pvt Ltd'},
    'salary': {'currency': 'INR', 'minimum': 125000, 'maximum': 500000, 'label': '1.25-5 Lacs'},
    'experience': {'text': '0-3 Yrs', 'minimum': '0', 'maximum': '3'},
    'description': {'full': '<p>Programming using <strong>.NET</strong>, C# and jQuery.</p>', 'short': '.NET'},
    'createdDate': int((__import__('time').time() - 2 * 86400) * 1000), 'employmentType': 'Full Time, Permanent', 'wfhType': '0',
    'skills': {'preferred': ['C#', '.Net', 'SQL'], 'other': ['jQuery']},
    'locations': [{'label': 'Pune'}],
}]
LINKEDIN = [{'id': '4219847745', 'url': 'https://www.linkedin.com/jobs/view/4219847745', 'title': 'Backend Developer',
             'location': 'Pune, Maharashtra, India', 'companyName': 'Goliath Partners', 'contractType': 'Full-time',
             'salary': '₹10,00,000/yr - ₹14,00,000/yr', 'postedDate': RECENT, 'description': 'Experience with Java and Kafka.'}]
WELLFOUND = [{'id': 'wf1', 'title': 'Backend Engineer', 'companyName': 'Seed Startup', 'detailUrl': 'https://wellfound.com/jobs/wf1',
              'locationNames': ['Pune'], 'remote': False, 'salaryMin': 1200000, 'salaryMax': 2000000, 'salaryCurrency': 'INR',
              'yearsExperienceMin': 2, 'description': 'Node.js and TypeScript', 'skills': ['Node.js'], 'postedAt': RECENT}]
GREENHOUSE_LIST = {'jobs': [
    {'id': 1, 'title': 'Senior Backend Engineer', 'company_name': 'Okta', 'absolute_url': 'https://boards.greenhouse.io/okta/jobs/1',
     'location': {'name': 'Bengaluru, India'}, 'first_published': f'{RECENT}T03:49:28-04:00'},
    {'id': 2, 'title': 'Account Executive', 'absolute_url': 'https://boards.greenhouse.io/okta/jobs/2', 'location': {'name': 'Pune'}},
    {'id': 3, 'title': 'Backend Engineer', 'absolute_url': 'https://boards.greenhouse.io/okta/jobs/3', 'location': {'name': 'Remote, Poland'}},
]}
GREENHOUSE_DETAIL = {'content': '&lt;p&gt;Build services in &lt;strong&gt;Go&lt;/strong&gt; and Kafka.&lt;/p&gt;'}
LEVER = [{'id': 'lv1', 'text': 'Backend Engineer', 'categories': {'location': 'Bangalore', 'allLocations': ['Bangalore'], 'commitment': 'Full time'},
          'country': 'IN', 'workplaceType': 'hybrid', 'hostedUrl': 'https://jobs.lever.co/cred/lv1', 'createdAt': 1790573982021,
          'descriptionPlain': 'Java services', 'lists': [{'text': 'What you need', 'content': '<li>3+ years of experience</li>'}]}]
ASHBY = {'jobs': [{'id': 'ab1', 'title': 'Software Engineer, Backend', 'location': 'Bengaluru', 'workplaceType': 'OnSite',
                   'descriptionPlain': 'Python and FastAPI', 'publishedAt': f'{RECENT}T11:46:39.214+00:00',
                   'jobUrl': 'https://jobs.ashbyhq.com/sarvam/ab1', 'address': {'postalAddress': {'addressCountry': 'India'}}}]}
REMOTIVE = {'jobs': [
    {'id': 5, 'url': 'https://remotive.com/remote-jobs/software-dev/backend-5', 'title': 'Backend Developer', 'company_name': 'Remote Co',
     'candidate_required_location': 'Worldwide', 'publication_date': f'{RECENT}T10:23:26', 'description': '<p>Django</p>', 'salary': '$40k'},
    {'id': 6, 'url': 'https://remotive.com/remote-jobs/software-dev/backend-6', 'title': 'Backend Developer', 'company_name': 'US Only',
     'candidate_required_location': 'USA', 'publication_date': f'{RECENT}T10:23:26', 'description': 'Go'},
    {'id': 7, 'url': 'https://remotive.com/remote-jobs/x', 'title': 'Video Annotator', 'company_name': 'Loose Match',
     'candidate_required_location': 'Worldwide', 'publication_date': f'{RECENT}T10:23:26', 'description': 'backend'},
]}
HIMALAYAS = {'jobs': [{'title': 'Backend Developer - Go', 'companyName': 'Fuerza', 'locationRestrictions': ['India'], 'minSalary': 30000,
                       'maxSalary': 50000, 'currency': 'USD', 'salaryPeriod': 'annual', 'description': '<p>Go and gRPC</p>',
                       'pubDate': 1792000000, 'applicationLink': 'https://himalayas.app/companies/fuerza/jobs/backend',
                       'guid': 'https://himalayas.app/companies/fuerza/jobs/backend', 'employmentType': 'Full Time'}]}
REMOTEOK = [{'legal': 'API Terms of Service'},
            {'id': '9', 'epoch': 1792857604, 'company': 'DuckDuckGo', 'position': 'Senior Backend Engineer', 'tags': ['golang'],
             'description': '<p>Go</p>', 'location': '', 'url': 'https://remoteOK.com/remote-jobs/9', 'salary_min': 0, 'salary_max': 0},
            {'id': '10', 'epoch': 1792857604, 'company': 'Getlabs', 'position': 'Field Phlebotomy Supervisor', 'location': 'Remote',
             'url': 'https://remoteOK.com/remote-jobs/10'}]
ADZUNA = {'results': [{'id': 'az1', 'title': '<strong>Backend</strong> Developer', 'company': {'display_name': 'Adz Co'},
                       'location': {'display_name': 'Pune, Maharashtra'}, 'redirect_url': 'https://www.adzuna.in/details/az1',
                       'created': f'{RECENT}T10:00:00Z', 'description': 'Java', 'salary_min': 900000, 'salary_max': 1200000,
                       'salary_is_predicted': '0'}]}


def _router(calls, overrides=None):
    routes = [
        ('openwebninja.com/jsearch', JSEARCH), ('jooble.org/api', JOOBLE), ('theirstack.com', THEIRSTACK),
        ('naukri-jobs-scraper', NAUKRI), ('linkedin-jobs-scraper', LINKEDIN), ('wellfound-scraper', WELLFOUND),
        ('greenhouse.io/v1/boards/okta/jobs/', GREENHOUSE_DETAIL), ('greenhouse.io/v1/boards/', GREENHOUSE_LIST),
        ('api.lever.co', LEVER), ('ashbyhq.com', ASHBY), ('remotive.com', REMOTIVE), ('himalayas.app', HIMALAYAS),
        ('remoteok.com', REMOTEOK), ('adzuna.com', ADZUNA),
    ]
    routes = (overrides or []) + routes

    def fake(url, method='GET', params=None, body=None, headers=None, timeout=20):
        calls.append({'url': url, 'params': params or {}, 'body': body, 'headers': headers or {}})
        for part, answer in routes:
            if part in url:
                if isinstance(answer, Exception):
                    raise answer
                return json.loads(json.dumps(answer))
        raise AssertionError(f'unexpected request to {url}')
    return fake


@pytest.fixture
def fake_sources(app, monkeypatch):
    """Every source set up with a key, one company board per ATS, and no real network."""
    app.config.update(JSEARCH_API_KEY='js', JOOBLE_API_KEY='jb', THEIRSTACK_API_KEY='ts', APIFY_TOKEN='ap',
                      ADZUNA_APP_ID='id', ADZUNA_APP_KEY='key', JOB_SOURCES_DISABLED=[])
    monkeypatch.setattr(sources, 'company_boards', lambda: {'greenhouse': {'okta': 'Okta'}, 'lever': {'cred': 'CRED'},
                                                            'ashby': {'sarvam': 'Sarvam AI'}})
    sources._board_cache.clear()
    sources._remoteok_cache.clear()
    calls = []
    monkeypatch.setattr(sources, 'request_json', _router(calls))
    yield calls
    sources._board_cache.clear()
    sources._remoteok_cache.clear()


@pytest.fixture
def candidate(client, user_session):
    user = User.query.filter_by(email='user@example.com').first()
    resume = add_resume(user, score=70, skills=['Java', 'Spring Boot', 'PostgreSQL', 'AWS', 'REST APIs'])
    resume.raw_text = RESUME_TEXT
    db.session.commit()
    return user


# ----- each source reads its own format -----

@pytest.mark.parametrize('name,title,company,city,via', [
    ('jsearch', 'Backend Developer', 'Acme Fintech', 'Pune', 'LinkedIn'),
    ('jooble', 'Backend Developer', 'Acme Fintech', 'Pune', 'Naukri'),
    ('theirstack', 'Backend Engineer', 'Kite Labs', 'Pune', 'TheirStack'),
    ('apify_naukri', 'Backend Developer', 'TECS Pvt Ltd', 'Pune', 'Naukri'),
    ('apify_linkedin', 'Backend Developer', 'Goliath Partners', 'Pune', 'LinkedIn'),
    ('apify_wellfound', 'Backend Engineer', 'Seed Startup', 'Pune', 'Wellfound'),
    ('adzuna', 'Backend Developer', 'Adz Co', 'Pune', 'Adzuna'),
])
def test_keyed_sources_read_their_format(app, fake_sources, name, title, company, city, via):
    with app.test_request_context():
        jobs = sources.fetch(name, SEARCH)
    assert jobs, name
    job = jobs[0]
    assert (job['title'], job['company'], job['city'], job['via']) == (title, company, city, via)
    assert job['url'].startswith('https://') and job['in_india'] and job['posted']
    assert job['skill_keys']


def test_source_details_are_kept(app, fake_sources):
    with app.test_request_context():
        naukri = sources.fetch('apify_naukri', SEARCH)[0]
        theirstack = sources.fetch('theirstack', SEARCH)[0]
        jsearch = sources.fetch('jsearch', SEARCH)
    assert naukri['salary']['text'] == '1.25-5 Lacs' and naukri['salary']['currency'] == 'INR'
    assert naukri['experience'] == {'min': 0, 'max': 3}
    assert 'c#' in naukri['skill_keys'] and '<strong>' not in naukri['description']
    assert theirstack['work_mode'] == 'Hybrid' and theirstack['salary']['min'] == 1500000
    # The Austin job is not in India and not remote, so it is left out
    assert [j['company'] for j in jsearch] == ['Acme Fintech'] and jsearch[0]['experience'] == {'min': 2, 'max': 4}


def test_company_career_pages_keep_matching_roles_in_india(app, fake_sources):
    with app.test_request_context():
        gh = sources.fetch('greenhouse', {**SEARCH, 'city': ''})
        lever = sources.fetch('lever', {**SEARCH, 'city': ''})
        ashby = sources.fetch('ashby', {**SEARCH, 'city': ''})
    # Account Executive is not the role; "Remote, Poland" is not open to India
    assert [j['title'] for j in gh] == ['Senior Backend Engineer']
    assert 'Kafka' in gh[0]['description'] and gh[0]['city'] == 'Bengaluru'  # description fetched for kept jobs only
    assert lever[0]['work_mode'] == 'Hybrid' and lever[0]['experience'] == {'min': 3, 'max': None}
    assert ashby[0]['company'] == 'Sarvam AI' and ashby[0]['via'] == 'Sarvam AI careers'


def test_remote_boards_keep_jobs_open_to_india(app, fake_sources):
    with app.test_request_context():
        remotive = sources.fetch('remotive', SEARCH)
        himalayas = sources.fetch('himalayas', SEARCH)
        remoteok = sources.fetch('remoteok', SEARCH)
    assert [j['company'] for j in remotive] == ['Remote Co']  # "USA" only and an unrelated title are dropped
    assert himalayas[0]['location'] == 'Remote (India)' and himalayas[0]['open_to_india'] is True
    assert [j['company'] for j in remoteok] == ['DuckDuckGo'] and remoteok[0]['open_to_india'] is None


def test_only_the_search_words_leave_the_server(client, user_session, candidate, fake_sources):
    client.post('/api/jobs/search', headers=user_session, json={'role': 'Backend Developer', 'city': 'Pune'})
    sent = json.dumps([{k: v for k, v in c.items() if k != 'headers'} for c in fake_sources])
    assert fake_sources and 'SECRET-RESUME-WORD' not in sent and 'user@example.com' not in sent and 'Spring Boot' not in sent


# ----- searching -----

def test_a_search_ranks_jobs_against_the_resume(client, user_session, candidate, fake_sources):
    body = client.post('/api/jobs/search', headers=user_session,
                       json={'role': 'Backend Developer', 'city': 'Pune', 'sources': ['jsearch', 'jooble', 'apify_naukri']}).get_json()
    assert body['done'] and {s['name']: s['status'] for s in body['sources']} == {'jsearch': 'done', 'jooble': 'done', 'apify_naukri': 'done'}
    jobs = body['jobs']
    # The same Acme job came from JSearch and Jooble: shown once, the other source listed
    acme = [j for j in jobs if j['company'] == 'Acme Fintech']
    assert len(acme) == 1 and acme[0]['also_on']
    # Java and Spring Boot match the resume; Kafka is the gap
    assert {'Java', 'Spring Boot'} <= set(acme[0]['matched_skills']) and 'Kafka' in acme[0]['missing_skills']
    assert jobs[0]['match'] >= jobs[-1]['match'] and acme[0]['match'] > 50
    assert 'skill_keys' not in acme[0]


def test_repeat_searches_are_cached_and_daily_limits_hold(app, client, user_session, candidate, fake_sources):
    app.config['JOB_LIMIT_JSEARCH'] = 1
    first = client.post('/api/jobs/search', headers=user_session, json={'role': 'Backend Developer', 'sources': ['jsearch']}).get_json()
    calls = len(fake_sources)
    again = client.post('/api/jobs/search', headers=user_session, json={'role': 'Backend Developer', 'sources': ['jsearch']}).get_json()
    assert len(fake_sources) == calls  # same search: answered from the cache, no new request
    assert again['sources'][0]['status'] == 'done' and again['sources'][0]['cached'] and again['total'] == first['total']

    other = client.post('/api/jobs/search', headers=user_session, json={'role': 'Data Analyst', 'sources': ['jsearch']}).get_json()
    assert other['sources'][0]['status'] == 'limit' and len(fake_sources) == calls  # 1 a day, already used

    setup = client.get('/api/jobs/setup', headers=user_session).get_json()
    assert {s['name']: s['remaining_today'] for s in setup['sources']}['jsearch'] == 0


def test_a_failing_source_does_not_break_the_search(client, user_session, candidate, fake_sources, monkeypatch):
    monkeypatch.setattr(sources, 'request_json', _router(fake_sources, [('jooble.org/api', common.SourceError('The API key was rejected.'))]))
    body = client.post('/api/jobs/search', headers=user_session,
                       json={'role': 'Backend Developer', 'sources': ['jooble', 'jsearch']}).get_json()
    status = {s['name']: s for s in body['sources']}
    assert status['jooble']['status'] == 'error' and 'rejected' in status['jooble']['message']
    assert status['jsearch']['status'] == 'done' and body['total'] >= 1


def test_searches_are_private(client, user_session, candidate, fake_sources, make_client):
    search_id = client.post('/api/jobs/search', headers=user_session, json={'role': 'Backend Developer', 'sources': ['jsearch']}).get_json()['id']
    assert client.get(f'/api/jobs/search/{search_id}', headers=user_session).status_code == 200
    other = make_client()
    create_user('other@example.com')
    headers = login(other, 'other@example.com')
    assert other.get(f'/api/jobs/search/{search_id}', headers=headers).status_code == 404


def test_search_input_is_checked(client, user_session, fake_sources):
    assert client.post('/api/jobs/search', headers=user_session, json={'role': 'x'}).status_code == 400
    assert client.post('/api/jobs/search', headers=user_session, json={'role': 'Backend Developer', 'days': 5}).status_code == 400
    assert client.post('/api/jobs/search', headers=user_session, json={'role': 'Backend Developer', 'sources': ['nowhere']}).status_code == 400


def test_a_running_source_is_shared_not_started_twice(client, user_session, candidate, fake_sources):
    row = JobSourceResult(source='jsearch', query_key=__import__('skilllens.services.jobs.search', fromlist=['x'])._query_key(
        'jsearch', {'role': 'Backend Developer', 'city': '', 'days': 14, 'remote_only': False}), status='running')
    db.session.add(row)
    db.session.commit()
    body = client.post('/api/jobs/search', headers=user_session, json={'role': 'Backend Developer', 'sources': ['jsearch']}).get_json()
    assert body['sources'][0]['status'] == 'running' and not body['done'] and fake_sources == []


# ----- rules -----

@pytest.mark.parametrize('location,remote,expected', [
    ('Bangalore, Karnataka', False, ('Bengaluru', True, False, True)),
    ('Remote, Poland', False, ('', False, True, False)),
    ('Remote', False, ('', False, True, None)),
    ('Remote (Worldwide)', True, ('', False, True, True)),
    ('Austin, Texas', False, ('', False, False, False)),
])
def test_place_rules(location, remote, expected):
    assert common.place(location, remote) == expected


@pytest.mark.parametrize('role,title,expected', [
    ('Backend Developer', 'Senior Backend Engineer', True),
    ('Backend Developer', 'Back-end Developer (Node)', True),
    ('Backend Developer', 'Frontend Engineer', False),
    ('Java Developer', 'Software Engineer (Java)', True),
    ('Data Analyst', 'Senior Data Analyst - Power BI', True),
    ('Data Analyst', 'Data Engineer', False),
])
def test_title_matching(role, title, expected):
    assert sources.title_matches(role, title) is expected


def test_ranking_explains_itself():
    job = common.make_job('x', 1, 'Backend Developer', 'Acme', 'https://a.example', location='Pune',
                          description='Java, Spring Boot, Kafka, Docker. 3-5 years of experience.', posted=RECENT)
    have = ranking.resume_keys(['Java', 'Spring Boot', 'Docker', 'Kafka'])
    strong = ranking.score(job, 'Backend Developer', have, 4)
    weak = ranking.score(job, 'Backend Developer', ranking.resume_keys(['Excel']), 0)
    assert strong['match'] > 85 and strong['parts']['experience'] == 100 and not strong['missing_skills']
    assert weak['match'] < strong['match'] and 'a stretch' in ' '.join(weak['notes'])
    assert ranking.score(job, 'Backend Developer', have, 4)['notes'][0] == 'You have 4 of the 4 skills it names'


def test_a_skill_in_the_title_that_you_lack_lowers_the_fit():
    have = ranking.resume_keys(['Java', 'REST APIs', 'AWS', 'Docker', 'PostgreSQL', 'Kafka', 'Kubernetes', 'Redis'])
    text = 'REST APIs, AWS, Docker, PostgreSQL, Kafka, Kubernetes, Redis.'
    go = ranking.score(common.make_job('x', 1, 'Backend Developer - Go', 'A', 'https://a.example', 'Remote', text), 'Backend Developer', have, 3)
    java = ranking.score(common.make_job('x', 2, 'Backend Developer - Java', 'B', 'https://b.example', 'Remote', text), 'Backend Developer', have, 3)
    assert java['match'] > go['match'] + 15
    assert go['missing_skills'][0] == 'Go' and 'title asks for Go' in ' '.join(go['notes'])


@pytest.mark.parametrize('broken,fixed', [
    ('Sotheby\u00e2\u0080\u0099s', 'Sotheby\u2019s'),                    # Remote OK, read as Latin-1
    ('Telefondienst f\u00c3\u00bcr Praxis', 'Telefondienst f\u00fcr Praxis'),
    ('Lead \u00e2\u0080\u0094 Logistics', 'Lead \u2014 Logistics'),
    ('Sotheby\u00e2\u20ac\u2122s', 'Sotheby\u2019s'),                    # the same, read as Windows-1252
    ('Caf\u00e9 in M\u00fcnchen, \u20b9 12 LPA', 'Caf\u00e9 in M\u00fcnchen, \u20b9 12 LPA'),  # correct text is left alone
    ('\u00c2\u00a9 2026', '\u00a9 2026'),
])
def test_double_encoded_text_is_repaired(broken, fixed):
    assert common.fix_mojibake(broken) == fixed
    job = common.make_job('remoteok', 1, f'Engineer at {broken}', broken, 'https://remoteok.com/1', 'Remote', f'<p>{broken}</p>')
    assert job['company'] == fixed and fixed in job['title'] and fixed in job['description']


def test_old_jobs_are_left_out(app, fake_sources, monkeypatch):
    stale = {'data': [{**JSEARCH['data'][0], 'job_posted_at_datetime_utc': f'{OLD}T08:00:00Z'}]}
    monkeypatch.setattr(sources, 'request_json', _router([], [('openwebninja.com/jsearch', stale)]))
    with app.test_request_context():
        assert sources.fetch('jsearch', SEARCH) == []
