"""Account controls, account deletion, password changes, the error log, API usage, offer check,
score history and cover letters."""
import io
import json
from datetime import date

import pytest

from models.database import ApiUsage, ErrorLog, Resume, ResumeScore, StoredFile, User
from skilllens.config import TestingConfig
from skilllens.extensions import db
from skilllens.services import gemini

from .conftest import PASSWORD, PDF_BYTES, add_resume, create_user, login

API = '/api/admin'


@pytest.fixture
def admin(make_client):
    browser = make_client()
    headers = login(browser, TestingConfig.ADMIN_EMAIL, TestingConfig.ADMIN_PASSWORD)
    return browser, headers


def _user(email='member@example.com', **fields):
    return create_user(email, full_name='Member', **fields)


# ----- block, reset password, delete -----

def test_blocking_ends_sessions_and_stops_sign_in(admin, make_client):
    browser, headers = admin
    member = _user()
    member_browser = make_client()
    login(member_browser, 'member@example.com')
    assert member_browser.get('/profile').status_code == 200

    assert browser.post(f'{API}/users/{member.id}/block', headers=headers).get_json()['blocked'] is True
    assert member_browser.get('/profile').status_code == 401  # the open session stopped working
    blocked = make_client().post('/auth/login', json={'email': 'member@example.com', 'password': PASSWORD})
    assert blocked.status_code == 403 and 'blocked' in blocked.get_json()['error']
    listed = browser.get(f'{API}/users?view=blocked').get_json()['users']
    assert [u['id'] for u in listed] == [member.id] and listed[0]['blocked'] is True
    assert browser.get(f'{API}/stats').get_json()['blocked_count'] == 1

    browser.post(f'{API}/users/{member.id}/unblock', headers=headers)
    login(make_client(), 'member@example.com')


def test_reset_password_gives_a_temporary_one_and_signs_out(admin, make_client):
    browser, headers = admin
    member = _user()
    member_browser = make_client()
    login(member_browser, 'member@example.com')

    response = browser.post(f'{API}/users/{member.id}/reset-password', headers=headers)
    temporary = response.get_json()['temporary_password']
    assert len(temporary) >= 12 and response.headers['Cache-Control'] == 'no-store'
    assert member_browser.get('/profile').status_code == 401
    assert make_client().post('/auth/login', json={'email': 'member@example.com', 'password': PASSWORD}).status_code == 401
    login(make_client(), 'member@example.com', temporary)


def test_the_admin_account_cannot_be_blocked_or_deleted(admin):
    browser, headers = admin
    admin_id = User.query.filter_by(is_admin=True).first().id
    assert browser.post(f'{API}/users/{admin_id}/block', headers=headers).status_code == 404
    assert browser.delete(f'{API}/users/{admin_id}', headers=headers).status_code == 404


def _upload(browser, headers):
    return browser.post('/upload-resume', headers=headers, data={'file': (io.BytesIO(PDF_BYTES), 'CV.pdf')},
                        content_type='multipart/form-data')


def test_admin_delete_removes_the_account_and_all_its_data(admin, make_client, fake_analysis):
    browser, headers = admin
    member = _user()
    member_id = member.id
    member_browser = make_client()
    member_headers = login(member_browser, 'member@example.com')
    assert _upload(member_browser, member_headers).status_code == 200
    db.session.add(ApiUsage(provider=f'gemini-user-{member_id}', day=date.today(), calls=2))
    db.session.commit()

    assert browser.delete(f'{API}/users/{member_id}', headers=headers).status_code == 200
    db.session.remove()
    assert db.session.get(User, member_id) is None
    assert Resume.query.filter_by(user_id=member_id).count() == 0
    assert ResumeScore.query.filter_by(user_id=member_id).count() == 0
    assert StoredFile.query.count() == 0
    assert ApiUsage.query.filter_by(provider=f'gemini-user-{member_id}').count() == 0
    assert member_browser.get('/profile').status_code == 401
    assert browser.get(f'{API}/users/{member_id}').status_code == 404


def test_users_can_delete_their_own_account_with_their_password(client, user_session, fake_analysis):
    assert _upload(client, user_session).status_code == 200
    wrong = client.post('/profile/delete', headers=user_session, json={'password': 'not-it'})
    assert wrong.status_code == 403
    done = client.post('/profile/delete', headers=user_session, json={'password': PASSWORD})
    assert done.status_code == 200
    assert User.query.filter_by(email='user@example.com').first() is None
    assert client.get('/auth/me').status_code == 401


