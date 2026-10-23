import io
import os

from models.database import Resume
from skilllens.extensions import db

from .conftest import PDF_BYTES, create_user, login


def _upload(client, headers, name='Resume.pdf', content=PDF_BYTES):
    return client.post('/upload-resume', headers=headers,
                       data={'file': (io.BytesIO(content), name)}, content_type='multipart/form-data')


def _stored_path(app, resume_id):
    resume = db.session.get(Resume, resume_id)
    return os.path.join(app.config['UPLOAD_FOLDER'], resume.stored_filename)


def test_same_filename_from_two_users_does_not_collide(app, make_client, fake_analysis):
    create_user('alice@example.com')
    create_user('bob@example.com')
    alice, bob = make_client(), make_client()
    alice_headers, bob_headers = login(alice, 'alice@example.com'), login(bob, 'bob@example.com')

    a = _upload(alice, alice_headers)
    b = _upload(bob, bob_headers)
    assert a.status_code == b.status_code == 200

    path_a, path_b = _stored_path(app, a.get_json()['id']), _stored_path(app, b.get_json()['id'])
    assert path_a != path_b
    assert os.path.exists(path_a) and os.path.exists(path_b)
    assert a.get_json()['filename'] == b.get_json()['filename'] == 'Resume.pdf'

    # Alice deleting her resume must not touch Bob's file
    assert alice.delete(f"/resume-history/{a.get_json()['id']}", headers=alice_headers).status_code == 200
    assert not os.path.exists(path_a)
    assert os.path.exists(path_b)


def test_cannot_delete_another_users_resume(app, make_client, fake_analysis):
    create_user('alice@example.com')
    create_user('bob@example.com')
    alice, bob = make_client(), make_client()
    alice_headers, bob_headers = login(alice, 'alice@example.com'), login(bob, 'bob@example.com')

    resume_id = _upload(alice, alice_headers).get_json()['id']
    assert bob.delete(f'/resume-history/{resume_id}', headers=bob_headers).status_code == 404
    assert os.path.exists(_stored_path(app, resume_id))


def test_rejects_non_pdf_uploads(client, user_session, fake_analysis):
    assert _upload(client, user_session, name='notes.txt').status_code == 400
    fake_pdf = _upload(client, user_session, name='fake.pdf', content=b'not really a pdf')
    assert fake_pdf.status_code == 400
    assert fake_pdf.get_json()['error'] == 'File is not a valid PDF'


def test_history_lists_only_own_resumes(client, user_session, fake_analysis):
    _upload(client, user_session, name='one.pdf')
    _upload(client, user_session, name='two.pdf')
    resumes = client.get('/resume-history').get_json()['resumes']
    assert [r['filename'] for r in resumes] == ['two.pdf', 'one.pdf']
    assert resumes[0]['score'] == 72 and resumes[0]['skills'] == ['Python', 'SQL']


def test_failed_analysis_removes_the_saved_file(app, client, user_session, monkeypatch):
    def broken(path):
        raise ValueError('Failed to analyze resume: no text')
    monkeypatch.setattr('skilllens.services.resumes.extract_skills_from_resume', broken)

    response = _upload(client, user_session)
    assert response.status_code == 400
    user_dir = os.path.join(app.config['UPLOAD_FOLDER'], 'users')
    leftover = [f for _, _, files in os.walk(user_dir) for f in files] if os.path.exists(user_dir) else []
    assert leftover == []


def test_profile_resume_upload_and_download(client, user_session, fake_analysis):
    response = client.post('/profile/upload-resume', headers=user_session,
                           data={'file': (io.BytesIO(PDF_BYTES), 'CV.pdf')}, content_type='multipart/form-data')
    assert response.status_code == 200
    assert response.get_json()['skills_summary'] == 'Python, SQL'

    download = client.get('/profile/download-resume')
    assert download.status_code == 200
    assert download.data == PDF_BYTES


