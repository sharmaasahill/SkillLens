"""Public facts the frontend needs before anyone signs in."""
from flask import Blueprint, current_app, jsonify

from ..services import google_auth

bp = Blueprint('site', __name__, url_prefix='/api')


@bp.get('/site')
def site_info():
    cfg = current_app.config
    return jsonify({
        'google_sign_in': google_auth.configured(),
        'contact_email': cfg.get('CONTACT_EMAIL') or None,
        'privacy_version': cfg.get('PRIVACY_VERSION'),
    })
