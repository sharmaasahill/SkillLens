from datetime import date, timedelta

from models.database import ProfileHistory, User

from .conftest import create_user, login

STRONG = 'mango-river-lamp-7'


def _years_ago(years, days=0):
    today = date.today()
    try:
        born = today.replace(year=today.year - years)
    except ValueError:  # 29 February
        born = today.replace(year=today.year - years, day=28)
    return (born + timedelta(days=days)).isoformat()


def test_profile_update_validates_input(client, user_session):
    response = client.put('/update-profile', headers=user_session, json={
        'date_of_birth': _years_ago(12), 'linkedin_url': 'javascript:alert(1)', 'phone_number': 'call me'})
    assert response.status_code == 400
    fields = {d['field'] for d in response.get_json()['details']}
    assert fields == {'date_of_birth', 'linkedin_url', 'phone_number'}


def test_profile_update_saves_and_records_history(client, user_session):
    response = client.put('/update-profile', headers=user_session, json={
        'current_work': 'Data Analyst', 'date_of_birth': _years_ago(29), 'total_experience': 4.5,
        'linkedin_url': 'https://linkedin.com/in/test'})
    assert response.status_code == 200
    profile = client.get('/profile').get_json()
    assert profile['current_work'] == 'Data Analyst'
    assert profile['date_of_birth'] == _years_ago(29) and profile['age'] == 29
    assert profile['total_experience'] == 4.5
    assert ProfileHistory.query.count() == 1
    assert client.get('/profile/history').get_json()['history'][0]['date_of_birth'] is None


def test_blank_value_clears_a_field_and_missing_fields_are_untouched(client, user_session):
    client.put('/update-profile', headers=user_session, json={'bio': 'Hello', 'education': 'B.Tech', 'date_of_birth': _years_ago(30)})
    client.put('/update-profile', headers=user_session, json={'bio': '  ', 'date_of_birth': ''})
    profile = client.get('/profile').get_json()
    assert profile['bio'] is None
    assert profile['education'] == 'B.Tech'
    assert profile['full_name'] == 'Test User'
    assert profile['date_of_birth'] == _years_ago(30)  # a date of birth is never removed


def test_date_of_birth_is_checked(client, user_session):
    for born, message in [(_years_ago(18, days=1), '18 or older'), ((date.today() + timedelta(days=3)).isoformat(), 'in the past'),
                          (_years_ago(120), 'year of birth'), ('31-12-1990', 'date')]:
        response = client.put('/update-profile', headers=user_session, json={'date_of_birth': born})
        assert response.status_code == 400, born
        assert message in response.get_json()['details'][0]['message'], born
    assert client.put('/update-profile', headers=user_session, json={'date_of_birth': _years_ago(18)}).status_code == 200


def test_sign_up_needs_a_date_of_birth(client):
    body = {'email': 'new@example.com', 'password': STRONG, 'full_name': 'New Person', 'accept_privacy': True}
    missing = client.post('/auth/register', json=body)
    assert missing.status_code == 400 and missing.get_json()['details'][0]['field'] == 'date_of_birth'
    young = client.post('/auth/register', json={**body, 'date_of_birth': _years_ago(16)})
    assert young.status_code == 400 and '18 or older' in young.get_json()['details'][0]['message']
    made = client.post('/auth/register', json={**body, 'date_of_birth': '1997-03-09'})
    assert made.status_code == 201 and made.get_json()['user']['needs_date_of_birth'] is False
    assert User.query.filter_by(email='new@example.com').one().date_of_birth == date(1997, 3, 9)


def test_accounts_without_a_date_of_birth_are_asked_for_one(client):
    create_user('old@example.com', full_name='Old Account')  # made before date of birth was asked
    headers = login(client, 'old@example.com')
    assert client.get('/auth/me').get_json()['user']['needs_date_of_birth'] is True
    client.put('/update-profile', headers=headers, json={'date_of_birth': '1995-01-20'})
    assert client.get('/auth/me').get_json()['user']['needs_date_of_birth'] is False
