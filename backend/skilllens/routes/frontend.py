"""Serve the production React build (frontend/build) for non-API paths."""
import os

from flask import Blueprint, current_app, send_from_directory

from ..errors import ApiError

bp = Blueprint('frontend', __name__)

API_PREFIXES = ('api/', 'auth/', 'hr/')


@bp.get('/', defaults={'path': ''})
@bp.get('/<path:path>')
def serve(path):
    if path.startswith(API_PREFIXES):
        raise ApiError('Not found', 404)

    build_dir = os.path.abspath(current_app.config['FRONTEND_BUILD_DIR'])
    if not os.path.exists(os.path.join(build_dir, 'index.html')):
        raise ApiError('Frontend build not found. Run `npm run build` in /frontend, '
                       'or use the dev server on port 3000.', 404)

    if path and os.path.isfile(os.path.join(build_dir, path)):
        return send_from_directory(build_dir, path)
    return send_from_directory(build_dir, 'index.html')
