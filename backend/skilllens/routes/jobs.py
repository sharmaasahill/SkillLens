"""Jobs. Matching against the 2025 Naukri.com dataset was removed because those postings have expired;
the jobs page shows "coming soon" until live job search is added.

Live openings from Adzuna/Careerjet stay available here for that work, but nothing calls them yet.
"""
from flask import Blueprint, jsonify, request
from flask_jwt_extended import current_user

from ..errors import ApiError
from ..schemas import LiveJobsRequest
from ..security import candidate_required
from ..services import live_jobs, resumes
from . import json_body

bp = Blueprint('jobs', __name__, url_prefix='/api')


@bp.post('/live-jobs')
@candidate_required(activity=True)
def live_job_search():
    """Current openings from Adzuna/Careerjet for the primary resume's top skills. Called on demand only."""
    params = json_body(LiveJobsRequest)
    resume = resumes.primary_resume(current_user)
    skills = params.skills or (resume.get_skills() if resume else [])
    if not skills:
        raise ApiError('Upload a resume or give some skills to search live openings.', 400)
    if not live_jobs.configured_providers():
        raise ApiError('Live openings are not set up on this server.', 404)
    # Stored skills are ordered most-mentioned first; only these keywords and the city leave the server
    top_skills = skills[:3]
    result = live_jobs.search(top_skills, city=params.city, limit=10,
                              user_ip=request.remote_addr, user_agent=request.headers.get('User-Agent'))
    return jsonify({
        'success': True,
        'jobs': live_jobs.annotate(result['jobs'], skills),
        'searched_for': top_skills,
        'from_cache': result['from_cache'],
        'limit_reached': result['limit_reached'],
        **live_jobs.status(),
    })
