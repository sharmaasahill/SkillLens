"""HR dashboard endpoints. Every route requires an HR (admin) account."""
import os

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import current_user

from models.database import User

from ..errors import ApiError
from ..schemas import BulkReviewRequest, CandidateReviewRequest, HRUserQuery
from ..security import hr_required
from ..services import hr, storage
from . import json_body

bp = Blueprint('hr', __name__, url_prefix='/hr')


@bp.get('/all-users')
@hr_required
def all_users():
    query = HRUserQuery.model_validate(request.args.to_dict())
    return jsonify(hr.search_candidates(query))


@bp.get('/user/<int:user_id>')
@hr_required
def user_details(user_id):
    return jsonify(hr.candidate_details(user_id))


@bp.get('/download-profile-resume/<int:user_id>')
@hr_required
def download_profile_resume(user_id):
    user = hr.candidate(user_id)
    path = storage.profile_resume_path(user)
    if not path:
        raise ApiError('No profile resume found for this user', 404)
    if not os.path.exists(path):
        raise ApiError('Resume file not found', 404)
    return send_file(path, as_attachment=True, download_name=user.profile_resume_filename or 'resume.pdf')


@bp.get('/stats')
@hr_required
def stats():
    return jsonify(hr.stats())


@bp.get('/analytics')
@hr_required
def analytics():
    return jsonify(hr.analytics())


@bp.get('/job-roles')
@hr_required
def job_roles():
    return jsonify({'job_roles': hr.distinct_values(User.current_work)})


@bp.get('/locations')
@hr_required
def locations():
    return jsonify({'locations': hr.distinct_values(User.current_location)})


@bp.get('/companies')
@hr_required
def companies():
    return jsonify({'companies': hr.distinct_values(User.current_company)})


@bp.get('/skills')
@hr_required
def skills():
    return jsonify({'skills': hr.top_skills()})


@bp.patch('/candidates/<int:user_id>/review')
@hr_required
def review_candidate(user_id):
    """Set a candidate's status (shortlisted, contacted...) and/or a private team note."""
    body = request.get_json(silent=True) or {}
    data = json_body(CandidateReviewRequest)
    changes = {}
    if 'status' in body:
        changes['status'] = data.status
    if 'note' in body:
        changes['note'] = data.note
    return jsonify(hr.update_review([user_id], current_user, **changes)[0])


@bp.post('/candidates/<int:user_id>/remove')
@hr_required
def remove_candidate(user_id):
    """Hide a candidate from the HR portal. Their account is untouched; they return when active again."""
    return jsonify(hr.update_review([user_id], current_user, remove=True)[0])


@bp.post('/candidates/<int:user_id>/restore')
@hr_required
def restore_candidate(user_id):
    return jsonify(hr.update_review([user_id], current_user, remove=False)[0])


@bp.post('/candidates/bulk')
@hr_required
def bulk_review():
    data = json_body(BulkReviewRequest)
    kwargs = {'remove': True} if data.action == 'remove' else {'remove': False} if data.action == 'restore' else {'status': data.status}
    return jsonify({'candidates': hr.update_review(data.user_ids, current_user, **kwargs)})
