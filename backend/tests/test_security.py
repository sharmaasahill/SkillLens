"""Security headers, upload size, password strength, privacy consent, admin two-factor sign-in,
Google sign-in, cleanup and city comparison."""
import base64
import io
import json
import time
import urllib.parse
from datetime import date, datetime, timedelta

import pyotp
import pytest

from models.database import ApiUsage, JobSearch, JobSourceResult, User
from skilllens.config import TestingConfig
from skilllens.extensions import db
from skilllens.services import google_auth, two_factor

from .conftest import PASSWORD, create_user, login

ADMIN = {'email': TestingConfig.ADMIN_EMAIL, 'password': TestingConfig.ADMIN_PASSWORD}
STRONG = 'mango-river-lamp-7'


def _register(client, **extra):
    body = {'email': 'new@example.com', 'password': STRONG, 'full_name': 'New Person', 'date_of_birth': '1998-05-14',
            'accept_privacy': True, **extra}
    return client.post('/auth/register', json=body)


# ----- headers and uploads -----

def test_security_headers_on_every_response(client, user_session):
    response = client.get('/profile')
    csp = response.headers['Content-Security-Policy']
    assert "frame-ancestors 'none'" in csp and "script-src 'self'" in csp and "object-src 'none'" in csp
    assert response.headers['X-Frame-Options'] == 'DENY'
    assert response.headers['X-Content-Type-Options'] == 'nosniff'
    assert response.headers['Referrer-Policy'] == 'strict-origin-when-cross-origin'
    assert response.headers['Cache-Control'] == 'no-store'
    assert 'Strict-Transport-Security' not in response.headers  # only over HTTPS
    https = client.get('/health', base_url='https://localhost')
    assert https.headers['Strict-Transport-Security'].startswith('max-age=31536000')


def test_resumes_over_5_mb_are_refused(client, user_session):
    big = b'%PDF-1.4\n' + b'0' * (5 * 1024 * 1024 + 10)
    response = client.post('/upload-resume', headers=user_session,
                           data={'file': (io.BytesIO(big), 'big.pdf')}, content_type='multipart/form-data')
    assert response.status_code == 413 and '5 MB' in response.get_json()['error']


# ----- passwords and privacy consent -----

@pytest.mark.parametrize('weak', ['password123', 'India@2026', 'P@ssw0rd!!', '12345678', 'abcdefgh', 'aaaaaaaa',
                                  'qwerty12345', 'skilllens2026', 'newperson1', '98765432100'])
def test_easy_passwords_are_refused(client, weak):
    response = _register(client, password=weak)
    assert response.status_code == 400, weak


def test_privacy_consent_is_required_and_recorded(client):
    missing = client.post('/auth/register', json={'email': 'a@example.com', 'password': STRONG, 'full_name': 'A',
                                                  'date_of_birth': '1998-05-14'})
    assert missing.status_code == 400 and missing.get_json()['details'][0]['field'] == 'accept_privacy'
    assert _register(client).status_code == 201
    user = User.query.filter_by(email='new@example.com').one()
    assert user.privacy_accepted_at is not None and user.privacy_version == TestingConfig.PRIVACY_VERSION


def test_admin_sign_in_is_off_without_an_admin_email(app, client):
    app.config['ADMIN_EMAIL'] = ''
    assert client.post('/auth/login', json=ADMIN).status_code == 401


