from models.database import User

from .conftest import add_resume


def test_recommendations_need_a_resume(client, user_session):
    response = client.post('/api/recommend-jobs', headers=user_session, json={})
    assert response.status_code == 400


def test_recommendations_use_stored_resume_analysis(client, user_session):
    user = User.query.filter_by(email='user@example.com').first()
    add_resume(user, score=70, skills=['Python', 'React', 'SQL'])

    response = client.post('/api/recommend-jobs', headers=user_session, json={'top_k': 3})
    assert response.status_code == 200
    body = response.get_json()
    assert body['total_recommendations'] == 3
    assert body['user_profile']['extracted_skills'] == ['Python', 'React', 'SQL']


def test_matches_are_indian_postings_that_share_skills(client, user_session):
    user = User.query.filter_by(email='user@example.com').first()
    add_resume(user, score=70, skills=['Python', 'SQL', 'Machine Learning', 'Pandas'])

    body = client.post('/api/recommend-jobs', headers=user_session,
                       json={'top_k': 5, 'experience_years': 3, 'preferred_locations': ['Pune']}).get_json()
    jobs = body['recommendations']
    assert len(jobs) == 5
    for job in jobs:
        assert job['city'] == 'Pune'  # enough Pune postings exist, so the preference filters
        assert len(job['matched_skills']) >= 2
        assert job['job_url'].startswith('https://www.naukri.com/')
    # At most two roles from one company, so one big employer cannot fill the list
    companies = [job['company'] for job in jobs]
    assert max(companies.count(c) for c in companies) <= 2
    assert body['skills_analysis']['source']['licence'] == 'CC BY-NC-SA 4.0'
    # Live listings are never fetched with the matches; no keys in tests, so the button stays hidden
    assert body['live']['sources'] == []


def test_short_skills_match_whole_tags_only(client):
    # "R" must not match "React" or "Recruitment"
    jobs = client.post('/api/recommend-jobs-by-skills', json={'skills': ['R', 'Statistics'], 'top_k': 5}).get_json()
    for job in jobs['recommendations']:
        assert set(s.lower() for s in job['matched_skills']) <= {'r', 'statistics'}


def _fake_adzuna(calls):
    def fake(url, headers=None):
        calls.append(url)
        return {'results': [{'id': len(calls), 'title': 'Data Analyst', 'description': 'SQL and Excel daily',
                             'company': {'display_name': 'Acme'}, 'location': {'display_name': 'Pune'},
                             'redirect_url': 'https://example.com/job', 'created': '2026-10-20T10:00:00Z'}]}
    return fake


def test_live_jobs_are_on_demand_and_capped_per_day(app, client, user_session, monkeypatch):
    from skilllens.services import live_jobs

    user = User.query.filter_by(email='user@example.com').first()
    add_resume(user, score=70, skills=['SQL', 'Excel'])
    assert client.post('/api/live-jobs', headers=user_session, json={}).status_code == 404  # no keys yet

    app.config.update(ADZUNA_APP_ID='id', ADZUNA_APP_KEY='key', LIVE_JOBS_DAILY_LIMIT=2)
    live_jobs._cache.clear()
    calls = []
    monkeypatch.setattr(live_jobs, '_get_json', _fake_adzuna(calls))

    first = client.post('/api/live-jobs', headers=user_session, json={'city': 'Pune'}).get_json()
    assert first['jobs'][0]['matched_skills'] == ['SQL', 'Excel'] or first['jobs'][0]['matched_skills'] == ['Excel', 'SQL']
    assert first['remaining_today'] == 1 and len(calls) == 1

    again = client.post('/api/live-jobs', headers=user_session, json={'city': 'Pune'}).get_json()
    assert again['from_cache'] and len(calls) == 1  # same search within 30 minutes is free

    client.post('/api/live-jobs', headers=user_session, json={'city': 'Mumbai'})
    blocked = client.post('/api/live-jobs', headers=user_session, json={'city': 'Delhi'}).get_json()
    assert blocked['limit_reached'] and blocked['jobs'] == [] and blocked['remaining_today'] == 0
    assert len(calls) == 2  # the cap stopped the third real call
    live_jobs._cache.clear()


def test_live_job_failures_are_quiet(app, monkeypatch):
    from skilllens.services import live_jobs

    with app.test_request_context():
        assert live_jobs.search(['python'])['jobs'] == []  # no keys configured
        app.config.update(ADZUNA_APP_ID='id', ADZUNA_APP_KEY='key')
        live_jobs._cache.clear()

        def boom(*args, **kwargs):
            raise live_jobs.urllib.error.URLError('offline')

        monkeypatch.setattr(live_jobs, '_get_json', boom)
        assert live_jobs.search(['python'], city='Pune')['jobs'] == []
        live_jobs._cache.clear()

    annotated = live_jobs.annotate([
        {'position': 'Data Analyst', 'description': 'SQL and Excel daily'},
        {'position': 'React Developer', 'description': 'Recruitment drive'},
    ], ['SQL', 'R'])
    assert annotated[0]['matched_skills'] == ['SQL']
    assert annotated[1]['matched_skills'] == []


def test_public_skill_endpoint_validates_input(client):
    assert client.post('/api/recommend-jobs-by-skills', json={'skills': []}).status_code == 400
    ok = client.post('/api/recommend-jobs-by-skills', json={'skills': ['Python'], 'top_k': 2})
    assert ok.status_code == 200 and ok.get_json()['total_recommendations'] == 2


def test_unknown_api_path_returns_json_404(client):
    response = client.get('/api/does-not-exist')
    assert response.status_code == 404
    assert 'error' in response.get_json()


def test_health(client):
    assert client.get('/health').get_json() == {'status': 'ok'}
