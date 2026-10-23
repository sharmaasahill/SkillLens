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


def candidate_required(fn=None, *, activity=False):
    """Require a signed-in candidate. HR accounts cannot use candidate tools.

    With activity=True, a successful request also records the candidate as active, which brings
    them back to the HR portal if HR had removed them earlier.
    """
    def decorate(view):
        @wraps(view)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            if current_user is None:
                raise ApiError('Please sign in again.', 401)
            if current_user.is_admin:
                raise ApiError('HR accounts cannot use candidate tools. Sign in with a candidate account.', 403)
            response = view(*args, **kwargs)
            if activity:
                from datetime import datetime
                current_user.last_active_at = datetime.utcnow()
                db.session.commit()
            return response
        return wrapper
    return decorate(fn) if fn else decorate