def test_admin_settings_ignore_pasted_quotes_and_are_described_safely(monkeypatch):
    from importlib import reload
    from skilllens import config
    from skilllens.services import admin_account
    monkeypatch.setenv('ADMIN_EMAIL', ' "Admin.SkillLens@Gmail.com" ')
    monkeypatch.setenv('ADMIN_PASSWORD', '`admin20Skilllens26`')
    reload(config)
    try:
        assert config.Config.ADMIN_EMAIL == 'admin.skilllens@gmail.com'
        assert config.Config.ADMIN_PASSWORD == 'admin20Skilllens26'
        line = admin_account.describe_settings({'ADMIN_EMAIL': config.Config.ADMIN_EMAIL, 'ADMIN_PASSWORD': config.Config.ADMIN_PASSWORD})
        assert line == 'Admin sign-in is ON for adm...@gmail.com (25 characters); ADMIN_PASSWORD has 18 characters.'
        assert 'admin20' not in line
        assert 'OFF: ADMIN_EMAIL not set' in admin_account.describe_settings({'ADMIN_PASSWORD': 'x'})
    finally:
        monkeypatch.delenv('ADMIN_EMAIL')
        monkeypatch.delenv('ADMIN_PASSWORD')
        reload(config)


def test_failed_admin_sign_in_says_why(client, caplog):
    import logging
    with caplog.at_level(logging.WARNING):
        client.post('/auth/login', json={**ADMIN, 'password': 'not-the-password'})
    assert 'the password typed is not the ADMIN_PASSWORD setting' in caplog.text
    assert 'not-the-password' not in caplog.text


def test_site_info_is_public(client):
    assert client.get('/api/site').get_json() == {'google_sign_in': False, 'contact_email': None,
                                                  'privacy_version': TestingConfig.PRIVACY_VERSION}


def test_me_returns_the_refresh_csrf_token(client, user_session):
    body = client.get('/auth/me').get_json()
    assert body['csrf_access_token'] and body['csrf_refresh_token']


# ----- admin two-factor sign-in -----

def _enable_two_factor(client):
    headers = login(client, ADMIN['email'], ADMIN['password'])
    setup = client.post('/api/admin/2fa/setup', headers=headers).get_json()
    assert setup['qr'].startswith('data:image/svg+xml') and setup['otpauth_uri'].startswith('otpauth://totp/SkillLens')
    secret = setup['secret'].replace(' ', '')
    assert client.post('/api/admin/2fa/enable', headers=headers, json={'code': '000000'}).status_code == 400
    enabled = client.post('/api/admin/2fa/enable', headers=headers, json={'code': pyotp.TOTP(secret).now()}).get_json()
    assert enabled['enabled'] and len(enabled['recovery_codes']) == 8
    return secret, enabled['recovery_codes'], headers


def _next_code(secret):
    """A code for the next 30-second step, so it is never the one setup just used."""
    return pyotp.TOTP(secret).at(time.time() + 30)


def test_two_factor_sign_in_needs_the_app_code(client, make_client):
    secret, recovery, _ = _enable_two_factor(client)

    browser = make_client()
    first = browser.post('/auth/login', json=ADMIN)
    body = first.get_json()
    assert body['two_factor_required'] and 'user' not in body
    assert not any(c.startswith('access_token_cookie=') for c in first.headers.getlist('Set-Cookie'))

    assert browser.post('/auth/2fa', json={'challenge': body['challenge'], 'code': '123456'}).status_code == 401
    code = _next_code(secret)
    ok = browser.post('/auth/2fa', json={'challenge': body['challenge'], 'code': code})
    assert ok.status_code == 200 and ok.get_json()['user']['is_admin'] is True
    assert browser.get('/api/admin/stats').status_code == 200
    # The same code can never be used twice
    again = make_client().post('/auth/login', json=ADMIN).get_json()
    assert make_client().post('/auth/2fa', json={'challenge': again['challenge'], 'code': code}).status_code == 401


def test_recovery_codes_work_once(client, make_client):
    _, recovery, _ = _enable_two_factor(client)
    challenge = make_client().post('/auth/login', json=ADMIN).get_json()['challenge']
    used = make_client().post('/auth/2fa', json={'challenge': challenge, 'code': recovery[0].upper()})
    assert used.status_code == 200 and used.get_json()['recovery_codes_left'] == 7
    challenge = make_client().post('/auth/login', json=ADMIN).get_json()['challenge']
    assert make_client().post('/auth/2fa', json={'challenge': challenge, 'code': recovery[0]}).status_code == 401


