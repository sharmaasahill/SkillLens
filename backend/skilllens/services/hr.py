"""HR candidate search and analytics.

Queries aggregate in the database instead of looping per user, so the cost of a
page is a fixed handful of queries regardless of how many candidates exist.
"""
import json
import math
from collections import Counter

from sqlalchemy import case, func, or_, select

from models.database import ProfileHistory, Resume, User

from ..errors import ApiError
from ..extensions import db
from .serializers import user_profile

TOP_SKILLS_PER_USER = 10


def _ci_contains(column, text):
    """Case-insensitive substring match with LIKE wildcards escaped."""
    return func.lower(column).contains(text.lower(), autoescape=True)


def _resume_aggregates():
    """Per-user resume count and the id of the most recent resume."""
    return (
        select(
            Resume.user_id.label('user_id'),
            func.count(Resume.id).label('resume_count'),
            func.max(Resume.id).label('latest_id'),
        )
        .group_by(Resume.user_id)
        .subquery()
    )


def search_candidates(q):
    """Filtered, sorted, paginated candidate list. `q` is a validated HRUserQuery."""
    agg = _resume_aggregates()
    latest = Resume.__table__.alias('latest_resume')

    stmt = (
        select(User, agg.c.resume_count, latest.c.score)
        .outerjoin(agg, agg.c.user_id == User.id)
        .outerjoin(latest, latest.c.id == agg.c.latest_id)
        .where(User.is_admin.is_(False))
    )

    if q.job_role:
        stmt = stmt.where(_ci_contains(User.current_work, q.job_role))
    if q.location:
        stmt = stmt.where(_ci_contains(User.current_location, q.location))
    if q.company:
        stmt = stmt.where(_ci_contains(User.current_company, q.company))
    if q.skills:
        stmt = stmt.where(_ci_contains(User.skills_summary, q.skills))
    if q.search:
        stmt = stmt.where(or_(
            _ci_contains(User.full_name, q.search),
            _ci_contains(User.email, q.search),
            _ci_contains(User.current_work, q.search),
            _ci_contains(User.current_company, q.search),
        ))
    if q.min_experience is not None:
        stmt = stmt.where(User.total_experience >= q.min_experience)
    if q.max_experience is not None:
        stmt = stmt.where(User.total_experience <= q.max_experience)
    if q.min_score is not None:
        stmt = stmt.where(latest.c.score >= q.min_score)
    if q.has_resume == 'true':
        stmt = stmt.where(User.profile_resume_filename.is_not(None))
    elif q.has_resume == 'false':
        stmt = stmt.where(User.profile_resume_filename.is_(None))

    total = db.session.scalar(select(func.count()).select_from(stmt.subquery()))

    order = {
        'name': [User.full_name.asc().nulls_last()],
        'experience': [User.total_experience.desc().nulls_last()],
        'score': [latest.c.score.desc().nulls_last()],
        'created_at': [User.created_at.desc().nulls_last()],
    }[q.sort]
    stmt = stmt.order_by(*order, User.id.desc()).limit(q.per_page).offset((q.page - 1) * q.per_page)
    rows = db.session.execute(stmt).all()

    # One query for the skills of every user on this page
    user_ids = [row[0].id for row in rows]
    skills_by_user = {uid: Counter() for uid in user_ids}
    if user_ids:
        for user_id, skills_json in db.session.execute(
            select(Resume.user_id, Resume.skills).where(Resume.user_id.in_(user_ids))
        ):
            try:
                skills_by_user[user_id].update(set(json.loads(skills_json or '[]')))
            except (TypeError, ValueError):
                continue

    users = []
    for user, resume_count, latest_score in rows:
        data = user_profile(user)
        data.update({
            'resume_count': resume_count or 0,
            'latest_score': latest_score,
            'all_skills': [s for s, _ in skills_by_user[user.id].most_common(TOP_SKILLS_PER_USER)],
        })
        users.append(data)

    return {
        'users': users,
        'total_users': total,
        'page': q.page,
        'per_page': q.per_page,
        'pages': max(1, math.ceil(total / q.per_page)) if total else 1,
    }


