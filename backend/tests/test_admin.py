import pytest
from sqlalchemy import event

from skilllens.config import TestingConfig
from skilllens.extensions import db

from .conftest import add_resume, create_user, login

API = '/api/admin'


@pytest.fixture
def admin_session(client):
    # The admin account is created by its first sign-in
    return login(client, TestingConfig.ADMIN_EMAIL, TestingConfig.ADMIN_PASSWORD)


def _seed_users(count):
    for i in range(count):
        user = create_user(f'user{i}@example.com', full_name=f'User {i:02d}',
                           current_work='Data Analyst' if i % 2 else 'Software Engineer',
                           current_location='Pune', total_experience=i)
        add_resume(user, score=40 + i, skills=['Python', f'Skill{i}'], primary=False)
        add_resume(user, score=50 + i, skills=['SQL'], primary=True)


def test_admin_routes_reject_regular_users(client, user_session):
    for path in ['/users', '/stats', '/analytics', '/skills', '/users/1', '/users/1/resume']:
        assert client.get(API + path).status_code == 403, path


def test_admin_routes_need_sign_in(client):
    assert client.get(f'{API}/users').status_code == 401


def test_users_are_paginated(client, admin_session):
    _seed_users(15)
    first = client.get(f'{API}/users?per_page=10&page=1').get_json()
    second = client.get(f'{API}/users?per_page=10&page=2').get_json()
    assert first['total_users'] == 15 and first['pages'] == 2
    assert len(first['users']) == 10 and len(second['users']) == 5
    ids = {u['id'] for u in first['users']} | {u['id'] for u in second['users']}
    assert len(ids) == 15


def test_admin_account_is_never_listed(client, admin_session):
    _seed_users(2)
    emails = {u['email'] for u in client.get(f'{API}/users').get_json()['users']}
    assert TestingConfig.ADMIN_EMAIL not in emails and len(emails) == 2
    assert client.get(f'{API}/stats').get_json()['total_users'] == 2


def test_aggregates_use_primary_resume(client, admin_session):
    _seed_users(3)
    users = client.get(f'{API}/users?sort=name').get_json()['users']
    first = users[0]
    assert first['full_name'] == 'User 00'
    assert first['resume_count'] == 2
    assert first['latest_score'] == 50  # the primary resume's score, not the other one
    assert set(first['all_skills']) == {'Python', 'Skill0', 'SQL'}


def test_filters_search_and_sort(client, admin_session):
    _seed_users(10)
    analysts = client.get(f'{API}/users?job_role=analyst').get_json()
    assert analysts['total_users'] == 5

    high = client.get(f'{API}/users?min_score=57&sort=score').get_json()['users']
    assert [u['latest_score'] for u in high] == [59, 58, 57]

    found = client.get(f'{API}/users?search=user 07').get_json()['users']
    assert [u['full_name'] for u in found] == ['User 07']

    # LIKE wildcards in user input are treated literally
    assert client.get(f'{API}/users?search=%25').get_json()['total_users'] == 0


def test_blank_and_invalid_query_params(client, admin_session):
    assert client.get(f'{API}/users?job_role=&page=&min_score=').status_code == 200
    assert client.get(f'{API}/users?per_page=1000').status_code == 400


def _count_queries(app, fn):
    statements = []

    def before(conn, cursor, statement, *args):
        statements.append(statement)

    engine = db.engine
    event.listen(engine, 'before_cursor_execute', before)
    try:
        fn()
    finally:
        event.remove(engine, 'before_cursor_execute', before)
    return len(statements)


def test_user_list_query_count_does_not_grow_with_users(app, client, admin_session):
    _seed_users(3)
    small = _count_queries(app, lambda: client.get(f'{API}/users?per_page=50'))
    for user in [create_user(f'extra{i}@example.com') for i in range(25)]:
        add_resume(user, score=60)
    large = _count_queries(app, lambda: client.get(f'{API}/users?per_page=50'))
    assert large == small


def test_stats_and_analytics(client, admin_session):
    _seed_users(4)
    stats = client.get(f'{API}/stats').get_json()
    assert stats['total_users'] == 4 and stats['total_resumes'] == 8

    analytics = client.get(f'{API}/analytics').get_json()
    assert analytics['total_users'] == 4
    assert analytics['experience_distribution'] == {'0-2': 2, '3-5': 1, '6-10': 0, '10+': 0}
    assert sum(analytics['score_distribution'].values()) == 8
    assert client.get(f'{API}/job-roles').get_json()['job_roles'] == ['Data Analyst', 'Software Engineer']


def _ids(client, view='active'):
    return {u['id'] for u in client.get(f'{API}/users?view={view}').get_json()['users']}


def test_admin_can_mark_note_and_remove_without_deleting(app, client, admin_session, make_client):
    from models.database import User

    member = create_user('member@example.com', full_name='Member')
    r = client.patch(f'{API}/users/{member.id}/review', headers=admin_session, json={'status': 'shortlisted', 'note': 'Strong SQL'})
    assert r.get_json()['review']['status'] == 'shortlisted'
    assert client.get(f'{API}/users?status=shortlisted').get_json()['total_users'] == 1
    assert client.get(f'{API}/stats').get_json()['status_counts'] == {'shortlisted': 1}

    client.post(f'{API}/users/{member.id}/remove', headers=admin_session)
    assert member.id not in _ids(client) and member.id in _ids(client, 'removed')
    assert db.session.get(User, member.id) is not None  # the account itself is untouched

    # The user uses SkillLens again, so they come back on their own
    browser = make_client()
    headers = login(browser, 'member@example.com')
    assert browser.post('/predict', headers=headers,
                        json={'job_title': 'Data Analyst', 'years_of_experience': 2}).status_code == 200
    users = client.get(f'{API}/users').get_json()['users']
    back = next(u for u in users if u['id'] == member.id)
    assert back['review']['returned'] and back['review']['status'] == 'shortlisted'

    client.post(f'{API}/users/bulk', headers=admin_session, json={'user_ids': [member.id], 'action': 'remove'})
    restored = client.post(f'{API}/users/bulk', headers=admin_session, json={'user_ids': [member.id], 'action': 'restore'})
    assert restored.get_json()['users'][0]['id'] == member.id
    assert member.id in _ids(client)


def test_admin_and_user_tools_stay_separate(client, admin_session):
    # The admin cannot use user tools...
    assert client.post('/predict', headers=admin_session, json={'job_title': 'Analyst', 'years_of_experience': 1}).status_code == 403
    assert client.get('/resume-history').status_code == 403
    assert client.get('/profile').status_code == 403
    # ...and an admin account is never listed or reviewed as a user
    other_admin = create_user('old-admin@example.com', is_admin=True)
    assert client.post(f'{API}/users/{other_admin.id}/remove', headers=admin_session).status_code == 404
