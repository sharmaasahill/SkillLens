"""Authentication: register, login, refresh, logout, current user.

Tokens are set as httpOnly cookies, so JavaScript can never read them. State-changing
requests must also send the matching CSRF token in the X-CSRF-TOKEN header; the
CSRF values are returned in the JSON body so the frontend can store them.
"""
from flask import Blueprint, current_app, jsonify
from flask_jwt_extended import (
    create_access_token, create_refresh_token, current_user, get_csrf_token, get_jwt,
    jwt_required, set_access_cookies, set_refresh_cookies, unset_jwt_cookies,
)
from werkzeug.security import check_password_hash, generate_password_hash

from models.database import User

from ..errors import ApiError
from ..extensions import db, limiter
from ..schemas import LoginRequest, RegisterRequest
from ..services import admin_account
from ..services.serializers import user_summary
from . import json_body

bp = Blueprint('auth', __name__, url_prefix='/auth')

# Compared against when the email is unknown, so response time does not reveal which emails exist
_DUMMY_HASH = generate_password_hash('dummy-password-for-timing', method='pbkdf2:sha256')


def _auth_limit():
    return current_app.config['AUTH_RATE_LIMIT']


def _session_response(user, status=200):
    access = create_access_token(identity=user)
    refresh = create_refresh_token(identity=user)
    response = jsonify({
        'user': user_summary(user),
        'csrf_access_token': get_csrf_token(access),
        'csrf_refresh_token': get_csrf_token(refresh),
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

    user = User(
        email=data.email,
        password=generate_password_hash(data.password, method='pbkdf2:sha256'),
        full_name=data.full_name,
        is_admin=False,
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
        raise ApiError('Invalid email or password', 401)
    # Checked only after the password is right, so it reveals nothing to someone guessing
    if user.blocked_at is not None:
        raise ApiError('This account has been blocked. Contact SkillLens support if you think this is a mistake.', 403)
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
    return jsonify({'user': user_summary(current_user), 'csrf_access_token': get_jwt().get('csrf')})
