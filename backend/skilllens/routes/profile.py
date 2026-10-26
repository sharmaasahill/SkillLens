"""Current user's profile, history, profile resume, password and account deletion."""
from flask import Blueprint, current_app, jsonify, request, send_file
from flask_jwt_extended import current_user, unset_jwt_cookies

from ..extensions import limiter
from ..schemas import ChangePasswordRequest, DeleteAccountRequest, ProfileUpdateRequest
from ..security import user_required
from ..services import accounts, profiles
from ..services.serializers import profile_history_entry, user_profile
from . import json_body

bp = Blueprint('profile', __name__)


def _auth_limit():
    # Both actions check the password, so they get the same limit as signing in
    return current_app.config['AUTH_RATE_LIMIT']


@bp.post('/profile/change-password')
@limiter.limit(_auth_limit)
@user_required
def change_password():
    """Change the password. Every other device is signed out; this one gets fresh tokens."""
    from .auth import _session_response

    data = json_body(ChangePasswordRequest)
    accounts.change_password(current_user, data.current_password, data.new_password)
    response, _ = _session_response(current_user)
    return response


@bp.post('/profile/delete')
@limiter.limit(_auth_limit)
@user_required
def delete_account():
    """Delete the account and all its data. The password is asked again, so nobody can do it by accident."""
    data = json_body(DeleteAccountRequest)
    accounts.check_password(current_user, data.password)
    accounts.delete_account(current_user)
    response = jsonify({'message': 'Your account and all its data have been deleted.'})
    unset_jwt_cookies(response)
    return response


@bp.get('/profile')
@user_required
def get_profile():
    return jsonify(user_profile(current_user))


@bp.get('/profile/history')
@user_required
def get_history():
    return jsonify({'history': [profile_history_entry(h) for h in profiles.history(current_user)]})


@bp.route('/update-profile', methods=['PUT', 'POST'])
@user_required
def update_profile():
    changes = json_body(ProfileUpdateRequest).model_dump(exclude_unset=True)
    user = profiles.update_profile(current_user, changes)
    return jsonify({'message': 'Profile updated successfully', 'user': user_profile(user)})


@bp.post('/profile/upload-resume')
@user_required
def upload_profile_resume():
    user, skills_summary = profiles.upload_profile_resume(current_user, request.files.get('file'))
    return jsonify({
        'message': 'Profile resume uploaded successfully',
        'filename': user.profile_resume_filename,
        'skills_summary': skills_summary,
        'uploaded_at': user.profile_resume_uploaded_at.isoformat(),
    })


@bp.get('/profile/download-resume')
@user_required
def download_profile_resume():
    path = profiles.profile_resume_file(current_user)
    return send_file(path, as_attachment=True,
                     download_name=current_user.profile_resume_filename or 'resume.pdf')
