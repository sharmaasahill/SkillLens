from skilllens import create_app
from skilllens.config import TestingConfig
from skilllens.extensions import db

from .conftest import create_user, login


def _cookie_headers(response):
    return [value for key, value in response.headers.items() if key == 'Set-Cookie']


def test_register_sets_httponly_cookies_and_no_token_in_body(client):
    response = client.post('/auth/register', json={
        'email': 'New@Example.com', 'password': 'password123', 'full_name': 'New User'})
    assert response.status_code == 201
    body = response.get_json()
    assert body['user']['email'] == 'new@example.com'
    assert 'token' not in body and 'access_token' not in body
    assert body['csrf_access_token'] and body['csrf_refresh_token']

    cookies = _cookie_headers(response)
    access = next(c for c in cookies if c.startswith('access_token_cookie='))
    refresh = next(c for c in cookies if c.startswith('refresh_token_cookie='))
    assert 'HttpOnly' in access and 'HttpOnly' in refresh
    assert 'Path=/auth/' in refresh


def test_register_rejects_duplicates_and_bad_input(client):
    create_user('taken@example.com')
    assert client.post('/auth/register', json={
        'email': 'taken@example.com', 'password': 'password123', 'full_name': 'X'}).status_code == 409

    response = client.post('/auth/register', json={'email': 'not-an-email', 'password': 'short', 'full_name': ''})
    assert response.status_code == 400
    fields = {d['field'] for d in response.get_json()['details']}
    assert {'email', 'password', 'full_name'} <= fields


def test_login_failure_does_not_reveal_which_part_was_wrong(client):
    create_user('user@example.com')
    wrong_password = client.post('/auth/login', json={'email': 'user@example.com', 'password': 'nope'})
    unknown_email = client.post('/auth/login', json={'email': 'ghost@example.com', 'password': 'nope'})
    assert wrong_password.status_code == unknown_email.status_code == 401
    assert wrong_password.get_json() == unknown_email.get_json()


def test_me_requires_login(client):
    assert client.get('/auth/me').status_code == 401
    create_user('user@example.com', full_name='Test User')
    login(client, 'user@example.com')
    response = client.get('/auth/me')
    assert response.status_code == 200
    assert response.get_json()['user']['full_name'] == 'Test User'


def test_write_requests_require_csrf_header(client, user_session):
    without = client.put('/update-profile', json={'bio': 'hello'})
    assert without.status_code == 401
    with_csrf = client.put('/update-profile', json={'bio': 'hello'}, headers=user_session)
    assert with_csrf.status_code == 200


def test_refresh_issues_new_access_token(client):
    create_user('user@example.com')
    response = client.post('/auth/login', json={'email': 'user@example.com', 'password': 'password123'})
    refresh_csrf = response.get_json()['csrf_refresh_token']

    refreshed = client.post('/auth/refresh', headers={'X-CSRF-TOKEN': refresh_csrf})
    assert refreshed.status_code == 200
    assert any(c.startswith('access_token_cookie=') for c in _cookie_headers(refreshed))


def test_logout_clears_cookies(client, user_session):
    assert client.post('/auth/logout').status_code == 200
    assert client.get('/auth/me').status_code == 401


def test_login_is_rate_limited(tmp_path):
    app = create_app(TestingConfig, {
        'RATELIMIT_ENABLED': True,
        'AUTH_RATE_LIMIT': '3 per minute',
        'UPLOAD_FOLDER': str(tmp_path),
    })
    with app.app_context():
        db.create_all()
        client = app.test_client()
        statuses = [client.post('/auth/login', json={'email': 'a@example.com', 'password': 'x'}).status_code
                    for _ in range(4)]
        db.drop_all()
    assert statuses[:3] == [401, 401, 401]
    assert statuses[3] == 429
