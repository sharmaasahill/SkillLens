"""HR candidate search and analytics.

Queries aggregate in the database instead of looping per user, so the cost of a
page is a fixed handful of queries regardless of how many candidates exist.
"""
import json
import math
from collections import Counter

from datetime import datetime

from sqlalchemy import and_, case, func, literal, or_, select

from models.database import CandidateReview, ProfileHistory, Resume, User
from models.skills_taxonomy import display_name, skill_key

from ..errors import ApiError
from ..extensions import db
from .serializers import user_profile

TOP_SKILLS_PER_USER = 10


def _ci_contains(column, text):
    """Case-insensitive substring match with LIKE wildcards escaped."""
    return func.lower(column).contains(text.lower(), autoescape=True)


def _has_skill(skill):
    """Candidates with exactly this skill on a resume or in their skills summary ("Java" is not "JavaScript")."""
    skill = skill.strip()
    # Resume.skills is a JSON list; older rows store the lower-case key ("rest api") instead of "REST APIs"
    names = {skill.lower(), display_name(skill).lower(), skill_key(skill)}
    on_resume = select(Resume.id).where(
        Resume.user_id == User.id,
        or_(*(func.lower(Resume.skills).contains(json.dumps(n), autoescape=True) for n in names)),
    ).exists()
    summary = literal(',') + func.replace(func.lower(func.coalesce(User.skills_summary, '')), ', ', ',') + literal(',')
    in_summary = or_(*(summary.contains(f',{n},', autoescape=True) for n in names))
    return or_(on_resume, in_summary)


def _resume_aggregates():
    """Per-user resume count and the id of the primary resume (newest if none is marked)."""
    return (
        select(
            Resume.user_id.label('user_id'),
            func.count(Resume.id).label('resume_count'),
            # Primary resume if one is marked, otherwise the newest (ids grow with uploads)
            func.coalesce(func.max(case((Resume.is_primary.is_(True), Resume.id))), func.max(Resume.id)).label('latest_id'),
        )
        .group_by(Resume.user_id)
        .subquery()
    )


def _removed_condition():
    """Removed by HR and not active since. Activity after removal brings a candidate back."""
    return and_(CandidateReview.hidden_at.is_not(None),
                or_(User.last_active_at.is_(None), User.last_active_at <= CandidateReview.hidden_at))


def _review_dict(review, user):
    if review is None:
        return {'status': None, 'note': None, 'removed': False, 'returned': False, 'updated_at': None}
    removed = bool(review.hidden_at and (not user.last_active_at or user.last_active_at <= review.hidden_at))
    return {
        'status': review.status,
        'note': review.note,
        'removed': removed,
        # Was removed, then used SkillLens again, so they are back in the list
        'returned': bool(review.hidden_at and not removed),
        'updated_at': review.updated_at.isoformat() if review.updated_at else None,
    }


def search_candidates(q):
    """Filtered, sorted, paginated candidate list. `q` is a validated HRUserQuery."""
    agg = _resume_aggregates()
    latest = Resume.__table__.alias('latest_resume')

    stmt = (
        select(User, agg.c.resume_count, latest.c.score, CandidateReview)
        .outerjoin(agg, agg.c.user_id == User.id)
        .outerjoin(latest, latest.c.id == agg.c.latest_id)
        .outerjoin(CandidateReview, CandidateReview.user_id == User.id)
        .where(User.is_admin.is_(False))
    )
    removed = _removed_condition()
    stmt = stmt.where(removed if q.view == 'removed' else or_(CandidateReview.user_id.is_(None), ~removed))
    if q.status == 'none':
        stmt = stmt.where(or_(CandidateReview.status.is_(None), CandidateReview.status == ''))
    elif q.status:
        stmt = stmt.where(CandidateReview.status == q.status)

    if q.job_role:
        stmt = stmt.where(_ci_contains(User.current_work, q.job_role))
    if q.location:
        stmt = stmt.where(_ci_contains(User.current_location, q.location))
    if q.company:
        stmt = stmt.where(_ci_contains(User.current_company, q.company))
    if q.skills:
        stmt = stmt.where(_has_skill(q.skills))
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
        'activity': [User.last_active_at.desc().nulls_last()],
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
                skills_by_user[user_id].update({display_name(s) for s in json.loads(skills_json or '[]')})
            except (TypeError, ValueError):
                continue

    users = []
    for user, resume_count, latest_score, review in rows:
        data = user_profile(user)
        data.update({
            'resume_count': resume_count or 0,
            'latest_score': latest_score,
            'review': _review_dict(review, user),
            'last_active_at': user.last_active_at.isoformat() if user.last_active_at else None,
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

    resumes = Resume.query.filter_by(user_id=user.id).order_by(Resume.uploaded_at.desc(), Resume.id.desc()).all()
    changes = (ProfileHistory.query.filter_by(user_id=user.id)
               .order_by(ProfileHistory.changed_at.desc()).limit(10).all())

    data = user_profile(user)
    data['review'] = _review_dict(db.session.get(CandidateReview, user.id), user)
    data['resume_history'] = [{
        'id': r.id,
        'filename': r.filename,
        'skills': r.get_skills(),
        'score': r.score,
        'is_primary': bool(r.is_primary),
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


def _review_for(user_id, hr_user):
    candidate(user_id)
    review = db.session.get(CandidateReview, user_id)
    if review is None:
        review = CandidateReview(user_id=user_id)
        db.session.add(review)
    review.updated_by = hr_user.id
    review.updated_at = datetime.utcnow()
    return review


def update_review(user_ids, hr_user, status=..., note=..., remove=None):
    """Set status and/or note, or remove/restore, for one or more candidates. `...` means unchanged."""
    for user_id in user_ids:
        review = _review_for(user_id, hr_user)
        if status is not ...:
            review.status = status or None
        if note is not ...:
            review.note = (note or '').strip() or None
        if remove is True:
            review.hidden_at = datetime.utcnow()
        elif remove is False:
            review.hidden_at = None
    db.session.commit()
    return [{'id': uid, 'review': _review_dict(db.session.get(CandidateReview, uid), db.session.get(User, uid))} for uid in user_ids]


def stats():
    candidates = User.is_admin.is_(False)
    status_counts = dict(db.session.execute(
        select(CandidateReview.status, func.count()).where(CandidateReview.status.is_not(None)).group_by(CandidateReview.status)
    ).all())
    removed_count = db.session.scalar(
        select(func.count()).select_from(CandidateReview).join(User, User.id == CandidateReview.user_id).where(_removed_condition()))
    return {
        'status_counts': status_counts,
        'removed_count': removed_count or 0,
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
            counts.update({display_name(s) for s in json.loads(skills_json)})
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

