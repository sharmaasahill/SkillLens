"""Profile updates (with history) and profile resume handling."""
import logging
import os
from datetime import datetime

from models.database import ProfileHistory

from ..errors import ApiError
from ..extensions import db
from . import storage
from .resumes import analyze_file, flatten_skills
from .serializers import PROFILE_FIELDS

logger = logging.getLogger(__name__)


def _snapshot(user):
    entry = ProfileHistory(user_id=user.id, profile_resume_filename=user.profile_resume_filename)
    for field in PROFILE_FIELDS:
        setattr(entry, field, getattr(user, field))
    return entry


def update_profile(user, changes):
    """Apply validated changes (a dict of provided fields only) and record history."""
    db.session.add(_snapshot(user))
    for field, value in changes.items():
        setattr(user, field, value)
    db.session.commit()
    return user


def history(user):
    return (ProfileHistory.query.filter_by(user_id=user.id)
            .order_by(ProfileHistory.changed_at.desc()).all())


def upload_profile_resume(user, file_storage):
    display_name = storage.original_name(file_storage)
    stored = storage.save_pdf(file_storage, user.id, subfolder='profile')
    old_path = storage.profile_resume_path(user)

    try:
        analysis = analyze_file(storage.resolve(stored))
        skills = flatten_skills(analysis.get('skills'))
        skills_summary = ', '.join(skills[:10]) if skills else 'Skills analysis in progress'
    except ApiError as exc:
        logger.warning('Profile resume analysis failed: %s', exc.message)
        skills_summary = 'Skills analysis failed'

    try:
        user.profile_resume_filename = display_name
        user.profile_resume_path = stored
        user.profile_resume_uploaded_at = datetime.now()
        if not user.skills_summary:  # keep a manually written summary
            user.skills_summary = skills_summary
        db.session.commit()
    except Exception:
        db.session.rollback()
        storage.delete(stored)
        raise

    if old_path:
        try:
            if os.path.exists(old_path):
                os.remove(old_path)
        except OSError as exc:
            logger.warning('Could not remove old profile resume: %s', exc)

    return user, skills_summary


def profile_resume_file(user):
    """Absolute path of the user's profile resume, or raise 404."""
    path = storage.profile_resume_path(user)
    if not path:
        raise ApiError('No profile resume found', 404)
    if not os.path.exists(path):
        raise ApiError('Resume file not found', 404)
    return path
