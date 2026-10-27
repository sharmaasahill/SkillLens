"""Authentication: register, login, refresh, logout, current user.

Tokens are set as httpOnly cookies, so JavaScript can never read them. State-changing
requests must also send the matching CSRF token in the X-CSRF-TOKEN header; the
CSRF values are returned in the JSON body so the frontend can store them.
"""
from datetime import datetime

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import (
    create_access_token, create_refresh_token, current_user, decode_token, get_csrf_token, get_jwt,
    jwt_required, set_access_cookies, set_refresh_cookies, unset_jwt_cookies,
)
from werkzeug.security import check_password_hash

from models.database import User

from ..errors import ApiError
from ..extensions import db, limiter
from ..schemas import LoginRequest, RegisterRequest, TwoFactorLoginRequest
from ..services import admin_account, passwords, two_factor
from ..services.serializers import user_summary
from . import json_body

bp = Blueprint('auth', __name__, url_prefix='/auth')

# Compared against when the email is unknown, so response time does not reveal which emails exist
_DUMMY_HASH = passwords.hash_password('dummy-password-for-timing')


def _auth_limit():
    return current_app.config['AUTH_RATE_LIMIT']


def _session_response(user, status=200, **extra):
    access = create_access_token(identity=user)
    refresh = create_refresh_token(identity=user)
    response = jsonify({
        'user': user_summary(user),
        'csrf_access_token': get_csrf_token(access),
        'csrf_refresh_token': get_csrf_token(refresh),
        **extra,
    })
    set_access_cookies(response, access)
    set_refresh_cookies(response, refresh)
    return response, status


@bp.post('/register')
@limiter.limit(_auth_limit)
def register():
    data = json_body(RegisterRequest)
    if admin_account.is_admin_email(data.email) or User.query.filter_by(email=data.email).first():
        raise ApiError('Email already registered', 409)
    passwords.check(data.password, email=data.email, name=data.full_name)

    user = User(
        email=data.email,
        password=passwords.hash_password(data.password),
        full_name=data.full_name,
        is_admin=False,
        privacy_accepted_at=datetime.utcnow(),
        privacy_version=current_app.config['PRIVACY_VERSION'],
    )
    db.session.add(user)
    db.session.commit()
    return _session_response(user, 201)


@bp.post('/login')
@limiter.limit(_auth_limit)
def login():
    """One sign-in for everyone. The admin email opens the admin dashboard; any other email is a user."""
    data = json_body(LoginRequest)
    if admin_account.is_admin_email(data.email):
        user = admin_account.sync_admin()  # creates the admin account on its first sign-in
    else:
        user = User.query.filter_by(email=data.email).first()
    password_ok = check_password_hash(user.password if user else _DUMMY_HASH, data.password)
    if not user or not password_ok:
        admin_account.explain_failed_sign_in(data.email, user)
        raise ApiError('Invalid email or password', 401)
    # Checked only after the password is right, so it reveals nothing to someone guessing
    if user.blocked_at is not None:
        raise ApiError('This account has been blocked. Contact SkillLens support if you think this is a mistake.', 403)
    if user.is_admin and two_factor.enabled(user):
        # No session yet: the code from the authenticator app comes first (POST /auth/2fa)
        return jsonify({'two_factor_required': True, 'challenge': two_factor.make_challenge(user)})
    return _session_response(user)


@bp.post('/2fa')
@limiter.limit(_auth_limit)
def two_factor_login():
    """Second step of the admin sign-in: the 6-digit code from the app, or a recovery code."""
    data = json_body(TwoFactorLoginRequest)
    user = two_factor.read_challenge(data.challenge)
    method = two_factor.check_code(user, data.code)
    if not method:
        raise ApiError('That code is not right. Use the newest code in your authenticator app.', 401)
    if method == 'recovery':
        return _session_response(user, recovery_codes_left=two_factor.recovery_left(user))
    return _session_response(user)


@bp.post('/refresh')
@jwt_required(refresh=True)
def refresh():
    access = create_access_token(identity=current_user)
    response = jsonify({'user': user_summary(current_user), 'csrf_access_token': get_csrf_token(access)})
    set_access_cookies(response, access)
    return response


@bp.post('/logout')
def logout():
    response = jsonify({'message': 'Logged out'})
    unset_jwt_cookies(response)
    return response


@bp.get('/me')
@jwt_required()
def me():
    body = {'user': user_summary(current_user), 'csrf_access_token': get_jwt().get('csrf')}
    # The refresh cookie is sent here too (its path is /auth/). Returning its CSRF value lets a session
    # that began with a redirect (Google sign-in) refresh itself later.
    refresh = request.cookies.get(current_app.config['JWT_REFRESH_COOKIE_NAME'])
    if refresh:
        try:
            body['csrf_refresh_token'] = decode_token(refresh).get('csrf')
        except Exception:  # noqa: BLE001 - an old or broken refresh cookie just means no refresh
            pass
    return jsonify(body)
