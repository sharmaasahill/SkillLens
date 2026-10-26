import json
import urllib.error

import pytest

from models.database import AiResult, User
from skilllens.services import ai_review, gemini

from .conftest import add_resume

RESUME = """Test User
+91 98765 43210 | test.user@example.com | linkedin.com/in/test-user
Experience
Acme | Engineer 2022 - Present
Worked on payment services and fixed production issues.
Built a dashboard for the sales team that cut reporting time by 30%.
"""
JD = ('Backend Engineer\nRequirements\n- 3+ years building payment services in Python\n'
      '- Experience with production support and on-call\nNice to have\n- Kafka and Kubernetes\n')


def _answer(extra=None):
    review = {
        'recruiter_view': {'headline': 'An engineer who works on payments.', 'points': ['Payments', 'Dashboards', 'Support'],
                           'best_fit_roles': ['Backend Engineer']},
        'strengths': ['Payments work', 'Reporting impact', 'Production support'],
        'bullets': [
            # Real bullet, honest rewrite with a placeholder: kept
            {'original': 'Worked on payment services and fixed production issues.', 'problems': ['weak verb', 'no number'],
             'rewrite': 'Maintained payment services and resolved [N] production issues, cutting failures by [X%].',
             'why': 'Shows ownership and gives a result.'},
            # Invents a number the bullet never had: dropped
            {'original': 'Built a dashboard for the sales team that cut reporting time by 30%.', 'problems': ['vague'],
             'rewrite': 'Built a sales dashboard used by 200 people that cut reporting time by 30%.', 'why': 'More specific.'},
            # Not in the resume at all: dropped
            {'original': 'Led a team of twelve engineers across three countries.', 'problems': ['vague'],
             'rewrite': 'Led [N] engineers.', 'why': 'Clearer.'},
        ],
        'interview_questions': [{'question': 'How did you find the production issues?', 'about': 'Acme'}],
    }
    review.update(extra or {})
    return {'candidates': [{'finishReason': 'STOP', 'content': {'parts': [
        {'text': 'thinking...', 'thought': True}, {'text': json.dumps(review)}]}}]}


@pytest.fixture
def ai_on(app):
    app.config.update(GEMINI_API_KEY='test-key', GEMINI_MODELS=['model-a', 'model-b'], AI_DAILY_LIMIT=5, AI_USER_DAILY_LIMIT=2)


@pytest.fixture
def resume(client, user_session):
    user = User.query.filter_by(email='user@example.com').first()
    item = add_resume(user, score=60)
    item.raw_text = RESUME
    from skilllens.extensions import db
    db.session.commit()
    return item


@pytest.fixture(autouse=True)
def no_cool_down():
    gemini._cooling.clear()
    yield
    gemini._cooling.clear()


def _fake_post(calls, answers):
    def fake(model, body, timeout):
        calls.append((model, body))
        answer = answers.pop(0)
        if isinstance(answer, Exception):
            raise answer
        return answer
    return fake


def _http(code):
    return urllib.error.HTTPError('https://example.com', code, 'error', {}, None)


def test_ai_review_is_off_without_a_key(client, user_session, resume):
    assert client.get('/ai/status', headers=user_session).get_json() == {'enabled': False}
    assert client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={}).status_code == 404


def test_personal_details_never_leave_the_server(client, user_session, resume, ai_on, monkeypatch):
    calls = []
    monkeypatch.setattr(gemini, '_post', _fake_post(calls, [_answer()]))
    body = client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={}).get_json()
    sent = calls[0][1]['contents'][0]['parts'][0]['text']
    for secret in ('Test User', 'Test', '98765', 'test.user@example.com', 'linkedin.com/in/test-user'):
        assert secret not in sent
    assert '[Candidate]' in sent and '[phone]' in sent and '[email]' in sent and '[link]' in sent
    assert body['removed'] == {'name': body['removed']['name'], 'email': 1, 'phone': 1, 'link': 1}


def test_answers_are_checked_against_the_resume(client, user_session, resume, ai_on, monkeypatch):
    monkeypatch.setattr(gemini, '_post', _fake_post([], [_answer()]))
    review = client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={}).get_json()['review']
    # Only the honest rewrite survives: one bullet invented "200 people", one was never in the resume
    assert [b['original'] for b in review['bullets']] == ['Worked on payment services and fixed production issues.']
    assert review['dropped'] == 2
    assert review['recruiter_view']['best_fit_roles'] == ['Backend Engineer']
    assert 'thinking' not in json.dumps(review)  # the model's private reasoning is never shown


