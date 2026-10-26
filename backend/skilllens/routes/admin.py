"""Admin dashboard endpoints. Every route requires the admin account."""
import os

from flask import Blueprint, jsonify, request, send_file
from flask_jwt_extended import current_user

from models.database import User

from ..errors import ApiError
from ..schemas import AdminUserQuery, BulkReviewRequest, UserReviewRequest
from ..security import admin_required
from ..services import admin, storage
from . import json_body

bp = Blueprint('admin', __name__, url_prefix='/api/admin')


@bp.get('/users')
@admin_required
def list_users():
    query = AdminUserQuery.model_validate(request.args.to_dict())
    return jsonify(admin.search_users(query))


@bp.get('/users/<int:user_id>')
@admin_required
def user_details(user_id):
    return jsonify(admin.user_details(user_id))


@bp.get('/users/<int:user_id>/resume')
@admin_required
def download_user_resume(user_id):
    user = admin.get_user(user_id)
    path = storage.profile_resume_path(user)
    if not path:
        raise ApiError('No profile resume found for this user', 404)
    if not os.path.exists(path):
        raise ApiError('Resume file not found', 404)
    return send_file(path, as_attachment=True, download_name=user.profile_resume_filename or 'resume.pdf')


@bp.get('/stats')
@admin_required
def stats():
    return jsonify(admin.stats())


@bp.get('/analytics')
@admin_required
def analytics():
    return jsonify(admin.analytics())


@bp.get('/job-roles')
@admin_required
def job_roles():
    return jsonify({'job_roles': admin.distinct_values(User.current_work)})


@bp.get('/locations')
@admin_required
def locations():
    return jsonify({'locations': admin.distinct_values(User.current_location)})


@bp.get('/companies')
@admin_required
def companies():
    return jsonify({'companies': admin.distinct_values(User.current_company)})


@bp.get('/skills')
@admin_required
def skills():
    return jsonify({'skills': admin.top_skills()})


@bp.patch('/users/<int:user_id>/review')
@admin_required
def review_user(user_id):
    """Set a user's status and/or a private admin note."""
    body = request.get_json(silent=True) or {}
    data = json_body(UserReviewRequest)
    changes = {}
    if 'status' in body:
        changes['status'] = data.status
    if 'note' in body:
        changes['note'] = data.note
    return jsonify(admin.update_review([user_id], current_user, **changes)[0])


@bp.post('/users/<int:user_id>/remove')
@admin_required
def remove_user(user_id):
    """Hide a user from the admin list. Their account is untouched; they return when active again."""
    return jsonify(admin.update_review([user_id], current_user, remove=True)[0])


@bp.post('/users/<int:user_id>/restore')
@admin_required
def restore_user(user_id):
    return jsonify(admin.update_review([user_id], current_user, remove=False)[0])


@bp.post('/users/bulk')
@admin_required
def bulk_review():
    data = json_body(BulkReviewRequest)
    kwargs = {'remove': True} if data.action == 'remove' else {'remove': False} if data.action == 'restore' else {'status': data.status}
    return jsonify({'users': admin.update_review(data.user_ids, current_user, **kwargs)})