def test_change_password_keeps_this_device_and_signs_out_others(client, user_session, make_client):
    other = make_client()
    login(other, 'user@example.com')
    response = client.post('/profile/change-password', headers=user_session,
                           json={'current_password': PASSWORD, 'new_password': 'brand-new-pass-1'})
    assert response.status_code == 200
    fresh = {'X-CSRF-TOKEN': response.get_json()['csrf_access_token']}
    assert client.get('/profile').status_code == 200
    assert client.put('/update-profile', headers=fresh, json={'bio': 'still here'}).status_code == 200
    assert other.get('/profile').status_code == 401
    login(make_client(), 'user@example.com', 'brand-new-pass-1')

    bad = client.post('/profile/change-password', headers=fresh,
                      json={'current_password': 'wrong-one', 'new_password': 'another-pass-2'})
    assert bad.status_code == 403


def test_old_stage_names_are_refused(admin):
    browser, headers = admin
    member = _user()
    assert browser.patch(f'{API}/users/{member.id}/review', headers=headers, json={'status': 'hired'}).status_code == 400
    ok = browser.patch(f'{API}/users/{member.id}/review', headers=headers, json={'status': 'flagged'})
    assert ok.get_json()['review']['status'] == 'flagged'


# ----- error log -----

def test_crashes_are_grouped_in_the_error_log(admin, client, user_session, monkeypatch):
    def broken(user):
        raise RuntimeError('history table on fire 42')
    monkeypatch.setattr('skilllens.services.profiles.history', broken)
    assert client.get('/profile/history').status_code == 500
    monkeypatch.setattr('skilllens.services.profiles.history', lambda user: (_ for _ in ()).throw(RuntimeError('history table on fire 43')))
    client.get('/profile/history')

    browser, headers = admin
    listed = browser.get(f'{API}/errors').get_json()
    assert listed['open_counts']['server'] >= 1
    crash = next(e for e in listed['errors'] if e['kind'] == 'server')
    assert crash['source'] == 'GET /profile/history' and 'RuntimeError' in crash['message']
    assert 'Traceback' in crash['detail'] and crash['user_id'] is not None

    assert browser.post(f"{API}/errors/{crash['id']}/resolve", headers=headers).status_code == 200
    assert browser.get(f'{API}/errors/count').get_json()['open_total'] == listed['open_total'] - 1
    assert browser.get(f'{API}/errors?view=fixed').get_json()['errors'][0]['id'] == crash['id']
    assert browser.delete(f'{API}/errors/fixed', headers=headers).get_json()['deleted'] == 1


def test_browser_errors_are_reported_and_grouped(admin, make_client):
    visitor = make_client()
    report = {'message': 'TypeError: x is undefined', 'stack': 'TypeError\n    at Jobs (main.js:1:200)', 'url': '/job-recommender'}
    assert visitor.post('/api/client-errors', json=report).status_code == 204
    assert visitor.post('/api/client-errors', json=report).status_code == 204
    assert visitor.post('/api/client-errors', json={'message': ''}).status_code == 400

    browser, _ = admin
    errors = browser.get(f'{API}/errors?kind=client').get_json()['errors']
    assert len(errors) == 1 and errors[0]['count'] == 2 and errors[0]['path'] == '/job-recommender'


def test_error_log_stays_small(app, monkeypatch):
    from skilllens.services import error_log
    monkeypatch.setattr(error_log, 'MAX_ROWS', 3)
    for i in range(5):
        error_log.record('server', f'GET /route-{i}', f'Boom {i}')
    assert ErrorLog.query.count() == 3
    assert {e.source for e in ErrorLog.query} == {'GET /route-2', 'GET /route-3', 'GET /route-4'}


def test_error_routes_are_admin_only(client, user_session):
    for path in ['/errors', '/errors/count', '/usage']:
        assert client.get(API + path).status_code == 403


# ----- API usage -----

def test_usage_counts_calls_per_service(admin):
    today = date.today()
    db.session.add_all([
        ApiUsage(provider='gemini', day=today, calls=4),
        ApiUsage(provider='gemini-user-7', day=today, calls=4),
        ApiUsage(provider='jobs-adzuna', day=today, calls=3),
        ApiUsage(provider='jobsearch-user-7', day=today, calls=5),
    ])
    db.session.commit()
    browser, _ = admin
    body = browser.get(f'{API}/usage').get_json()
    assert body['gemini']['today'] == 4 and body['gemini']['configured'] is False
    adzuna = next(s for s in body['sources'] if s['name'] == 'adzuna')
    assert adzuna['today'] == 3 and adzuna['configured'] is False and adzuna['needs'] == ['ADZUNA_APP_ID', 'ADZUNA_APP_KEY']
    assert body['job_searches']['today'] == 5
    assert len(body['daily']) == 14 and body['daily'][-1]['job_sources'] == 3
    assert body['apify']['configured'] is False


