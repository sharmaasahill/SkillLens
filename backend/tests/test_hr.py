import pytest
from sqlalchemy import event

from skilllens.extensions import db

from .conftest import add_resume, create_user, login


@pytest.fixture
def hr_session(client):
    create_user('hr@example.com', is_admin=True, full_name='HR')
    return login(client, 'hr@example.com', account_type='hr')


def _seed_candidates(count):
    for i in range(count):
        user = create_user(f'cand{i}@example.com', full_name=f'Candidate {i:02d}',
                           current_work='Data Analyst' if i % 2 else 'Software Engineer',
                           current_location='Pune', total_experience=i)
        add_resume(user, score=40 + i, skills=['Python', f'Skill{i}'], primary=False)
        add_resume(user, score=50 + i, skills=['SQL'], primary=True)


def test_hr_routes_reject_regular_users(client, user_session):
    for path in ['/hr/all-users', '/hr/stats', '/hr/analytics', '/hr/skills', '/hr/user/1']:
        assert client.get(path).status_code == 403, path


def test_candidates_are_paginated(client, hr_session):
    _seed_candidates(15)
    first = client.get('/hr/all-users?per_page=10&page=1').get_json()
    second = client.get('/hr/all-users?per_page=10&page=2').get_json()
    assert first['total_users'] == 15 and first['pages'] == 2
    assert len(first['users']) == 10 and len(second['users']) == 5
    ids = {u['id'] for u in first['users']} | {u['id'] for u in second['users']}
    assert len(ids) == 15


def test_aggregates_use_primary_resume(client, hr_session):
    _seed_candidates(3)
    users = client.get('/hr/all-users?sort=name').get_json()['users']
    first = users[0]
    assert first['full_name'] == 'Candidate 00'
    assert first['resume_count'] == 2
    assert first['latest_score'] == 50  # the primary resume's score, not the other one
    assert set(first['all_skills']) == {'Python', 'Skill0', 'SQL'}


def test_filters_search_and_sort(client, hr_session):
    _seed_candidates(10)
    analysts = client.get('/hr/all-users?job_role=analyst').get_json()
    assert analysts['total_users'] == 5

    high = client.get('/hr/all-users?min_score=57&sort=score').get_json()['users']
    assert [u['latest_score'] for u in high] == [59, 58, 57]

    found = client.get('/hr/all-users?search=candidate 07').get_json()['users']
    assert [u['full_name'] for u in found] == ['Candidate 07']

    # LIKE wildcards in user input are treated literally
    assert client.get('/hr/all-users?search=%25').get_json()['total_users'] == 0


def test_blank_and_invalid_query_params(client, hr_session):
    assert client.get('/hr/all-users?job_role=&page=&min_score=').status_code == 200
    assert client.get('/hr/all-users?per_page=1000').status_code == 400


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


def test_candidate_list_query_count_does_not_grow_with_users(app, client, hr_session):
    _seed_candidates(3)
    small = _count_queries(app, lambda: client.get('/hr/all-users?per_page=50'))
    _seed_candidates_more = [create_user(f'extra{i}@example.com') for i in range(25)]
    for user in _seed_candidates_more:
        add_resume(user, score=60)
    large = _count_queries(app, lambda: client.get('/hr/all-users?per_page=50'))
    assert large == small


def test_stats_and_analytics(client, hr_session):
    _seed_candidates(4)
    stats = client.get('/hr/stats').get_json()
    assert stats['total_users'] == 4 and stats['total_resumes'] == 8

    analytics = client.get('/hr/analytics').get_json()
    assert analytics['total_candidates'] == 4
    assert analytics['experience_distribution'] == {'0-2': 2, '3-5': 1, '6-10': 0, '10+': 0}
    assert sum(analytics['score_distribution'].values()) == 8
    assert client.get('/hr/job-roles').get_json()['job_roles'] == ['Data Analyst', 'Software Engineer']


def _ids(client, view='active'):
    return {u['id'] for u in client.get(f'/hr/all-users?view={view}').get_json()['users']}


def test_hr_can_mark_note_and_remove_without_deleting(app, client, hr_session, make_client):
    from models.database import User

    cand = create_user('cand@example.com', full_name='Cand')
    r = client.patch(f'/hr/candidates/{cand.id}/review', headers=hr_session, json={'status': 'shortlisted', 'note': 'Strong SQL'})
    assert r.get_json()['review']['status'] == 'shortlisted'
    assert client.get('/hr/all-users?status=shortlisted').get_json()['total_users'] == 1
    assert client.get('/hr/stats').get_json()['status_counts'] == {'shortlisted': 1}

    client.post(f'/hr/candidates/{cand.id}/remove', headers=hr_session)
    assert cand.id not in _ids(client) and cand.id in _ids(client, 'removed')
    assert db.session.get(User, cand.id) is not None  # the account itself is untouched

    # The candidate uses SkillLens again, so they come back on their own
    candidate = make_client()
    headers = login(candidate, 'cand@example.com')
    assert candidate.post('/predict', headers=headers,
                          json={'job_title': 'Data Analyst', 'years_of_experience': 2}).status_code == 200
    users = client.get('/hr/all-users').get_json()['users']
    back = next(u for u in users if u['id'] == cand.id)
    assert back['review']['returned'] and back['review']['status'] == 'shortlisted'

    client.post('/hr/candidates/bulk', headers=hr_session, json={'user_ids': [cand.id], 'action': 'remove'})
    client.post('/hr/candidates/bulk', headers=hr_session, json={'user_ids': [cand.id], 'action': 'restore'})
    assert cand.id in _ids(client)


def test_candidate_and_hr_accounts_stay_separate(client, hr_session):
    # HR cannot use candidate tools...
    assert client.post('/predict', headers=hr_session, json={'job_title': 'Analyst', 'years_of_experience': 1}).status_code == 403
    assert client.get('/resume-history').status_code == 403
    assert client.get('/profile').status_code == 403
    # ...and HR cannot review another HR account as a candidate
    hr2 = create_user('hr2@example.com', is_admin=True)
    assert client.post(f'/hr/candidates/{hr2.id}/remove', headers=hr_session).status_code == 404
