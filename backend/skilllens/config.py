"""Application settings, read from environment variables (see backend/.env.example)."""
import os
from datetime import timedelta

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _bool(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in ('1', 'true', 'yes', 'on')


def _list(name, default):
    return [item.strip() for item in os.environ.get(name, default).split(',') if item.strip()]


class Config:
    # Database
    SQLALCHEMY_DATABASE_URI = os.environ.get('DATABASE_URL', 'sqlite:///salary_predictor.db')
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    # Auth: JWTs live in httpOnly cookies, with double-submit CSRF protection
    JWT_SECRET_KEY = os.environ.get('JWT_SECRET_KEY')
    JWT_TOKEN_LOCATION = ['cookies']
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=int(os.environ.get('JWT_ACCESS_MINUTES', '15')))
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=int(os.environ.get('JWT_REFRESH_DAYS', '7')))
    JWT_COOKIE_SECURE = _bool('JWT_COOKIE_SECURE', False)  # set true when served over HTTPS
    JWT_COOKIE_SAMESITE = os.environ.get('JWT_COOKIE_SAMESITE', 'Lax')
    JWT_COOKIE_CSRF_PROTECT = True
    JWT_ACCESS_COOKIE_PATH = '/'
    JWT_REFRESH_COOKIE_PATH = '/auth/'
    JWT_SESSION_COOKIE = False  # persist cookies until the token expires

    # CORS
    CORS_ORIGINS = _list('CORS_ORIGINS', 'http://localhost:3000')

    # Uploads
    UPLOAD_FOLDER = os.environ.get('UPLOAD_FOLDER', os.path.join(BACKEND_DIR, 'uploaded_resumes'))
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB

    # Rate limiting (use a Redis URI in production so limits are shared across workers)
    RATELIMIT_ENABLED = _bool('RATELIMIT_ENABLED', True)
    RATELIMIT_STORAGE_URI = os.environ.get('RATELIMIT_STORAGE_URI', 'memory://')
    RATELIMIT_HEADERS_ENABLED = True
    AUTH_RATE_LIMIT = os.environ.get('AUTH_RATE_LIMIT', '5 per minute;30 per hour')
    PUBLIC_API_RATE_LIMIT = os.environ.get('PUBLIC_API_RATE_LIMIT', '30 per minute')

    # Serve the production React build (created with `npm run build` in /frontend)
    FRONTEND_BUILD_DIR = os.path.join(BACKEND_DIR, '..', 'frontend', 'build')


class TestingConfig(Config):
    TESTING = True
    JWT_SECRET_KEY = 'test-secret-key-that-is-long-enough-for-hs256'
    SQLALCHEMY_DATABASE_URI = 'sqlite://'
    RATELIMIT_ENABLED = False
