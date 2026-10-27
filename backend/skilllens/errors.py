"""Consistent JSON error responses: every error body is {"error": "...", ...}."""
import logging

from flask import jsonify
from pydantic import ValidationError
from werkzeug.exceptions import HTTPException

logger = logging.getLogger(__name__)


class ApiError(Exception):
    """Raise from routes/services to return a JSON error with a status code."""

    def __init__(self, message, status=400):
        super().__init__(message)
        self.message = message
        self.status = status


def _validation_details(exc):
    details = []
    for err in exc.errors():
        field = '.'.join(str(part) for part in err.get('loc', ()))
        details.append({'field': field or None, 'message': err.get('msg', 'Invalid value')})
    return details


def register_error_handlers(app):
    @app.errorhandler(ApiError)
    def handle_api_error(exc):
        return jsonify({'error': exc.message}), exc.status

    @app.errorhandler(ValidationError)
    def handle_validation_error(exc):
        return jsonify({'error': 'Invalid input', 'details': _validation_details(exc)}), 400

    @app.errorhandler(HTTPException)
    def handle_http_error(exc):
        messages = {
            413: 'File is too large (max 5 MB)',
            429: 'Too many requests. Please slow down and try again shortly.',
        }
        return jsonify({'error': messages.get(exc.code, exc.description)}), exc.code

    @app.errorhandler(Exception)
    def handle_unexpected_error(exc):
        logger.exception('Unhandled error')
        _record_crash(exc)
        return jsonify({'error': 'Internal server error'}), 500


def _record_crash(exc):
    """Put a crash in the admin dashboard's error log, with where it happened and who it happened to."""
    import os
    import traceback

    from flask import request

    from .extensions import db
    from .services import error_log

    try:
        db.session.rollback()  # the failed request may have left the session half-done
    except Exception:  # noqa: BLE001
        pass
    frames = traceback.extract_tb(exc.__traceback__)
    last = frames[-1] if frames else None
    where = f'{os.path.basename(last.filename)}:{last.lineno}' if last else ''
    rule = request.url_rule.rule if request.url_rule is not None else request.path
    user_id = None
    try:
        from flask_jwt_extended import get_jwt_identity
        identity = get_jwt_identity()
        user_id = int(identity) if identity else None
    except Exception:  # noqa: BLE001 - no verified token in this request
        pass
    error_log.record(
        'server', f'{request.method} {rule}', f'{type(exc).__name__}: {exc}',
        detail=''.join(traceback.format_exception(type(exc), exc, exc.__traceback__)),
        status=500, path=request.path, user_id=user_id, where=where)


def register_jwt_handlers(jwt):
    """Make flask-jwt-extended errors use the same {"error": ...} shape."""

    @jwt.unauthorized_loader
    def missing_token(reason):
        return jsonify({'error': reason}), 401

    @jwt.invalid_token_loader
    def invalid_token(reason):
        return jsonify({'error': reason}), 401

    @jwt.expired_token_loader
    def expired_token(_header, _payload):
        return jsonify({'error': 'Token has expired'}), 401

    @jwt.revoked_token_loader
    def revoked_token(_header, _payload):
        return jsonify({'error': 'Token has been revoked'}), 401

    @jwt.user_lookup_error_loader
    def user_not_found(_header, _payload):
        return jsonify({'error': 'User not found'}), 401
