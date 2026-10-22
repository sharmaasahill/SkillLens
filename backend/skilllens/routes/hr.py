"""HR dashboard endpoints. Every route requires an HR (admin) account."""
import os

from flask import Blueprint, jsonify, request, send_file

from models.database import User

from ..errors import ApiError
from ..schemas import HRUserQuery
from ..security import hr_required
from ..services import hr, storage

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