def test_wrong_codes_are_limited_and_challenges_expire(client, make_client, monkeypatch):
    _enable_two_factor(client)
    challenge = make_client().post('/auth/login', json=ADMIN).get_json()['challenge']
    statuses = [make_client().post('/auth/2fa', json={'challenge': challenge, 'code': '000000'}).status_code
                for _ in range(two_factor.WRONG_CODES_PER_DAY + 1)]
    assert statuses[-1] == 429
    assert make_client().post('/auth/2fa', json={'challenge': 'not-a-real-challenge', 'code': '000000'}).status_code == 401
    monkeypatch.setattr(two_factor, 'CHALLENGE_SECONDS', -1)
    assert make_client().post('/auth/2fa', json={'challenge': challenge, 'code': '000000'}).status_code == 401


def test_turning_off_two_factor_needs_password_and_code(app, client):
    secret, _, headers = _enable_two_factor(client)
    assert client.post('/api/admin/2fa/disable', headers=headers,
                       json={'password': 'wrong', 'code': _next_code(secret)}).status_code == 403
    off = client.post('/api/admin/2fa/disable', headers=headers, json={'password': ADMIN['password'], 'code': _next_code(secret)})
    assert off.status_code == 200 and off.get_json()['enabled'] is False
    assert 'user' in client.post('/auth/login', json=ADMIN).get_json()


def test_lost_phone_command_turns_it_off(app, client):
    _enable_two_factor(client)
    result = app.test_cli_runner().invoke(args=['admin-2fa-off', '--yes'])
    assert result.exit_code == 0 and 'is off' in result.output
    assert 'user' in client.post('/auth/login', json=ADMIN).get_json()


# ----- Google sign-in -----

