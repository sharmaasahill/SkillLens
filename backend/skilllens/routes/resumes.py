"""Resume library: uploads, analysis (optionally against a job description) and the primary resume."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..services import resumes
from ..services.serializers import resume_entry

bp = Blueprint('resumes', __name__)


def _truthy(value):
    return str(value or '').strip().lower() in ('1', 'true', 'yes', 'on')


def _analysis_response(resume, analysis, message):
    return jsonify({
        'message': message,
        'id': resume.id,
        'is_primary': bool(resume.is_primary),
        'skills': analysis.get('skills'),  # original format (list or categorized dict)
        'text': analysis.get('text', ''),
        'ats_analysis': analysis.get('ats_analysis', {}),
        'jd_match': analysis.get('jd_match'),
        'overall_score': analysis.get('overall_score'),
        'filename': resume.filename,
    })


@bp.post('/upload-resume')
@jwt_required()
def upload_resume():
    """Multipart: file (PDF), optional make_primary, optional jd_text or jd_file."""
    jd_text = resumes.jd_text_from_request(request.form, request.files)
    resume, analysis = resumes.upload_resume(
        current_user, request.files.get('file'),
        make_primary=_truthy(request.form.get('make_primary')), jd_text=jd_text)
    return _analysis_response(resume, analysis, 'Resume uploaded successfully')


@bp.post('/resumes/<int:resume_id>/analyze')
@jwt_required()
def analyze_saved(resume_id):
    """Analyze a saved resume again. Accepts JSON {jd_text} or multipart jd_text / jd_file. JD is optional."""
    form = request.form if request.form or request.files else (request.get_json(silent=True) or {})
    jd_text = resumes.jd_text_from_request(form, request.files)
    resume, analysis = resumes.reanalyze(current_user, resume_id, jd_text=jd_text)
    return _analysis_response(resume, analysis, 'Resume analyzed')


@bp.put('/resumes/<int:resume_id>/primary')
@jwt_required()
def make_primary(resume_id):
    resume = resumes.set_primary(current_user, resume_id)
    return jsonify({'message': f'{resume.filename} is now your primary resume', 'resume': resume_entry(resume)})


@bp.get('/resume-history')
@jwt_required()
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
@jwt_required()
def delete_resume(resume_id):
    resumes.delete_resume(current_user, resume_id)
    return jsonify({'message': 'Resume deleted successfully'})
