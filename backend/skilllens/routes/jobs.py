"""Live job search across job boards, Apify scrapers, company career pages and remote job boards."""
from flask import Blueprint, jsonify
from flask_jwt_extended import current_user

from ..schemas import JobSearchRequest
from ..security import user_required
from ..services import ml, resumes
from ..services.jobs import ranking, search
from ..services.jobs.common import city_in
from . import json_body

bp = Blueprint('jobs', __name__, url_prefix='/api')


def _resume_profile(user):
    """(skill keys, years of experience, primary resume) used to rank jobs. Empty when there is no resume."""
    resume = resumes.primary_resume(user)
    if resume is None:
        return set(), 0, None
    return ranking.resume_keys(resume.get_skills(), resume.raw_text or ''), resumes.experience_years(resume), resume


@bp.get('/jobs/setup')
@user_required
def jobs_setup():
    """Sources, and the role, city and years to fill the search with."""
    _, years, resume = _resume_profile(current_user)
    role = (current_user.current_work or '').strip()
    if not role and resume is not None:
        role = ml.job_market().guess_role((resume.raw_text or '')[:1500])
    return jsonify({
        'sources': search.source_list(current_user),
        'defaults': {'role': role, 'city': city_in(current_user.current_location or ''), 'years': years},
        'has_resume': resume is not None,
        'resume_filename': resume.filename if resume is not None else None,
        'roles': ml.job_market().popular_titles(min_count=20),
    })


@bp.post('/jobs/search')
@user_required(activity=True)
def start_search():
    params = json_body(JobSearchRequest)
    item = search.start(current_user, params.role, params.city, params.days, params.remote_only, params.sources)
    have, years, _ = _resume_profile(current_user)
    return jsonify(search.snapshot(item, have, years)), 202


@bp.get('/jobs/search/<search_id>')
@user_required
def read_search(search_id):
    item = search.owned(current_user, search_id)
    have, years, _ = _resume_profile(current_user)
    return jsonify(search.snapshot(item, have, years))
