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