@pytest.fixture
def google_on(app):
    app.config.update(GOOGLE_CLIENT_ID='client-123.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET='shh')


def _id_token(claims):
    def part(data):
        return base64.urlsafe_b64encode(json.dumps(data).encode()).rstrip(b'=').decode()
    return f"{part({'alg': 'RS256'})}.{part(claims)}.signature"


def _google_flow(client, monkeypatch, mode='signup', email='person@gmail.com', sub='g-1', photo=b'', **claims):
    start = client.get(f"/auth/google/start?mode={mode}")
    assert start.status_code == 302 and start.location.startswith(google_auth.AUTHORIZE_URL)
    params = urllib.parse.parse_qs(urllib.parse.urlparse(start.location).query)
    assert params['code_challenge_method'] == ['S256'] and params['redirect_uri'] == ['http://localhost/auth/google/callback']
    saved = google_auth._serializer().loads(client.get_cookie(google_auth.COOKIE, path='/auth/google').value)

    token = _id_token({'aud': 'client-123.apps.googleusercontent.com', 'iss': 'https://accounts.google.com',
                       'exp': time.time() + 600, 'nonce': saved['nonce'], 'sub': sub, 'email': email,
                       'email_verified': True, 'name': 'Priya Sharma', **claims})

    class FakeResponse(io.BytesIO):
        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

    sent = {}

    def fake_urlopen(req, timeout):
        if req.data is None:  # downloading the Google profile photo
            sent['photo_url'] = req.full_url
            return FakeResponse(photo)
        sent['body'] = urllib.parse.parse_qs(req.data.decode())
        return FakeResponse(json.dumps({'id_token': token}).encode())
    monkeypatch.setattr(google_auth.urllib.request, 'urlopen', fake_urlopen)
    callback = client.get(f"/auth/google/callback?code=abc&state={params['state'][0]}")
    return callback, sent


def test_google_sign_up_creates_an_account(client, google_on, monkeypatch):
    callback, sent = _google_flow(client, monkeypatch)
    assert callback.status_code == 302 and callback.location.endswith('/dashboard')
    assert sent['body']['code_verifier'] and sent['body']['client_secret'] == ['shh']
    user = User.query.filter_by(email='person@gmail.com').one()
    assert user.google_sub == 'g-1' and user.has_password is False and user.privacy_accepted_at is not None
    me = client.get('/auth/me').get_json()
    assert me['user']['email'] == 'person@gmail.com' and me['csrf_refresh_token']
    assert client.get('/api/site').get_json()['google_sign_in'] is True


def test_google_from_the_sign_in_page_creates_the_account_too(client, google_on, monkeypatch):
    callback, _ = _google_flow(client, monkeypatch, mode='signin')
    assert callback.location.endswith('/dashboard')
    assert User.query.filter_by(email='person@gmail.com').one().privacy_accepted_at is not None


def test_a_google_account_with_the_admin_email_becomes_the_admin(app, client, google_on, monkeypatch):
    # Signed up with Google while ADMIN_EMAIL was missing: setting it later makes that account the admin
    app.config['ADMIN_EMAIL'] = ''
    _google_flow(client, monkeypatch, email=TestingConfig.ADMIN_EMAIL, sub='g-admin')
    app.config['ADMIN_EMAIL'] = TestingConfig.ADMIN_EMAIL
    body = client.post('/auth/login', json=ADMIN).get_json()
    assert body['user']['is_admin'] is True
    assert User.query.filter_by(email=TestingConfig.ADMIN_EMAIL).one().has_password is True


def test_google_links_an_existing_account_and_refuses_the_admin(client, google_on, monkeypatch, make_client):
    create_user('person@gmail.com', full_name='Priya')
    callback, _ = _google_flow(client, monkeypatch, mode='signin')
    assert callback.location.endswith('/dashboard')
    assert User.query.filter_by(email='person@gmail.com').one().google_sub == 'g-1'

    admin_try, _ = _google_flow(make_client(), monkeypatch, email=ADMIN['email'], sub='g-admin')
    assert 'error=google_admin' in admin_try.location


def test_google_sign_in_copies_the_google_photo_once(client, google_on, monkeypatch):
    png = b'\x89PNG\r\n\x1a\n' + b'\x00' * 32
    google_photo = 'https://lh3.googleusercontent.com/a/abc123=s96-c'
    _, sent = _google_flow(client, monkeypatch, photo=png, picture=google_photo)
    assert sent['photo_url'].endswith('=s256-c')  # asks Google for a sharper copy
    user = User.query.filter_by(email='person@gmail.com').one()
    assert user.picture_source == 'google' and client.get('/auth/me').get_json()['user']['picture']
    assert client.get('/profile/picture').data == png

    # Removed by the person: signing in with Google again does not bring it back
    csrf = {'X-CSRF-TOKEN': client.get('/auth/me').get_json()['csrf_access_token']}
    client.delete('/profile/picture', headers=csrf)
    _, sent = _google_flow(client, monkeypatch, mode='signin', photo=png, picture=google_photo)
    assert 'photo_url' not in sent and User.query.filter_by(email='person@gmail.com').one().picture_path is None


def test_google_photo_from_another_host_or_broken_is_skipped(client, google_on, monkeypatch, make_client):
    callback, sent = _google_flow(client, monkeypatch, picture='https://evil.example/me.png')
    assert callback.location.endswith('/dashboard') and 'photo_url' not in sent
    # Not an image: sign-in still works, just without a photo
    callback, sent = _google_flow(make_client(), monkeypatch, email='b@gmail.com', sub='g-2', photo=b'<html>',
                                  picture='https://lh3.googleusercontent.com/a/x=s96-c')
    assert callback.location.endswith('/dashboard') and sent['photo_url']
    assert User.query.filter_by(email='b@gmail.com').one().picture_path is None


def test_google_rejects_a_wrong_state_or_unverified_email(client, google_on, monkeypatch):
    client.get('/auth/google/start?mode=signup')
    assert 'error=google_state' in client.get('/auth/google/callback?code=abc&state=forged').location
    callback, _ = _google_flow(client, monkeypatch, email_verified=False)
    assert 'error=google_unverified' in callback.location


def test_google_accounts_set_a_password_and_confirm_deletion_by_email(client, google_on, monkeypatch):
    _google_flow(client, monkeypatch)
    csrf = {'X-CSRF-TOKEN': client.get('/auth/me').get_json()['csrf_access_token']}
    first = client.post('/profile/change-password', headers=csrf, json={'new_password': STRONG})
    assert first.status_code == 200
    assert User.query.filter_by(email='person@gmail.com').one().has_password is True


def test_google_only_account_deletes_with_its_email(client, google_on, monkeypatch):
    _google_flow(client, monkeypatch)
    csrf = {'X-CSRF-TOKEN': client.get('/auth/me').get_json()['csrf_access_token']}
    assert client.post('/profile/delete', headers=csrf, json={'confirm_email': 'other@gmail.com'}).status_code == 403
    assert client.post('/profile/delete', headers=csrf, json={'confirm_email': 'Person@Gmail.com'}).status_code == 200
    assert User.query.filter_by(email='person@gmail.com').first() is None


# ----- housekeeping and storage -----

def test_cleanup_removes_old_cache_but_keeps_recent(app, client, user_session):
    from skilllens.services import maintenance
    user = User.query.filter_by(email='user@example.com').one()
    old, new = datetime.utcnow() - timedelta(days=10), datetime.utcnow()
    db.session.add_all([
        JobSourceResult(source='remotive', query_key='a', status='done', jobs='[]', started_at=old),
        JobSourceResult(source='remotive', query_key='b', status='done', jobs='[]', started_at=new),
        JobSearch(id='old', user_id=user.id, query='{}', results='{}', created_at=old),
        ApiUsage(provider='gemini', day=date.today() - timedelta(days=200), calls=1),
        ApiUsage(provider='gemini', day=date.today(), calls=1),
    ])
    db.session.commit()
    counts = maintenance.cleanup()
    assert counts == {'cached job results': 1, 'job searches': 1, 'usage counters': 1}
    assert JobSourceResult.query.count() == 1 and ApiUsage.query.count() == 1

    admin = login(client, ADMIN['email'], ADMIN['password'])  # noqa: F841 - signs this client in as admin
    storage = client.get('/api/admin/usage').get_json()['storage']
    assert storage['limit_bytes'] == 1024 * 1024 * 1024 and storage['cached_job_results'] == 1


# ----- city comparison -----

def test_city_comparison_ranks_cities_and_keeps_yours(client, user_session):
    body = client.post('/salary/cities', headers=user_session, json={
        'job_title': 'Data Analyst', 'years_of_experience': 3, 'city': 'Jaipur', 'skills': ['SQL']}).get_json()
    cities = [c['city'] for c in body['cities']]
    assert 'Jaipur' in cities and 'Bengaluru' in cities and 'Remote' not in cities and len(cities) == 9
    pay = [c['predicted_salary'] for c in body['cities']]
    assert pay == sorted(pay, reverse=True) and body['cities'][0]['vs_top_pct'] == 0
    assert all(c['salary_range']['min'] <= c['predicted_salary'] <= c['salary_range']['max'] for c in body['cities'])

    picked = client.post('/salary/cities', headers=user_session, json={
        'job_title': 'Data Analyst', 'years_of_experience': 3, 'cities': ['Pune', 'Atlantis', 'Pune']}).get_json()
    assert [c['city'] for c in picked['cities']] == ['Pune']
    none = client.post('/salary/cities', headers=user_session, json={
        'job_title': 'Data Analyst', 'years_of_experience': 3, 'cities': ['Atlantis']})
    assert none.status_code == 400
