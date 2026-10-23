"""Current user's profile, history and profile resume."""
from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import current_user

from ..schemas import ProfileUpdateRequest
from ..security import candidate_required
from ..services import profiles
from ..services.serializers import profile_history_entry, user_profile
from . import json_body

bp = Blueprint('profile', __name__)


@bp.get('/profile')
@candidate_required
def get_profile():
    return jsonify(user_profile(current_user))


@bp.get('/profile/history')
@candidate_required
def get_history():
    return jsonify({'history': [profile_history_entry(h) for h in profiles.history(current_user)]})


@bp.route('/update-profile', methods=['PUT', 'POST'])
@candidate_required
def update_profile():
    changes = json_body(ProfileUpdateRequest).model_dump(exclude_unset=True)
    user = profiles.update_profile(current_user, changes)
    return jsonify({'message': 'Profile updated successfully', 'user': user_profile(user)})


@bp.post('/profile/upload-resume')
@candidate_required
def upload_profile_resume():
    user, skills_summary = profiles.upload_profile_resume(current_user, request.files.get('file'))
    return jsonify({
        'message': 'Profile resume uploaded successfully',
        'filename': user.profile_resume_filename,
        'skills_summary': skills_summary,
        'uploaded_at': user.profile_resume_uploaded_at.isoformat(),
    })


@bp.get('/profile/download-resume')
@candidate_required
def download_profile_resume():
    path = profiles.profile_resume_file(current_user)
    return send_file(path, as_attachment=True,
                     download_name=current_user.profile_resume_filename or 'resume.pdf')