def test_jd_requirements_need_real_quotes(client, user_session, resume, ai_on, monkeypatch):
    jd = {'jd': {'fit_summary': 'Partly fits.', 'requirements': [
        {'requirement': 'Payment services', 'status': 'covered', 'evidence': 'Worked on payment services', 'suggestion': ''},
        {'requirement': 'On-call support', 'status': 'covered', 'evidence': 'Ran on-call for 2 years', 'suggestion': ''},
        {'requirement': 'Kafka', 'status': 'missing', 'evidence': '', 'suggestion': 'Add Kafka if you used it.'},
    ]}}
    calls = []
    monkeypatch.setattr(gemini, '_post', _fake_post(calls, [_answer(jd)]))
    body = client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={'jd_text': JD}).get_json()
    assert 'JOB DESCRIPTION' in calls[0][1]['contents'][0]['parts'][0]['text']
    reqs = {r['requirement']: r for r in body['review']['jd']['requirements']}
    assert reqs['Payment services']['status'] == 'covered'
    # "Ran on-call for 2 years" is not in the resume, so it is not proof
    assert reqs['On-call support']['status'] == 'partial' and reqs['On-call support']['evidence'] == ''
    assert reqs['Kafka']['status'] == 'missing'


def test_repeats_are_free_and_daily_limits_hold(client, user_session, resume, ai_on, monkeypatch):
    calls = []
    monkeypatch.setattr(gemini, '_post', _fake_post(calls, [_answer(), _answer()]))
    first = client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={}).get_json()
    again = client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={}).get_json()
    assert not first['cached'] and again['cached'] and len(calls) == 1
    assert again['review'] == first['review'] and again['ai']['remaining_today'] == 1

    # A different job description is a new question, and the per-user limit (2 a day) stops the third
    client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={'jd_text': JD})
    blocked = client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={'jd_text': JD + '\nGo too'})
    assert blocked.status_code == 429 and len(calls) == 2


def test_busy_models_fall_back_and_failures_do_not_cost_a_review(client, user_session, resume, ai_on, monkeypatch):
    calls = []
    monkeypatch.setattr(gemini, '_post', _fake_post(calls, [_http(503), _answer()]))
    body = client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={}).get_json()
    assert [c[0] for c in calls] == ['model-a', 'model-b'] and body['model'] == 'model-b'

    # The busy model is skipped for a while, so the next review goes straight to the one that answered
    AiResult.query.delete()
    calls.clear()
    monkeypatch.setattr(gemini, '_post', _fake_post(calls, [_answer()]))
    client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={})
    assert [c[0] for c in calls] == ['model-b']

    AiResult.query.delete()
    gemini._cooling.clear()
    client.application.config['AI_USER_DAILY_LIMIT'] = 3
    monkeypatch.setattr(gemini, '_post', _fake_post([], [_http(503), TimeoutError('slow')]))
    failed = client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={})
    assert failed.status_code == 503 and 'busy' in failed.get_json()['error']
    # The failed attempt was given back: 3 a day, 2 used by the reviews that worked, so 1 is left
    assert client.get('/ai/status', headers=user_session).get_json()['remaining_today'] == 1


def test_out_of_free_quota_says_so(client, user_session, resume, ai_on, monkeypatch):
    monkeypatch.setattr(gemini, '_post', _fake_post([], [_http(429), _http(429)]))
    response = client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={})
    assert response.status_code == 429 and 'quota' in response.get_json()['error']


def test_ai_results_go_when_the_resume_is_deleted(client, user_session, resume, ai_on, monkeypatch):
    monkeypatch.setattr(gemini, '_post', _fake_post([], [_answer()]))
    client.post(f'/resumes/{resume.id}/ai-review', headers=user_session, json={})
    assert AiResult.query.count() == 1
    assert client.delete(f'/resume-history/{resume.id}', headers=user_session).status_code == 200
    assert AiResult.query.count() == 0


def test_redaction_keeps_years_and_handles_missing_names():
    text, removed = ai_review.redact('Priya Nair\nAcme 2019 - 2021, call 9876543210', None)
    assert '2019 - 2021' in text and '[phone]' in text and '[Candidate]' in text
    assert removed == {'phone': 1, 'name': removed['name']}
