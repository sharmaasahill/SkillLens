from skilllens import create_app
from skilllens.config import TestingConfig
from skilllens.extensions import db

from .conftest import create_user, login


def _cookie_headers(response):
    return [value for key, value in response.headers.items() if key == 'Set-Cookie']


def test_register_sets_httponly_cookies_and_no_token_in_body(client):
    response = client.post('/auth/register', json={
        'email': 'New@Example.com', 'password': 'mango-river-lamp-7', 'full_name': 'New User', 'accept_privacy': True})
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
        'email': 'taken@example.com', 'password': 'password123', 'full_name': 'X', 'accept_privacy': True}).status_code == 409

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


ADMIN = {'email': TestingConfig.ADMIN_EMAIL, 'password': TestingConfig.ADMIN_PASSWORD}


def test_one_login_admin_email_is_admin_and_others_are_users(client):
    from models.database import User
    create_user('user@example.com')

    user = client.post('/auth/login', json={'email': 'user@example.com', 'password': 'password123'})
    assert user.status_code == 200 and user.get_json()['user']['is_admin'] is False

    # The admin account does not exist yet: its first sign-in creates it
    assert User.query.filter_by(email=ADMIN['email']).first() is None
    admin = client.post('/auth/login', json={**ADMIN, 'email': ADMIN['email'].upper()})
    assert admin.status_code == 200 and admin.get_json()['user']['is_admin'] is True
    assert User.query.filter_by(is_admin=True).count() == 1

    wrong = client.post('/auth/login', json={**ADMIN, 'password': 'not-the-password'})
    assert wrong.status_code == 401


def test_nobody_can_register_the_admin_email(client):
    response = client.post('/auth/register', json={**ADMIN, 'password': 'password123', 'full_name': 'Sneaky', 'accept_privacy': True})
    assert response.status_code == 409


def test_admin_email_is_the_only_admin(client):
    from models.database import User
    old = create_user('old-admin@example.com', is_admin=True)
    assert client.post('/auth/login', json=ADMIN).status_code == 200
    db.session.refresh(old)
    assert old.is_admin is False
    assert [u.email for u in User.query.filter_by(is_admin=True)] == [ADMIN['email']]


def test_admin_password_comes_from_settings(app, client):
    assert client.post('/auth/login', json=ADMIN).status_code == 200
    app.config['ADMIN_PASSWORD'] = 'a-new-admin-password'
    assert client.post('/auth/login', json=ADMIN).status_code == 401
    assert client.post('/auth/login', json={**ADMIN, 'password': 'a-new-admin-password'}).status_code == 200
    app.config['ADMIN_PASSWORD'] = ''  # not set: admin sign-in is off
    assert client.post('/auth/login', json={**ADMIN, 'password': 'a-new-admin-password'}).status_code == 401


def test_reset_data_deletes_every_account(app, client, user_session):
    from models.database import ApiUsage, User
    from datetime import date
    db.session.add(ApiUsage(provider='gemini', day=date.today(), calls=3))
    db.session.commit()
    client.post('/auth/login', json=ADMIN)
    assert User.query.count() == 2

    result = app.test_cli_runner().invoke(args=['reset-data', '--yes'])
    assert result.exit_code == 0, result.output
    assert User.query.count() == 0
    assert ApiUsage.query.count() == 1  # paid-API budgets are kept
    # The admin comes back on its next sign-in
    assert client.post('/auth/login', json=ADMIN).status_code == 200


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
