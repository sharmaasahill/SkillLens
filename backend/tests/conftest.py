import os
import sys

import pytest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from werkzeug.security import generate_password_hash  # noqa: E402

from models.database import Resume, User  # noqa: E402
from skilllens import create_app  # noqa: E402
from skilllens.config import TestingConfig  # noqa: E402
from skilllens.extensions import db  # noqa: E402

PDF_BYTES = b'%PDF-1.4\n% test file\n'
PASSWORD = 'password123'


@pytest.fixture
def app(tmp_path):
    app = create_app(TestingConfig, {'UPLOAD_FOLDER': str(tmp_path / 'uploads')})
    with app.app_context():
        db.create_all()
        yield app
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def make_client(app):
    """Extra clients, each with its own cookie jar (i.e. a separate browser)."""
    return app.test_client


def create_user(email, password=PASSWORD, is_admin=False, **fields):
    user = User(email=email, password=generate_password_hash(password, method='pbkdf2:sha256'),
                is_admin=is_admin, **fields)
    db.session.add(user)
    db.session.commit()
    return user


def add_resume(user, score, skills=('Python',), filename='resume.pdf', primary=None):
    if primary is None:
        primary = Resume.query.filter_by(user_id=user.id).count() == 0
    resume = Resume(user_id=user.id, filename=filename, score=score, raw_text='text', is_primary=primary)
    resume.set_skills(list(skills))
    db.session.add(resume)
    db.session.commit()
    return resume


def login(client, email, password=PASSWORD):
    """Log in and return headers carrying the CSRF token for write requests."""
    response = client.post('/auth/login', json={'email': email, 'password': password})
    assert response.status_code == 200, response.get_json()
    return {'X-CSRF-TOKEN': response.get_json()['csrf_access_token']}


@pytest.fixture
def user_session(client):
    create_user('user@example.com', full_name='Test User')
    return login(client, 'user@example.com')


@pytest.fixture
def fake_analysis(monkeypatch):
    """Skip real PDF parsing; return a fixed analysis."""
    def fake(path):
        assert os.path.exists(path)
        return {'skills': ['Python', 'SQL'], 'text': 'Python SQL developer',
                'ats_analysis': {'score': 72}}
    monkeypatch.setattr('skilllens.services.resumes.extract_skills_from_resume', fake)
    return fake
