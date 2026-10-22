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
