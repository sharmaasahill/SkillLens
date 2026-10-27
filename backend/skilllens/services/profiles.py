"""Profile updates (with history) and profile resume handling."""
import logging
import os

from models.database import ProfileHistory

from ..errors import ApiError
from ..extensions import db
from . import storage
from .resumes import flatten_skills
from .serializers import PROFILE_FIELDS

logger = logging.getLogger(__name__)


def _snapshot(user):
    entry = ProfileHistory(user_id=user.id, profile_resume_filename=user.profile_resume_filename)
    for field in PROFILE_FIELDS:
        setattr(entry, field, getattr(user, field))
    return entry


def update_profile(user, changes):
    """Apply validated changes (a dict of provided fields only) and record history."""
    if changes.get('date_of_birth', 0) is None:
        changes.pop('date_of_birth')  # a date of birth can be corrected, but not removed
    db.session.add(_snapshot(user))
    for field, value in changes.items():
        setattr(user, field, value)
    db.session.commit()
    return user


def history(user):
    return (ProfileHistory.query.filter_by(user_id=user.id)
            .order_by(ProfileHistory.changed_at.desc()).all())


def upload_profile_resume(user, file_storage):
    """A resume added from the profile page joins the resume library as the primary resume."""
    from . import resumes  # local import: resumes imports this module's helpers indirectly

    resume, analysis = resumes.upload_resume(user, file_storage, make_primary=True)
    skills = flatten_skills(analysis.get('skills'))
    skills_summary = ', '.join(skills[:10]) if skills else 'Skills analysis in progress'
    if not user.skills_summary:  # keep a manually written summary
        user.skills_summary = skills_summary
        db.session.commit()
    return user, skills_summary


def profile_resume_file(user):
    """Absolute path of the user's profile resume, or raise 404."""
    path = storage.profile_resume_path(user)
    if not path:
        raise ApiError('No profile resume found', 404)
    if not os.path.exists(path):
        raise ApiError('Resume file not found', 404)
    return path