def test_library_holds_five_resumes_with_one_primary(client, user_session, fake_analysis):
    ids = [_upload(client, user_session, name=f'cv{i}.pdf').get_json()['id'] for i in range(5)]
    history = client.get('/resume-history').get_json()
    assert history['max_resumes'] == 5
    assert history['primary_id'] == ids[0]  # the first upload becomes primary
    assert [r['is_primary'] for r in history['resumes']].count(True) == 1

    sixth = _upload(client, user_session, name='cv5.pdf')
    assert sixth.status_code == 409 and 'up to 5' in sixth.get_json()['error']

    # Choose another primary; the profile resume HR sees follows it
    assert client.put(f'/resumes/{ids[3]}/primary', headers=user_session).status_code == 200
    assert client.get('/resume-history').get_json()['primary_id'] == ids[3]
    assert client.get('/profile').get_json()['profile_resume_filename'] == 'cv3.pdf'

    # Deleting the primary hands it to the newest remaining resume
    client.delete(f'/resume-history/{ids[3]}', headers=user_session)
    history = client.get('/resume-history').get_json()
    assert history['primary_id'] == ids[4] and len(history['resumes']) == 4


def test_new_upload_becomes_primary_only_when_asked(client, user_session, fake_analysis):
    first = _upload(client, user_session, name='a.pdf').get_json()['id']
    second = client.post('/upload-resume', headers=user_session, content_type='multipart/form-data',
                         data={'file': (io.BytesIO(PDF_BYTES), 'b.pdf')}).get_json()
    assert client.get('/resume-history').get_json()['primary_id'] == first and not second['is_primary']
    third = client.post('/upload-resume', headers=user_session, content_type='multipart/form-data',
                        data={'file': (io.BytesIO(PDF_BYTES), 'c.pdf'), 'make_primary': 'true'}).get_json()
    assert third['is_primary'] and client.get('/resume-history').get_json()['primary_id'] == third['id']


def test_cannot_make_another_users_resume_primary(app, make_client, fake_analysis):
    owner, other = make_client(), make_client()
    create_user('owner@example.com')
    create_user('other@example.com')
    resume_id = _upload(owner, login(owner, 'owner@example.com'), name='mine.pdf').get_json()['id']
    response = other.put(f'/resumes/{resume_id}/primary', headers=login(other, 'other@example.com'))
    assert response.status_code == 404


def test_job_description_is_optional_and_adds_a_match_score(client, user_session):
    from .sample_resumes import STRONG
    user = __import__('models.database', fromlist=['User']).User.query.filter_by(email='user@example.com').first()
    resume = Resume(user_id=user.id, filename='ds.pdf', raw_text=STRONG, score=90, is_primary=True)
    resume.set_skills(['python'])
    db.session.add(resume)
    db.session.commit()

    plain = client.post(f'/resumes/{resume.id}/analyze', headers=user_session, json={}).get_json()
    assert plain['jd_match'] is None and plain['ats_analysis']['score'] > 0

    jd = ('Senior Data Scientist\nRequirements\n- 5+ years of experience in machine learning\n'
          '- Must have Python, SQL and scikit-learn\n- Experience deploying models on AWS\n'
          "- Bachelor's degree in Computer Science\nNice to have\n- Kubernetes and Airflow\n")
    matched = client.post(f'/resumes/{resume.id}/analyze', headers=user_session, json={'jd_text': jd}).get_json()
    m = matched['jd_match']
    assert m['score'] >= 70 and m['job_title'] == 'Senior Data Scientist'
    assert {'Python', 'SQL', 'scikit-learn', 'AWS'} <= set(m['must_have']['matched'])
    assert 'Kubernetes' in m['nice_to_have']['matched'] and 'Apache Airflow' in m['nice_to_have']['missing']
    assert m['experience']['required']['min'] == 5
    assert matched['overall_score'] == round(0.4 * matched['ats_analysis']['score'] + 0.6 * m['score'], 1)

    upload = client.post(f'/resumes/{resume.id}/analyze', headers=user_session, content_type='multipart/form-data',
                         data={'jd_file': (io.BytesIO(jd.encode()), 'jd.txt')}).get_json()
    assert upload['jd_match']['score'] == m['score']

    too_short = client.post(f'/resumes/{resume.id}/analyze', headers=user_session, json={'jd_text': 'Python dev'})
    assert too_short.status_code == 400
