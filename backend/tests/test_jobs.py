from models.database import User

from .conftest import add_resume


def test_dataset_job_matching_is_gone(client, user_session):
    # Matching against the expired 2025 postings was removed; the jobs page says "coming soon"
    for path in ['/api/recommend-jobs', '/api/recommend-jobs-by-skills', '/api/job-market-analysis']:
        assert client.post(path, headers=user_session, json={}).status_code in (404, 405), path
    for path in ['/api/job-categories', '/api/job-locations']:
        assert client.get(path, headers=user_session).status_code == 404, path


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
    assert sorted(first['jobs'][0]['matched_skills']) == ['Excel', 'SQL']
    assert first['searched_for'] == ['SQL', 'Excel']  # most-mentioned skills first, as stored
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


def test_unknown_api_path_returns_json_404(client):
    response = client.get('/api/does-not-exist')
    assert response.status_code == 404
    assert 'error' in response.get_json()


def test_health(client):
    assert client.get('/health').get_json() == {'status': 'ok'}
