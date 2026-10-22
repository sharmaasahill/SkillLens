"""Auth helpers: user lookup for JWTs and an HR-only decorator."""
from functools import wraps

from flask_jwt_extended import current_user, verify_jwt_in_request

from models.database import User

from .errors import ApiError
from .extensions import db, jwt


@jwt.user_identity_loader
def user_identity(user):
    # Tokens carry the user id (as a string), so email changes do not invalidate sessions
    return str(user.id) if isinstance(user, User) else str(user)


@jwt.user_lookup_loader
def load_user(_header, payload):
    try:
        return db.session.get(User, int(payload['sub']))
    except (TypeError, ValueError):
        return None


def hr_required(fn):
    """Require a valid access token belonging to an HR (admin) user."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        verify_jwt_in_request()
        if not current_user.is_admin:
            raise ApiError('Access denied. HR privileges required.', 403)
        return fn(*args, **kwargs)

    return wrapper
