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
    # No API keys in tests, so no live listings and nothing leaves the machine
    assert body['live_jobs'] == [] and body['live_sources'] == []


def test_short_skills_match_whole_tags_only(client):
    # "R" must not match "React" or "Recruitment"
    jobs = client.post('/api/recommend-jobs-by-skills', json={'skills': ['R', 'Statistics'], 'top_k': 5}).get_json()
    for job in jobs['recommendations']:
        assert set(s.lower() for s in job['matched_skills']) <= {'r', 'statistics'}


def test_live_jobs_are_annotated_and_failures_are_quiet(app, monkeypatch):
    from skilllens.services import live_jobs

    with app.test_request_context():
        assert live_jobs.search(['python']) == []  # no keys configured
        app.config.update(ADZUNA_APP_ID='id', ADZUNA_APP_KEY='key')

        def boom(*args, **kwargs):
            raise live_jobs.urllib.error.URLError('offline')

        monkeypatch.setattr(live_jobs, '_get_json', boom)
        assert live_jobs.search(['python'], city='Pune') == []

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