def candidate_details(user_id):
    user = db.session.scalar(select(User).where(User.id == user_id, User.is_admin.is_(False)))
    if user is None:
        raise ApiError('User not found', 404)

    resumes = Resume.query.filter_by(user_id=user.id).order_by(Resume.uploaded_at.desc()).all()
    changes = (ProfileHistory.query.filter_by(user_id=user.id)
               .order_by(ProfileHistory.changed_at.desc()).limit(10).all())

    data = user_profile(user)
    data['resume_history'] = [{
        'id': r.id,
        'filename': r.filename,
        'skills': r.get_skills(),
        'score': r.score,
        'uploaded_at': r.uploaded_at.isoformat() if r.uploaded_at else None,
    } for r in resumes]
    data['profile_history'] = [{
        'changed_at': c.changed_at.isoformat() if c.changed_at else None,
        'full_name': c.full_name,
        'current_work': c.current_work,
        'current_company': c.current_company,
    } for c in changes]
    return data


def candidate(user_id):
    user = db.session.scalar(select(User).where(User.id == user_id, User.is_admin.is_(False)))
    if user is None:
        raise ApiError('User not found', 404)
    return user


def stats():
    candidates = User.is_admin.is_(False)
    return {
        'total_users': db.session.scalar(select(func.count(User.id)).where(candidates)),
        'total_resumes': db.session.scalar(select(func.count(Resume.id))),
        'users_with_profiles': db.session.scalar(
            select(func.count(User.id)).where(candidates, User.full_name.is_not(None))),
        'users_with_resume': db.session.scalar(
            select(func.count(User.id)).where(candidates, User.profile_resume_filename.is_not(None))),
        'average_score': round(db.session.scalar(
            select(func.avg(Resume.score)).where(Resume.score.is_not(None))) or 0, 1),
    }


def distinct_values(column):
    values = db.session.scalars(
        select(column).distinct().where(User.is_admin.is_(False), column.is_not(None), column != '')
    ).all()
    return sorted(values)


def top_skills(limit=50):
    counts = Counter()
    for skills_json in db.session.scalars(select(Resume.skills).where(Resume.skills.is_not(None))):
        try:
            counts.update(json.loads(skills_json))
        except (TypeError, ValueError):
            continue
    return [skill for skill, _ in counts.most_common(limit)]


def _top_counts(column, limit=10):
    rows = db.session.execute(
        select(column, func.count(User.id))
        .where(User.is_admin.is_(False), column.is_not(None), column != '')
        .group_by(column)
        .order_by(func.count(User.id).desc())
        .limit(limit)
    ).all()
    return {value: count for value, count in rows}


def _bucket_counts(column, buckets, where):
    """buckets: list of (label, upper_bound_or_None). Counts rows per bucket in one query."""
    whens = []
    for label, upper in buckets:
        if upper is not None:
            whens.append((column <= upper, label))
    last_label = buckets[-1][0]
    bucket = case(*whens, else_=last_label).label('bucket')
    rows = db.session.execute(select(bucket, func.count()).where(*where).group_by(bucket)).all()
    result = {label: 0 for label, _ in buckets}
    result.update({label: count for label, count in rows})
    return result


def analytics():
    candidates = User.is_admin.is_(False)
    experience = _bucket_counts(
        User.total_experience,
        [('0-2', 2), ('3-5', 5), ('6-10', 10), ('10+', None)],
        [candidates, User.total_experience.is_not(None), User.total_experience > 0],
    )
    scores = _bucket_counts(
        Resume.score,
        [('0-40', 40), ('41-60', 60), ('61-80', 80), ('81-100', None)],
        [Resume.score.is_not(None)],
    )
    avg_score = db.session.scalar(select(func.avg(Resume.score)).where(Resume.score.is_not(None)))
    return {
        'job_role_distribution': _top_counts(User.current_work),
        'location_distribution': _top_counts(User.current_location),
        'experience_distribution': experience,
        'score_distribution': scores,
        'average_score': avg_score or 0,
        'total_candidates': db.session.scalar(select(func.count(User.id)).where(candidates)),
    }

