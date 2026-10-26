"""Resume library: upload, analysis, primary resume, listing and deletion.

Each user keeps up to MAX_RESUMES resumes. Exactly one of them is primary: it is the
resume SkillLens uses for market fit, salary suggestions and the HR dashboard.
The first upload becomes primary automatically; after that the user chooses.
"""
import logging
from datetime import datetime, timezone

from flask import current_app

from models import jd_matcher
from models.database import AiResult, Resume
from models.resume_analyzer import ResumeAnalyzer, analyze_text, extract_skills_from_resume

from ..errors import ApiError
from ..extensions import db
from . import storage

logger = logging.getLogger(__name__)

MAX_RESUMES = 5


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


def list_resumes(user):
    return Resume.query.filter_by(user_id=user.id).order_by(Resume.uploaded_at.desc(), Resume.id.desc()).all()


def primary_resume(user):
    """The user's primary resume, or None. Falls back to the newest if none is marked (old data)."""
    resume = Resume.query.filter_by(user_id=user.id, is_primary=True).first()
    if resume is None:
        resume = (Resume.query.filter_by(user_id=user.id)
                  .order_by(Resume.uploaded_at.desc(), Resume.id.desc()).first())
    return resume


def owned_resume(user, resume_id):
    resume = Resume.query.filter_by(id=resume_id, user_id=user.id).first()
    if resume is None:
        raise ApiError('Resume not found or access denied', 404)
    return resume


def _sync_profile_resume(user):
    """Keep the profile resume fields (shown to HR) pointing at the primary resume."""
    primary = Resume.query.filter_by(user_id=user.id, is_primary=True).first()
    if primary is not None:
        user.profile_resume_filename = primary.filename
        user.profile_resume_path = primary.stored_filename
        user.profile_resume_uploaded_at = primary.uploaded_at


def set_primary(user, resume_id):
    resume = owned_resume(user, resume_id)
    Resume.query.filter(Resume.user_id == user.id, Resume.id != resume.id).update({'is_primary': False})
    resume.is_primary = True
    _sync_profile_resume(user)
    db.session.commit()
    return resume


def jd_text_from_request(form, files):
    """Job description from a pasted text field or an uploaded file. Returns None when neither is given."""
    upload = files.get('jd_file')
    text = (form.get('jd_text') or '').strip()
    if upload and upload.filename:
        try:
            text = jd_matcher.text_from_upload(upload)
        except ValueError as exc:
            raise ApiError(str(exc), 400)
    if not text:
        return None
    try:
        return jd_matcher.clean_jd(text)
    except ValueError as exc:
        raise ApiError(str(exc), 400)


def with_jd(analysis, text, skills, jd_text):
    """Add the JD comparison and a combined score to an analysis."""
    if not jd_text:
        return analysis
    match = jd_matcher.match(text, jd_text, resume_skills=skills)
    ats_score = analysis.get('ats_analysis', {}).get('score', 0)
    return {**analysis, 'jd_match': match, 'overall_score': jd_matcher.combined_score(ats_score, match['score'])}


def upload_resume(user, file_storage, make_primary=False, jd_text=None):
    """Store, analyze and record an uploaded resume. Returns (resume, analysis)."""
    count = Resume.query.filter_by(user_id=user.id).count()
    if count >= MAX_RESUMES:
        raise ApiError(f'You can keep up to {MAX_RESUMES} resumes. Delete one before uploading another.', 409)

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
            is_primary=make_primary or count == 0,
        )
        skills = flatten_skills(analysis.get('skills'))
        resume.set_skills(skills)
        db.session.add(resume)
        db.session.flush()
        if resume.is_primary:
            Resume.query.filter(Resume.user_id == user.id, Resume.id != resume.id).update({'is_primary': False})
            _sync_profile_resume(user)
        db.session.commit()
        return resume, with_jd(analysis, analysis.get('text', ''), skills, jd_text)
    except Exception:
        db.session.rollback()
        storage.delete(stored)
        raise


def reanalyze(user, resume_id, jd_text=None):
    """Analyze a saved resume again (optionally against a JD) without uploading it again."""
    resume = owned_resume(user, resume_id)
    if not (resume.raw_text or '').strip():
        raise ApiError('This resume has no stored text. Upload it again to analyze it.', 400)
    analysis = analyze_text(resume.raw_text)
    # Keep the library in step with the latest rules, so matching and HR see the same skills and score
    resume.set_skills(analysis['skills'])
    resume.score = analysis['ats_analysis']['score']
    db.session.commit()
    return resume, with_jd(analysis, analysis['text'], analysis['skills'], jd_text)


def experience_years(resume):
    if not resume or not resume.raw_text:
        return 0
    return ResumeAnalyzer()._extract_experience_info(resume.raw_text).get('total_years', 0)


def delete_resume(user, resume_id):
    resume = owned_resume(user, resume_id)
    was_primary = resume.is_primary
    if resume.stored_filename:
        path_to_delete = resume.stored_filename
    else:
        # Uploads from before unique storage shared one folder by original name.
        # Only remove the file if no other resume record still points at it.
        others = Resume.query.filter(
            Resume.id != resume.id, Resume.filename == resume.filename, Resume.stored_filename.is_(None)
        ).count()
        path_to_delete = None if others else resume.filename

    if user.profile_resume_path and user.profile_resume_path == resume.stored_filename:
        user.profile_resume_filename = user.profile_resume_path = user.profile_resume_uploaded_at = None
    AiResult.query.filter_by(resume_id=resume.id).delete()  # SQLite does not cascade by default
    db.session.delete(resume)
    db.session.flush()
    if was_primary:
        # The newest remaining resume takes over, so features keep working
        successor = (Resume.query.filter_by(user_id=user.id)
                     .order_by(Resume.uploaded_at.desc(), Resume.id.desc()).first())
        if successor is not None:
            successor.is_primary = True
            _sync_profile_resume(user)
    db.session.commit()
    try:
        storage.delete(path_to_delete)
    except OSError as exc:
        logger.warning('Could not delete resume file %s: %s', path_to_delete, exc)


def market_fit(user, resume, role=None):
    """Which skills postings for a role ask for, and which of them this resume shows.

    Without a role, it uses the profile's current role, then a common job title found near the top
    of the resume (its headline).
    """
    from . import ml

    market = ml.job_market()
    guessed = not role
    if not role:
        role = (user.current_work or '').strip() or market.guess_role((resume.raw_text or '')[:1500])
    result = market.role_fit(role, resume.get_skills(), resume.raw_text or '')
    return {**result, 'guessed': guessed}


def library_limits():
    return {'max_resumes': MAX_RESUMES, 'upload_limit_mb': current_app.config['MAX_CONTENT_LENGTH'] // (1024 * 1024)}
