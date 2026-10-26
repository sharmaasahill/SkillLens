"""Account actions: delete an account with all its data, change or reset a password, block and unblock.

Signing everyone out of an account works through `session_version`: every login token carries the
version it was made with (see security.py), and a token with an older version stops working.
"""
import logging
import os
import secrets
import shutil
from datetime import datetime

from flask import current_app
from sqlalchemy import delete as sql_delete
from werkzeug.security import check_password_hash, generate_password_hash

from models.database import (
    AiResult, ApiUsage, ErrorLog, JobSearch, ProfileHistory, Resume, ResumeScore, StoredFile, User, UserReview,
)

from ..errors import ApiError
from ..extensions import db

logger = logging.getLogger(__name__)

MIN_PASSWORD = 8


def _hash(password):
    return generate_password_hash(password, method='pbkdf2:sha256')


def sign_out_everywhere(user):
    user.session_version = (user.session_version or 0) + 1


def check_password(user, password):
    if not password or not check_password_hash(user.password, password):
        raise ApiError('That password is not correct.', 403)


def change_password(user, current, new):
    """The user's own password change. Other devices are signed out; this one gets new tokens from the route."""
    check_password(user, current)
    if len(new or '') < MIN_PASSWORD:
        raise ApiError(f'The new password needs at least {MIN_PASSWORD} characters.', 400)
    if check_password_hash(user.password, new):
        raise ApiError('The new password is the same as the current one.', 400)
    user.password = _hash(new)
    sign_out_everywhere(user)
    db.session.commit()


def reset_password(user):
    """Admin reset without email: a new temporary password, shown once to the admin to pass on."""
    temporary = secrets.token_urlsafe(9)  # 12 characters
    user.password = _hash(temporary)
    sign_out_everywhere(user)
    db.session.commit()
    return temporary


def set_blocked(user, blocked):
    if blocked:
        user.blocked_at = user.blocked_at or datetime.utcnow()
        sign_out_everywhere(user)
    else:
        user.blocked_at = None
    db.session.commit()
    return user


def delete_account(user):
    """Delete a user and everything they created: resumes and their files, AI answers, searches, history."""
    if user.is_admin:
        raise ApiError('The admin account cannot be deleted.', 400)
    uid = user.id
    resume_ids = [r.id for r in Resume.query.filter_by(user_id=uid).with_entities(Resume.id)]

    AiResult.query.filter_by(user_id=uid).delete(synchronize_session=False)
    if resume_ids:
        AiResult.query.filter(AiResult.resume_id.in_(resume_ids)).delete(synchronize_session=False)
    ResumeScore.query.filter_by(user_id=uid).delete(synchronize_session=False)
    # JobSearch has a column named "query", which hides the usual Model.query
    db.session.execute(sql_delete(JobSearch).where(JobSearch.user_id == uid))
    ProfileHistory.query.filter_by(user_id=uid).delete(synchronize_session=False)
    UserReview.query.filter_by(user_id=uid).delete(synchronize_session=False)
    UserReview.query.filter_by(updated_by=uid).update({'updated_by': None}, synchronize_session=False)
    Resume.query.filter_by(user_id=uid).delete(synchronize_session=False)
    StoredFile.query.filter(StoredFile.path.like(f'users/{uid}/%')).delete(synchronize_session=False)
    # Per-user daily counters go; site-wide ones stay, so the paid-API budgets still hold
    ApiUsage.query.filter(ApiUsage.provider.in_([f'gemini-user-{uid}', f'jobsearch-user-{uid}'])).delete(
        synchronize_session=False)
    ErrorLog.query.filter_by(user_id=uid).update({'user_id': None}, synchronize_session=False)
    db.session.expire(user)
    db.session.delete(db.session.get(User, uid))
    db.session.commit()

    folder = os.path.join(os.path.abspath(current_app.config['UPLOAD_FOLDER']), 'users', str(int(uid)))
    try:
        shutil.rmtree(folder, ignore_errors=True)
    except OSError as exc:
        logger.warning('Could not remove %s: %s', folder, exc)
