"""Convert database models into JSON-ready dicts."""

PROFILE_FIELDS = [
    'full_name', 'phone_number', 'address', 'age', 'current_work', 'current_company',
    'current_location', 'total_experience', 'linkedin_url', 'website_url', 'bio',
    'skills_summary', 'education', 'certifications', 'languages', 'achievements',
]


def _iso(value):
    return value.isoformat() if value else None


def user_summary(user):
    return {'id': user.id, 'email': user.email, 'full_name': user.full_name, 'is_admin': bool(user.is_admin)}


def user_profile(user):
    data = {'id': user.id, 'email': user.email, 'is_admin': bool(user.is_admin),
            'has_password': bool(user.has_password), 'google_linked': bool(user.google_sub)}
    data.update({field: getattr(user, field) for field in PROFILE_FIELDS})
    data.update({
        'profile_resume_filename': user.profile_resume_filename,
        'profile_resume_uploaded_at': _iso(user.profile_resume_uploaded_at),
        'created_at': _iso(user.created_at),
        'updated_at': _iso(user.updated_at),
    })
    return data


def profile_history_entry(entry):
    data = {field: getattr(entry, field) for field in PROFILE_FIELDS}
    data['changed_at'] = _iso(entry.changed_at)
    return data


def resume_entry(resume, primary_id=None):
    is_primary = bool(resume.is_primary) if primary_id is None else resume.id == primary_id
    return {
        'id': resume.id,
        'filename': resume.filename,
        'skills': resume.get_skills(),
        'score': resume.score or 0,
        'is_primary': is_primary,
        'timestamp': _iso(resume.uploaded_at),
        'uploaded_at': _iso(resume.uploaded_at),
    }
