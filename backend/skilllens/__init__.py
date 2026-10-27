"""SkillLens backend: application factory."""
import logging
import os

from dotenv import load_dotenv

# Load backend/.env before the config module reads environment variables
load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), '.env'))

# scikit-learn's helper library (joblib/loky) tries to count physical CPU cores by running a Windows
# tool (wmic) that newer Windows versions no longer have, and prints a long warning when that fails.
# Giving it a core limit up front skips that lookup. A value in backend/.env still wins.
os.environ.setdefault('LOKY_MAX_CPU_COUNT', str(max(1, (os.cpu_count() or 2) - 1)))

from flask import Flask  # noqa: E402

from .config import Config  # noqa: E402
from .errors import register_error_handlers, register_jwt_handlers  # noqa: E402
from .extensions import cors, db, jwt, limiter, migrate  # noqa: E402


def create_app(config_object=Config, overrides=None):
    app = Flask(__name__, static_folder=None)
    app.config.from_object(config_object)
    if overrides:
        app.config.update(overrides)

    proxies = app.config.get('PROXY_COUNT', 0)
    if proxies:
        # Behind a host's load balancer every request seems to come from the balancer itself.
        # ProxyFix reads the visitor's IP and https from the headers the trusted proxies add.
        from werkzeug.middleware.proxy_fix import ProxyFix
        app.wsgi_app = ProxyFix(app.wsgi_app, x_for=proxies, x_proto=proxies)

    if not app.config.get('JWT_SECRET_KEY'):
        raise RuntimeError("JWT_SECRET_KEY is not set. Copy backend/.env.example to backend/.env and set a value.")

    logging.basicConfig(level=logging.INFO)
    if not app.config.get('TESTING'):
        from .services import admin_account
        # One line in the server log (Render > Logs) shows whether admin sign-in is on, without the secrets
        logging.getLogger(__name__).warning(admin_account.describe_settings(app.config))
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)

    db.init_app(app)
    migrate.init_app(app, db, directory=os.path.join(os.path.dirname(os.path.dirname(__file__)), 'migrations'))
    jwt.init_app(app)
    limiter.init_app(app)
    cors.init_app(
        app,
        origins=app.config['CORS_ORIGINS'],
        supports_credentials=True,
        allow_headers=['Content-Type', 'X-CSRF-TOKEN'],
    )

    from . import security  # noqa: F401  (registers JWT user loaders)
    from . import headers
    register_jwt_handlers(jwt)
    register_error_handlers(app)
    headers.register(app)

    from .routes import register_blueprints
    register_blueprints(app)

    from .cli import register_commands
    register_commands(app)

    @app.get('/health')
    def health():
        return {'status': 'ok'}

    return app
