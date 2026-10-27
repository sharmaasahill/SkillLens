"""Google sign-in routes. See services/google_auth.py for how the flow is kept safe."""
import logging
import secrets
from datetime import datetime

from flask import Blueprint, current_app, redirect, request
from flask_jwt_extended import create_access_token, create_refresh_token, set_access_cookies, set_refresh_cookies

from models.database import User

from ..extensions import db, limiter
from ..services import admin_account, error_log, google_auth, passwords

logger = logging.getLogger(__name__)

bp = Blueprint('google_auth', __name__, url_prefix='/auth/google')


def _limit():
    return current_app.config.get('AUTH_RATE_LIMIT', '5 per minute;30 per hour')


def _frontend(path):
    return f"{current_app.config.get('FRONTEND_URL') or ''}{path}"


def _back_to_sign_in(code, mode='signin'):
    response = redirect(_frontend(f"/auth?{'mode=signup&' if mode == 'signup' else ''}error=google_{code}"))
    response.delete_cookie(google_auth.COOKIE, path='/auth/google')
    return response


@bp.get('/start')
@limiter.limit(_limit)
def start():
    mode = 'signup' if request.args.get('mode') == 'signup' else 'signin'
    if not google_auth.configured():
        return _back_to_sign_in('off', mode)
    url, cookie = google_auth.start(mode)
    response = redirect(url)
    response.set_cookie(google_auth.COOKIE, cookie, max_age=google_auth.COOKIE_SECONDS, path='/auth/google',
                        httponly=True, secure=current_app.config.get('JWT_COOKIE_SECURE', False), samesite='Lax')
    return response


@bp.get('/callback')
@limiter.limit(_limit)
def callback():
    if not google_auth.configured():
        return _back_to_sign_in('off')
    try:
        person = google_auth.finish(request.args, request.cookies.get(google_auth.COOKIE))
    except google_auth.GoogleError as exc:
        if exc.code == 'failed':
            error_log.record('service', 'google', f'Google sign-in: {exc.detail}', level='warning')
        return _back_to_sign_in(exc.code)

    mode = person['mode']
    if admin_account.is_admin_email(person['email']):
        return _back_to_sign_in('admin', mode)

    user = User.query.filter_by(google_sub=person['sub']).first()
    if user is None:
        user = User.query.filter_by(email=person['email']).first()
        if user is not None:
            if user.is_admin:
                return _back_to_sign_in('admin', mode)
            user.google_sub = person['sub']  # Google has verified this email: link it to the account
    if user is None:
        # The sign-in page says that continuing with Google means agreeing to the Privacy Policy
        user = User(
            email=person['email'], full_name=person['name'] or person['email'].split('@')[0],
            # A random password nobody knows; the person can set a real one on the Profile page
            password=passwords.hash_password(secrets.token_urlsafe(32)),
            has_password=False, google_sub=person['sub'], is_admin=False,
            privacy_accepted_at=datetime.utcnow(), privacy_version=current_app.config['PRIVACY_VERSION'],
        )
        db.session.add(user)
    if user.blocked_at is not None:
        db.session.rollback()
        return _back_to_sign_in('blocked', mode)
    db.session.commit()

    response = redirect(_frontend('/dashboard'))
    set_access_cookies(response, create_access_token(identity=user))
    set_refresh_cookies(response, create_refresh_token(identity=user))
    response.delete_cookie(google_auth.COOKIE, path='/auth/google')
    return response