# ----- offer check -----

def test_offer_check_places_offers_in_order(client, user_session):
    base = {'job_title': 'Data Analyst', 'years_of_experience': 3, 'city': 'Pune'}
    low = client.post('/salary/offer-check', headers=user_session, json={**base, 'offer_lpa': 2}).get_json()
    high = client.post('/salary/offer-check', headers=user_session, json={**base, 'offer_lpa': 40}).get_json()
    mid = client.post('/salary/offer-check', headers=user_session, json={**base, 'offer_lpa': low['median'] / 100000}).get_json()
    assert low['percentile'] < mid['percentile'] < high['percentile']
    assert low['verdict'] == 'low' and low['ask_for'] and high['verdict'] == 'strong' and high['ask_for'] is None
    assert 40 <= mid['percentile'] <= 60
    assert low['likely_range']['min'] <= low['median'] <= low['likely_range']['max']
    assert client.post('/salary/offer-check', headers=user_session, json=base).status_code == 400


# ----- score history -----

def test_score_history_keeps_points_after_a_resume_is_deleted(client, user_session, fake_analysis):
    resume_id = _upload(client, user_session).get_json()['id']
    history = client.get('/resume-history').get_json()['score_history']
    assert [p['score'] for p in history] == [72] and history[0]['filename'] == 'CV.pdf'
    client.delete(f'/resume-history/{resume_id}', headers=user_session)
    assert len(client.get('/resume-history').get_json()['score_history']) == 1


# ----- cover letter -----

JD = ('Backend Engineer at Paytm. You will build payment services in Python, support production systems, '
      'and work with product teams. 3+ years of experience needed.')


def _letter_answer():
    letter = {
        'role': 'Backend Engineer', 'company': 'Paytm', 'greeting': 'Dear Hiring Manager,',
        'paragraphs': [
            'I would like to apply for the Backend Engineer role at Paytm.',
            'At Acme I built payment services. I also grew revenue by 45% in one quarter.',
            'I would bring [N] years of Python and calm production support.',
        ],
        'sign_off': 'Regards,',
    }
    return {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [{'text': json.dumps(letter)}]}}]}


@pytest.fixture
def letter_setup(app, client, user_session):
    app.config.update(GEMINI_API_KEY='test-key', GEMINI_MODELS=['model-a'], AI_DAILY_LIMIT=5, AI_USER_DAILY_LIMIT=3)
    gemini._cooling.clear()
    user = User.query.filter_by(email='user@example.com').first()
    resume = add_resume(user, score=60)
    resume.raw_text = 'Test User\nAcme | Engineer 2022 - Present\nBuilt payment services in Python.\n'
    db.session.commit()
    return resume


def test_cover_letter_drops_invented_numbers_and_is_saved(client, user_session, letter_setup, monkeypatch):
    calls = []

    def fake_post(model, body, timeout):
        calls.append(body)
        return _letter_answer()
    monkeypatch.setattr(gemini, '_post', fake_post)

    url = f'/resumes/{letter_setup.id}/cover-letter'
    assert client.post(url, headers=user_session, json={'jd_text': 'too short'}).status_code == 400
    body = client.post(url, headers=user_session, json={'jd_text': JD}).get_json()
    letter = body['letter']
    assert letter['dropped'] == 1 and not any('45%' in p for p in letter['paragraphs'])
    assert 'built payment services' in letter['paragraphs'][1].lower()
    assert body['text'].startswith('Dear Hiring Manager,') and body['text'].endswith('[Your name]')
    assert 'Test User' not in calls[0]['contents'][0]['parts'][0]['text']

    again = client.post(url, headers=user_session, json={'jd_text': JD}).get_json()
    assert again['cached'] is True and len(calls) == 1


def test_gemini_failures_reach_the_error_log(client, user_session, letter_setup, monkeypatch):
    import urllib.error

    def fail(model, body, timeout):
        raise urllib.error.HTTPError('https://example.com', 500, 'error', {}, None)
    monkeypatch.setattr(gemini, '_post', fail)
    response = client.post(f'/resumes/{letter_setup.id}/cover-letter', headers=user_session, json={'jd_text': JD})
    assert response.status_code == 503
    logged = ErrorLog.query.filter_by(kind='service', source='gemini').one()
    assert logged.message.startswith('Cover letter:')
