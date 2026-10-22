"""Resume analysis uploads and history."""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from ..services import resumes
from ..services.serializers import resume_entry

bp = Blueprint('resumes', __name__)


@bp.post('/upload-resume')
@jwt_required()
def upload_resume():
    resume, analysis = resumes.upload_resume(current_user, request.files.get('file'))
    return jsonify({
        'message': 'Resume uploaded successfully',
        'id': resume.id,
        'skills': analysis.get('skills'),  # original format (list or categorized dict)
        'text': analysis.get('text', ''),
        'ats_analysis': analysis.get('ats_analysis', {}),
        'filename': resume.filename,
    })


@bp.get('/resume-history')
@jwt_required()
def resume_history():
    return jsonify({'resumes': [resume_entry(r) for r in resumes.list_resumes(current_user)]})


@bp.delete('/resume-history/<int:resume_id>')
@jwt_required()
def delete_resume(resume_id):
    resumes.delete_resume(current_user, resume_id)
    return jsonify({'message': 'Resume deleted successfully'})
