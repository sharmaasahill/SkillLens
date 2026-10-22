"""Job recommendations and market analysis."""
import os

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import current_user, jwt_required

from models.database import Resume

from ..errors import ApiError
from ..extensions import limiter
from ..schemas import JobsBySkillsRequest, MarketAnalysisRequest, RecommendJobsRequest
from ..services import live_jobs, ml, storage
from . import json_body

bp = Blueprint('jobs', __name__, url_prefix='/api')


def _latest_resume(user):
    return Resume.query.filter_by(user_id=user.id).order_by(Resume.uploaded_at.desc(), Resume.id.desc()).first()


def _resume_skills_and_text(resume):
    """Use the analysis stored at upload time; re-read the PDF only for old records."""
    skills, text = resume.get_skills(), resume.raw_text or ''
    if skills and text:
        return skills, text
    path = storage.resume_path(resume)
    if not os.path.exists(path):
        raise ApiError('Resume file not found on server', 404)
    analysis = ml.resume_analyzer().analyze_resume(path)
    return skills or analysis.get('extracted_skills', []), text or analysis.get('raw_text', '')


@bp.post('/recommend-jobs')
@jwt_required()
def recommend_jobs():
    params = json_body(RecommendJobsRequest)
    resume = _latest_resume(current_user)
    if resume is None:
        raise ApiError('No resume found. Please upload a resume first.', 400)

    user_skills, text = _resume_skills_and_text(resume)
    if not user_skills:
        raise ApiError('No skills could be extracted from your resume. '
                       'Please try uploading a different resume.', 400)

    experience = params.experience_years
    experience_info = ml.resume_analyzer()._extract_experience_info(text) if text else {}
    if not experience:
        experience = experience_info.get('total_years', 0)

    recommender = ml.job_recommender()
    recommendations = recommender.recommend_jobs(
        user_skills=user_skills,
        user_experience=experience,
        preferred_locations=params.preferred_locations,
        preferred_categories=params.preferred_categories,
        top_k=params.top_k,
    )

    analysis = recommender.get_skills_analysis(user_skills)
    live = []
    if params.include_live:
        # Search with the user's most in-demand skills; only these keywords leave the server
        demand = analysis.get('user_skills_demand', {})
        top_skills = sorted(user_skills, key=lambda s: demand.get(s, {}).get('job_count', 0), reverse=True)[:3]
        city = (params.preferred_locations or [None])[0]
        live = live_jobs.annotate(
            live_jobs.search(top_skills, city=city, limit=10,
                             user_ip=request.remote_addr, user_agent=request.headers.get('User-Agent')),
            user_skills)

    return jsonify({
        'success': True,
        'recommendations': recommendations,
        'live_jobs': live,
        'live_sources': live_jobs.configured_providers(),
        'user_profile': {
            'extracted_skills': user_skills,
            'experience_years': experience,
            'resume_analysis': {
                'total_skills_found': len(user_skills),
                'resume_filename': resume.filename,
                'analysis_summary': {
                    'total_skills_found': len(user_skills),
                    'text_length': len(text),
                    'ats_score': resume.score or 0,
                    'estimated_experience': experience_info.get('total_years', 0),
                },
            },
        },
        'skills_analysis': analysis,
        'total_recommendations': len(recommendations),
        'message': f'Found {len(recommendations)} job recommendations based on '
                   f'{len(user_skills)} skills extracted from your resume',
    })


@bp.post('/job-market-analysis')
@jwt_required()
def job_market_analysis():
    skills = json_body(MarketAnalysisRequest).skills
    if not skills:
        resume = _latest_resume(current_user)
        skills = resume.get_skills() if resume else []
    if not skills:
        raise ApiError('No skills found. Please upload a resume or provide skills manually.', 400)
    return jsonify({
        'success': True,
        'analysis': ml.job_recommender().get_skills_analysis(skills),
        'user_skills': skills,
    })


@bp.get('/job-categories')
@jwt_required()
def job_categories():
    return jsonify({'success': True, 'categories': ml.job_recommender().get_job_categories()})


@bp.get('/job-locations')
@jwt_required()
def job_locations():
    return jsonify({'success': True, 'locations': ml.job_recommender().get_locations()})


@bp.post('/recommend-jobs-by-skills')
@limiter.limit(lambda: current_app.config['PUBLIC_API_RATE_LIMIT'])
def recommend_jobs_by_skills():
    """Public endpoint (no login) for recommendations from a list of skills. Rate limited."""
    params = json_body(JobsBySkillsRequest)
    recommendations = ml.job_recommender().recommend_jobs(
        user_skills=params.skills,
        user_experience=params.experience,
        preferred_locations=params.preferred_locations,
        preferred_categories=params.preferred_categories,
        top_k=params.top_k,
    )
    return jsonify({
        'success': True,
        'recommendations': recommendations,
        'user_skills': params.skills,
        'total_recommendations': len(recommendations),
    })
