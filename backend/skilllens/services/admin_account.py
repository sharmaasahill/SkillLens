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


def _mask(email):
    """adm...@gmail.com: enough to spot a typo in the server log, without printing the address."""
    name, _, domain = (email or '').partition('@')
    return f'{name[:3]}...@{domain}' if domain else '(not an email)'


def describe_settings(config):
    email, password = config.get('ADMIN_EMAIL') or '', config.get('ADMIN_PASSWORD') or ''
    if not email or not password:
        missing = ' and '.join(n for n, v in (('ADMIN_EMAIL', email), ('ADMIN_PASSWORD', password)) if not v)
        return f'Admin sign-in is OFF: {missing} not set (backend/.env locally, Environment on Render).'
    return (f'Admin sign-in is ON for {_mask(email)} ({len(email)} characters); '
            f'ADMIN_PASSWORD has {len(password)} characters.')


def explain_failed_sign_in(email, user):
    """Log why a sign-in to the admin account failed (never the typed password)."""
    if is_admin_email(email):
        logger.warning('Admin sign-in failed: the password typed is not the ADMIN_PASSWORD setting.')
    elif user is not None and user.is_admin:
        logger.warning('Sign-in failed for an admin account whose email is not the ADMIN_EMAIL setting (%s). '
                       'Check ADMIN_EMAIL for a typo.', _mask(admin_email()) if admin_email() else 'ADMIN_EMAIL not set')


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
