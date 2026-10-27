"""Convert database models into JSON-ready dicts."""
from datetime import date

PROFILE_FIELDS = [
    'full_name', 'phone_number', 'address', 'date_of_birth', 'current_work', 'current_company',
    'current_location', 'total_experience', 'linkedin_url', 'website_url', 'bio',
    'skills_summary', 'education', 'certifications', 'languages', 'achievements',
]


def _iso(value):
    return value.isoformat() if value else None


def age_on(born, today=None):
    """Whole years since `born` (a date), or None."""
    if not born:
        return None
    today = today or date.today()
    return today.year - born.year - ((today.month, today.day) < (born.month, born.day))


def user_summary(user):
    return {
        'id': user.id, 'email': user.email, 'full_name': user.full_name, 'is_admin': bool(user.is_admin),
        # Accounts made before date of birth was asked for, or with Google, are asked once on their next visit
        'needs_date_of_birth': not user.is_admin and user.date_of_birth is None,
    }


def _fields(record):
    data = {field: getattr(record, field) for field in PROFILE_FIELDS}
    data['date_of_birth'] = _iso(record.date_of_birth)
    return data


def user_profile(user):
    data = {'id': user.id, 'email': user.email, 'is_admin': bool(user.is_admin),
            'has_password': bool(user.has_password), 'google_linked': bool(user.google_sub)}
    data.update(_fields(user))
    data['age'] = age_on(user.date_of_birth)
    data.update({
        'profile_resume_filename': user.profile_resume_filename,
        'profile_resume_uploaded_at': _iso(user.profile_resume_uploaded_at),
        'created_at': _iso(user.created_at),
        'updated_at': _iso(user.updated_at),
    })
    return data


def profile_history_entry(entry):
    data = _fields(entry)
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
