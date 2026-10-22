from models.database import ProfileHistory


def test_profile_update_validates_input(client, user_session):
    response = client.put('/update-profile', headers=user_session, json={
        'age': 5, 'linkedin_url': 'javascript:alert(1)', 'phone_number': 'call me'})
    assert response.status_code == 400
    fields = {d['field'] for d in response.get_json()['details']}
    assert fields == {'age', 'linkedin_url', 'phone_number'}


def test_profile_update_saves_and_records_history(client, user_session):
    response = client.put('/update-profile', headers=user_session, json={
        'current_work': 'Data Analyst', 'age': '29', 'total_experience': 4.5,
        'linkedin_url': 'https://linkedin.com/in/test'})
    assert response.status_code == 200
    profile = client.get('/profile').get_json()
    assert profile['current_work'] == 'Data Analyst'
    assert profile['age'] == 29
    assert profile['total_experience'] == 4.5
    assert ProfileHistory.query.count() == 1


def test_blank_value_clears_a_field_and_missing_fields_are_untouched(client, user_session):
    client.put('/update-profile', headers=user_session, json={'bio': 'Hello', 'education': 'B.Tech'})
    client.put('/update-profile', headers=user_session, json={'bio': '  '})
    profile = client.get('/profile').get_json()
    assert profile['bio'] is None
    assert profile['education'] == 'B.Tech'
    assert profile['full_name'] == 'Test User'
