from models.database import User

from .conftest import add_resume

JAVA_RESUME = """Backend Developer
Experience
Developed Spring Boot services in Java with Hibernate and REST APIs on AWS.
Skills
Languages: Java, SQL
"""


def _resume(skills=('Java', 'Spring Boot', 'Hibernate', 'REST APIs', 'AWS', 'SQL'), text=JAVA_RESUME):
    user = User.query.filter_by(email='user@example.com').first()
    resume = add_resume(user, score=70, skills=list(skills))
    resume.raw_text = text
    from skilllens.extensions import db
    db.session.commit()
    return user, resume


def test_market_fit_shows_what_postings_for_a_role_ask_for(client, user_session):
    _, resume = _resume()
    fit = client.post(f'/resumes/{resume.id}/market-fit', headers=user_session, json={'role': 'Java Developer'}).get_json()
    assert fit['postings'] > 500 and fit['companies'] > 100
    skills = {s['skill']: s for s in fit['skills']}
    # Java developer postings mostly ask for Java and Spring Boot, which this resume has
    assert skills['Java']['have'] and skills['Java']['share'] > 50
    assert skills['Spring Boot']['have']
    # ...and often for microservices, which it does not mention
    assert not skills['Microservices']['have']
    assert 0 < fit['coverage'] < 100
    assert fit['source']['licence'] == 'CC BY-NC-SA 4.0'


def test_market_fit_guesses_the_role_and_handles_unknown_roles(client, user_session):
    user, resume = _resume()
    guessed = client.post(f'/resumes/{resume.id}/market-fit', headers=user_session, json={}).get_json()
    assert guessed['guessed'] and guessed['role'] == 'Backend Developer'  # from the resume headline

    user.current_work = 'Java Developer'
    from skilllens.extensions import db
    db.session.commit()
    from_profile = client.post(f'/resumes/{resume.id}/market-fit', headers=user_session, json={}).get_json()
    assert from_profile['role'] == 'Java Developer'  # the profile wins over the guess

    unknown = client.post(f'/resumes/{resume.id}/market-fit', headers=user_session, json={'role': 'Quantum Plumber'}).get_json()
    assert unknown['skills'] == [] and unknown['coverage'] is None


def test_market_fit_is_private_and_titles_are_suggested(client, user_session, make_client):
    _, resume = _resume()
    from .conftest import create_user, login
    other = make_client()
    create_user('other@example.com')
    headers = login(other, 'other@example.com')
    assert other.post(f'/resumes/{resume.id}/market-fit', headers=headers, json={}).status_code == 404

    roles = client.get('/market/roles').get_json()['roles']
    assert 'Java Developer' in roles and len(roles) > 1000
    # The salary form still gets its job titles from the same postings
    assert 'Java Developer' in client.get('/salary-options').get_json()['job_titles']
