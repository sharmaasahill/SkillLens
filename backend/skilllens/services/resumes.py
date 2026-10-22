"""Resume upload, analysis, listing and deletion."""
import logging
from datetime import datetime, timezone

from models.database import Resume
from models.resume_analyzer import extract_skills_from_resume

from ..errors import ApiError
from ..extensions import db
from . import storage

logger = logging.getLogger(__name__)


def flatten_skills(skills):
    """The analyzer returns either a list or a {category: [skills]} dict."""
    if isinstance(skills, dict):
        flat = []
        for category_skills in skills.values():
            flat.extend(category_skills)
        return flat
    return list(skills or [])


def analyze_file(path):
    try:
        return extract_skills_from_resume(path)
    except ValueError as exc:
        raise ApiError(str(exc), 400)


def upload_resume(user, file_storage):
    """Store, analyze and record an uploaded resume. Returns (resume, analysis)."""
    display_name = storage.original_name(file_storage)
    stored = storage.save_pdf(file_storage, user.id)
    try:
        analysis = analyze_file(storage.resolve(stored))
        resume = Resume(
            user_id=user.id,
            filename=display_name,
            stored_filename=stored,
            raw_text=analysis.get('text', ''),
            score=analysis.get('ats_analysis', {}).get('score', 0),
            uploaded_at=datetime.now(timezone.utc),
        )
        resume.set_skills(flatten_skills(analysis.get('skills')))
        db.session.add(resume)
        db.session.commit()
        return resume, analysis
    except Exception:
        db.session.rollback()
        storage.delete(stored)
        raise


def list_resumes(user):
    return Resume.query.filter_by(user_id=user.id).order_by(Resume.uploaded_at.desc(), Resume.id.desc()).all()


def delete_resume(user, resume_id):
    resume = Resume.query.filter_by(id=resume_id, user_id=user.id).first()
    if resume is None:
        raise ApiError('Resume not found or access denied', 404)

    if resume.stored_filename:
        path_to_delete = resume.stored_filename
    else:
        # Uploads from before unique storage shared one folder by original name.
        # Only remove the file if no other resume record still points at it.
        others = Resume.query.filter(
            Resume.id != resume.id, Resume.filename == resume.filename, Resume.stored_filename.is_(None)
        ).count()
        path_to_delete = None if others else resume.filename

    db.session.delete(resume)
    db.session.commit()

    try:
        storage.delete(path_to_delete)
    except OSError as exc:
        logger.warning('Could not delete resume file %s: %s', path_to_delete, exc)
