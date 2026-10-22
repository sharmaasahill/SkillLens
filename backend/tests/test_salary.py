import pytest

from skilllens.services import ml

VALID = {'job_title': 'Data Scientist', 'years_of_experience': 5, 'city': 'Bengaluru',
         'skills': ['Python', 'SQL', 'Machine Learning']}


def test_predict_requires_login(client):
    assert client.post('/predict', json=VALID).status_code == 401


@pytest.mark.parametrize('field,value', [
    ('job_title', ''), ('years_of_experience', -1), ('years_of_experience', 41), ('work_mode', 'Moon base'),
])
def test_predict_validates_input(client, user_session, field, value):
    response = client.post('/predict', headers=user_session, json={**VALID, field: value})
    assert response.status_code == 400
    assert response.get_json()['details'][0]['field'] == field


def test_models_are_loaded_once_and_reused(client, user_session, monkeypatch):
    created = []

    class FakePredictor:
        def __init__(self):
            created.append(self)

        def predict_quick(self, data):
            return {'predicted_salary': 1_000_000, 'salary_range': {'min': 900_000, 'max': 1_100_000},
                    'top_influential_factors': []}

    ml.reset()
    monkeypatch.setattr('models.salary_model.IndiaSalaryPredictor', FakePredictor)
    for _ in range(3):
        assert client.post('/predict', headers=user_session, json=VALID).status_code == 200
    ml.reset()
    assert len(created) == 1


def test_estimates_are_in_rupees_and_plausible(client, user_session):
    quick = client.post('/predict', headers=user_session, json=VALID).get_json()
    assert quick['currency'] == 'INR'
    # A data scientist with 5 years in Bengaluru earns lakhs per year, not tens of thousands
    assert 800_000 <= quick['predicted_salary'] <= 4_000_000
    assert quick['salary_range']['min'] <= quick['predicted_salary'] <= quick['salary_range']['max']
    assert {f['factor'] for f in quick['top_influential_factors']} == {'Job title', 'Experience', 'City and work mode', 'Skills'}


def test_experience_and_city_move_the_estimate(client, user_session):
    def salary(**changes):
        body = {**VALID, **changes}
        return client.post('/predict', headers=user_session, json=body).get_json()['predicted_salary']

    assert salary(years_of_experience=10) > salary(years_of_experience=1)
    assert salary(city='Bengaluru') > salary(city='Jaipur')


def test_compare_returns_both_estimates(client, user_session):
    compared = client.post('/compare-predictions', headers=user_session, json=VALID).get_json()
    advanced = compared['advanced_model']
    assert advanced['salary_range']['min'] <= advanced['predicted_salary'] <= advanced['salary_range']['max']
    assert advanced['confidence_interval']['lower'] <= advanced['salary_range']['min']
    assert 50 <= advanced['prediction_confidence'] <= 95
    assert compared['comparison']['higher_prediction'] in {'advanced', 'basic', 'equal'}


def test_unknown_title_and_city_still_get_an_estimate(client, user_session):
    response = client.post('/predict', headers=user_session,
                           json={'job_title': 'Quantum Plumber', 'years_of_experience': 3, 'city': 'Atlantis'})
    assert response.status_code == 200
    assert response.get_json()['predicted_salary'] > 0


def test_options_and_model_info(client, user_session):
    options = client.get('/salary-options').get_json()
    assert 'Bengaluru' in options['cities'] and 'Remote' in options['cities']
    assert options['work_modes'] == ['On-site', 'Hybrid', 'Remote']

    info = client.get('/model-info').get_json()
    assert info['metrics']['test_split'].startswith('held-out companies')
    assert info['metrics']['trained_on_rows'] > 20_000
