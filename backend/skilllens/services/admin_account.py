"""The single admin account.

SkillLens has one admin, set by ADMIN_EMAIL and ADMIN_PASSWORD. Nobody can register that email,
and the account is created (or its password updated) the first time someone signs in with it.
That way the same admin login works on any database, local SQLite or the live PostgreSQL,
without running a setup script after every database reset.
"""
import logging

from flask import current_app
from sqlalchemy.exc import IntegrityError
from werkzeug.security import check_password_hash

from models.database import User

from ..extensions import db
from . import passwords

logger = logging.getLogger(__name__)


def admin_email():
    return current_app.config['ADMIN_EMAIL']


def is_admin_email(email):
    return bool(email) and bool(admin_email()) and email.strip().lower() == admin_email()


def sync_admin():
    """Make sure the admin account exists, uses ADMIN_PASSWORD, and is the only admin.

    Returns the admin user, or None when ADMIN_PASSWORD is not set (admin sign-in is then off).
    """
    email, password = admin_email(), current_app.config['ADMIN_PASSWORD']
    if not email or not password:
        logger.warning('ADMIN_EMAIL or ADMIN_PASSWORD is not set, so the admin account cannot sign in.')
        return None

    # Only one admin: any other account marked as admin becomes a regular user
    User.query.filter(User.is_admin.is_(True), User.email != email).update(
        {'is_admin': False}, synchronize_session=False)

    user = User.query.filter_by(email=email).first()
    if user is None:
        user = User(email=email, full_name='SkillLens Admin')
        db.session.add(user)
    user.is_admin = True
    user.has_password = True  # even if this email first signed up with Google
    if not user.password or not check_password_hash(user.password, password):
        user.password = passwords.hash_password(password)
    try:
        db.session.commit()
    except IntegrityError:
        # Two first sign-ins at the same moment: the other one created the account
        db.session.rollback()
        user = User.query.filter_by(email=email).first()
    return user
