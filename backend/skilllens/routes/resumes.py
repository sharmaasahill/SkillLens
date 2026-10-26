"""Resume library: uploads, analysis (optionally against a job description), AI review, market fit
and the primary resume."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user

from ..schemas import MarketFitRequest
from ..security import user_required
from ..services import ai_review, ml, resumes
from ..services.serializers import resume_entry
from . import json_body

bp = Blueprint('resumes', __name__)


def _form():
    """Form fields from multipart or JSON, whichever the request used."""
    return request.form if request.form or request.files else (request.get_json(silent=True) or {})


def _truthy(value):
    return str(value or '').strip().lower() in ('1', 'true', 'yes', 'on')


def _analysis_response(resume, analysis, message):
    return jsonify({
        'message': message,
        'id': resume.id,
        'is_primary': bool(resume.is_primary),
        'skills': analysis.get('skills'),  # original format (list or categorized dict)
        'skill_groups': analysis.get('skill_groups'),
        'text': analysis.get('text', ''),
        'ats_analysis': analysis.get('ats_analysis', {}),
        'jd_match': analysis.get('jd_match'),
        'overall_score': analysis.get('overall_score'),
        'checks': analysis.get('checks'),
        'filename': resume.filename,
        'ai': ai_review.status(current_user),
    })


@bp.post('/upload-resume')
@user_required(activity=True)
def upload_resume():
    """Multipart: file (PDF), optional make_primary, optional jd_text or jd_file."""
    jd_text = resumes.jd_text_from_request(request.form, request.files)
    resume, analysis = resumes.upload_resume(
        current_user, request.files.get('file'),
        make_primary=_truthy(request.form.get('make_primary')), jd_text=jd_text)
    return _analysis_response(resume, analysis, 'Resume uploaded successfully')


@bp.post('/resumes/<int:resume_id>/analyze')
@user_required(activity=True)
def analyze_saved(resume_id):
    """Analyze a saved resume again. Accepts JSON {jd_text} or multipart jd_text / jd_file. JD is optional."""
    jd_text = resumes.jd_text_from_request(_form(), request.files)
    resume, analysis = resumes.reanalyze(current_user, resume_id, jd_text=jd_text)
    return _analysis_response(resume, analysis, 'Resume analyzed')


@bp.get('/ai/status')
@user_required
def ai_status():
    return jsonify(ai_review.status(current_user))


@bp.post('/resumes/<int:resume_id>/ai-review')
@user_required(activity=True)
def ai_review_resume(resume_id):
    """AI review by Gemini. Accepts the same optional jd_text / jd_file as analysis. Saved, so repeats are free."""
    resume = resumes.owned_resume(current_user, resume_id)
    jd_text = resumes.jd_text_from_request(_form(), request.files)
    return jsonify(ai_review.review(current_user, resume, jd_text))


@bp.post('/resumes/<int:resume_id>/market-fit')
@user_required
def market_fit(resume_id):
    """Skills that 2025 Indian postings for a role ask for, against this resume. JSON {role}, optional."""
    resume = resumes.owned_resume(current_user, resume_id)
    return jsonify(resumes.market_fit(current_user, resume, json_body(MarketFitRequest).role))


@bp.get('/market/roles')
@user_required
def market_roles():
    """Job titles seen in at least 3 postings, for the market fit role box."""
    return jsonify({'roles': ml.job_market().popular_titles()})


@bp.put('/resumes/<int:resume_id>/primary')
@user_required
def make_primary(resume_id):
    resume = resumes.set_primary(current_user, resume_id)
    return jsonify({'message': f'{resume.filename} is now your primary resume', 'resume': resume_entry(resume)})


@bp.get('/resume-history')
@user_required
def resume_history():
    items = resumes.list_resumes(current_user)
    primary = resumes.primary_resume(current_user)
    return jsonify({
        'resumes': [resume_entry(r, primary_id=primary.id if primary else None) for r in items],
        'primary_id': primary.id if primary else None,
        'primary_experience_years': resumes.experience_years(primary),
        **resumes.library_limits(),
    })


@bp.delete('/resume-history/<int:resume_id>')
@user_required
def delete_resume(resume_id):
    resumes.delete_resume(current_user, resume_id)
    return jsonify({'message': 'Resume deleted successfully'})
