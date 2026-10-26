"""Application settings, read from environment variables (see backend/.env.example)."""
import os
from datetime import timedelta

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _bool(name, default=False):
    return os.environ.get(name, str(default)).strip().lower() in ('1', 'true', 'yes', 'on')


def _list(name, default):
    return [item.strip() for item in os.environ.get(name, default).split(',') if item.strip()]


def _database_url():
    """DATABASE_URL, or a local SQLite file.

    Hosts such as Neon give links like "postgres://user:pass@host/db". SQLAlchemy needs the driver
    in the name ("postgresql+psycopg://..."), so it is added here.
    """
    url = os.environ.get('DATABASE_URL', '').strip() or 'sqlite:///salary_predictor.db'
    for prefix in ('postgres://', 'postgresql://'):
        if url.startswith(prefix):
            return 'postgresql+psycopg://' + url[len(prefix):]
    return url


class Config:
    # Database
    SQLALCHEMY_DATABASE_URI = _database_url()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    # Neon closes idle connections (it sleeps when unused), so check each pooled connection first
    SQLALCHEMY_ENGINE_OPTIONS = {'pool_pre_ping': True, 'pool_recycle': 280}

    # Number of proxies in front of the app (1 on Render), so rate limits see each visitor's real IP
    PROXY_COUNT = int(os.environ.get('PROXY_COUNT', '0'))

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

    # The one admin account. Every other email is a regular user. The password is never stored in
    # code: set ADMIN_PASSWORD in backend/.env locally and in the host's settings (Render) live.
    ADMIN_EMAIL = os.environ.get('ADMIN_EMAIL', 'admin.skilllens@gmail.com').strip().lower()
    ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', '')

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

    # Live job search sources (see backend/.env.example). Sources without a key are skipped.
    JSEARCH_API_KEY = os.environ.get('JSEARCH_API_KEY', '').strip()
    JSEARCH_VIA = os.environ.get('JSEARCH_VIA', 'openwebninja').strip()  # or "rapidapi"
    APIFY_TOKEN = os.environ.get('APIFY_TOKEN', '').strip()
    APIFY_NAUKRI_ACTOR = os.environ.get('APIFY_NAUKRI_ACTOR', 'valig/naukri-jobs-scraper').strip()
    APIFY_LINKEDIN_ACTOR = os.environ.get('APIFY_LINKEDIN_ACTOR', 'valig/linkedin-jobs-scraper').strip()
    APIFY_WELLFOUND_ACTOR = os.environ.get('APIFY_WELLFOUND_ACTOR', 'blackfalcondata/wellfound-scraper').strip()
    APIFY_RESULTS_PER_RUN = int(os.environ.get('APIFY_RESULTS_PER_RUN', '25'))
    APIFY_MAX_USD_PER_RUN = float(os.environ.get('APIFY_MAX_USD_PER_RUN', '0.15'))
    JOOBLE_API_KEY = os.environ.get('JOOBLE_API_KEY', '').strip()
    JOOBLE_HOST = os.environ.get('JOOBLE_HOST', 'in.jooble.org').strip()
    THEIRSTACK_API_KEY = os.environ.get('THEIRSTACK_API_KEY', '').strip()
    THEIRSTACK_RESULTS = int(os.environ.get('THEIRSTACK_RESULTS', '10'))
    HIMALAYAS_API_KEY = os.environ.get('HIMALAYAS_API_KEY', '').strip()
    ADZUNA_APP_ID = os.environ.get('ADZUNA_APP_ID', '')
    ADZUNA_APP_KEY = os.environ.get('ADZUNA_APP_KEY', '')
    CAREERJET_API_KEY = os.environ.get('CAREERJET_API_KEY', '')
    # Turn off sources that need no key, e.g. "remoteok,lever"
    JOB_SOURCES_DISABLED = _list('JOB_SOURCES_DISABLED', '')
    JOB_SEARCH_USER_DAILY_LIMIT = int(os.environ.get('JOB_SEARCH_USER_DAILY_LIMIT', '30'))
    JOB_SEARCH_SYNC = False  # tests run sources inline instead of in background threads

    # Optional AI resume review with Google Gemini (free key from https://aistudio.google.com)
    GEMINI_API_KEY = os.environ.get('GEMINI_API_KEY', '').strip()
    # Tried in order: when one is busy or out of free quota, the next is used
    GEMINI_MODELS = _list('GEMINI_MODELS', 'gemini-3.8-flash,gemini-3.5-flash-lite')
    AI_DAILY_LIMIT = int(os.environ.get('AI_DAILY_LIMIT', '40'))  # AI reviews per day, all users together
    AI_USER_DAILY_LIMIT = int(os.environ.get('AI_USER_DAILY_LIMIT', '10'))  # per user per day

    # Serve the production React build (created with `npm run build` in /frontend)
    FRONTEND_BUILD_DIR = os.path.join(BACKEND_DIR, '..', 'frontend', 'build')


class TestingConfig(Config):
    TESTING = True
    JWT_SECRET_KEY = 'test-secret-key-that-is-long-enough-for-hs256'
    SQLALCHEMY_DATABASE_URI = 'sqlite://'
    ADMIN_EMAIL = 'admin@example.com'
    ADMIN_PASSWORD = 'admin-password-123'
    RATELIMIT_ENABLED = False
    # Tests never call outside services: keyed sources are off and keyless ones are disabled
    ADZUNA_APP_ID = ADZUNA_APP_KEY = CAREERJET_API_KEY = ''
    JSEARCH_API_KEY = APIFY_TOKEN = JOOBLE_API_KEY = THEIRSTACK_API_KEY = HIMALAYAS_API_KEY = ''
    JOB_SOURCES_DISABLED = ['greenhouse', 'lever', 'ashby', 'remotive', 'himalayas', 'remoteok']
    JOB_SEARCH_SYNC = True
    GEMINI_API_KEY = ''
