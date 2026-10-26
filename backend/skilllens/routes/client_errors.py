"""Browser errors: the React app reports JavaScript crashes here, for the admin error log.

Anyone can report (a crash can happen before or without signing in), so reports are rate limited,
size limited and grouped, and nothing in them is ever run or shown as HTML.
"""
from flask import Blueprint, current_app, request
from flask_jwt_extended import current_user, verify_jwt_in_request

from ..extensions import limiter
from ..schemas import ClientErrorReport
from ..services import error_log
from . import json_body

bp = Blueprint('client_errors', __name__, url_prefix='/api')


def _limit():
    return current_app.config.get('CLIENT_ERROR_RATE_LIMIT', '10 per minute;100 per day')


@bp.post('/client-errors')
@limiter.limit(_limit)
def report():
    data = json_body(ClientErrorReport)
    user_id = None
    try:
        verify_jwt_in_request(optional=True)
        user_id = current_user.id if current_user else None
    except Exception:  # noqa: BLE001 - an expired or missing token is fine here
        pass
    first_frame = next((line.strip() for line in (data.stack or '').splitlines()[1:] if line.strip()), '')
    detail = '\n'.join(filter(None, [
        data.stack, f'Page: {data.url}' if data.url else '', f"Browser: {request.headers.get('User-Agent', '')[:200]}",
    ]))
    error_log.record('client', 'browser', data.message, detail=detail, path=data.url, user_id=user_id,
                     where=f'{data.kind}|{first_frame[:120]}')
    return '', 204
