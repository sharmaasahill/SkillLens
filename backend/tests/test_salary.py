import pytest

from skilllens.services import ml

VALID = {'age': 30, 'gender': 'Male', 'education_level': "Bachelor's",
         'job_title': 'Software Engineer', 'years_of_experience': 5}


def test_predict_requires_login(client):
    assert client.post('/predict', json=VALID).status_code == 401


@pytest.mark.parametrize('field,value', [
    ('gender', 'Robot'), ('age', 5), ('education_level', 'Kindergarten'), ('years_of_experience', -1),
])
def test_predict_validates_input(client, user_session, field, value):
    response = client.post('/predict', headers=user_session, json={**VALID, field: value})
    assert response.status_code == 400
    assert response.get_json()['details'][0]['field'] == field


def test_experience_cannot_exceed_age(client, user_session):
    response = client.post('/predict', headers=user_session, json={**VALID, 'age': 20, 'years_of_experience': 15})
    assert response.status_code == 400


def test_models_are_loaded_once_and_reused(client, user_session, monkeypatch):
    created = []

    class FakePredictor:
        def __init__(self):
            created.append(self)

        def predict(self, data):
            return {'predicted_salary': 100000, 'salary_range': {'min': 90000, 'max': 110000}}

    ml.reset()
    monkeypatch.setattr('models.salary_predictor.SalaryPredictor', FakePredictor)
    for _ in range(3):
        assert client.post('/predict', headers=user_session, json=VALID).status_code == 200
    ml.reset()
    assert len(created) == 1


def test_real_models_predict_and_compare(client, user_session):
    basic = client.post('/predict', headers=user_session, json=VALID).get_json()
    assert basic['predicted_salary'] > 0

    compared = client.post('/compare-predictions', headers=user_session, json=VALID).get_json()
    advanced = compared['advanced_model']
    assert advanced['salary_range']['min'] <= advanced['predicted_salary'] <= advanced['salary_range']['max']
    assert compared['comparison']['higher_prediction'] in {'advanced', 'basic', 'equal'}


def test_unseen_job_title_does_not_change_the_shared_encoder(client, user_session):
    model = ml.basic_salary_model()
    before = len(model.label_encoders['Job Title'].classes_)
    response = client.post('/predict', headers=user_session, json={**VALID, 'job_title': 'Quantum Plumber'})
    assert response.status_code == 200
    assert len(model.label_encoders['Job Title'].classes_) == before
