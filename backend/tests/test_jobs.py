from models.database import User


def test_dataset_job_matching_is_gone(client, user_session):
    # Matching against the expired 2025 postings was removed; live job search replaced it
    for path in ['/api/recommend-jobs', '/api/recommend-jobs-by-skills', '/api/job-market-analysis', '/api/live-jobs']:
        assert client.post(path, headers=user_session, json={}).status_code in (404, 405), path
    for path in ['/api/job-categories', '/api/job-locations']:
        assert client.get(path, headers=user_session).status_code == 404, path


def test_jobs_need_a_candidate_login(client):
    assert client.get('/api/jobs/setup').status_code == 401
    assert client.post('/api/jobs/search', json={'role': 'Data Analyst'}).status_code == 401


def test_unknown_api_path_returns_json_404(client):
    response = client.get('/api/does-not-exist')
    assert response.status_code == 404
    assert 'error' in response.get_json()


def test_health(client):
    assert client.get('/health').get_json() == {'status': 'ok'}


def test_profile_role_and_city_prefill_the_search(client, user_session):
    user = User.query.filter_by(email='user@example.com').first()
    user.current_work, user.current_location = 'Java Developer', 'Bangalore, Karnataka'
    from skilllens.extensions import db
    db.session.commit()
    setup = client.get('/api/jobs/setup', headers=user_session).get_json()
    assert setup['defaults']['role'] == 'Java Developer'
    assert setup['defaults']['city'] == 'Bengaluru'
    assert setup['has_resume'] is False
