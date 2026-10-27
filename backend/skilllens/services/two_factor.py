"""Two-factor sign-in for the admin, with a free authenticator app (Google Authenticator, Microsoft
Authenticator, Authy...). Codes follow the TOTP standard: a new 6-digit code every 30 seconds.

Setting it up:  the admin scans a QR code, types the first code to prove it works, and gets 8
                one-time recovery codes for the day the phone is lost.
Signing in:     the right email and password give a short "challenge" (valid 5 minutes) instead of a
                session; the code from the app (or a recovery code) turns it into a session.
Safety:         a code works once, wrong codes are limited per day, and the secret never leaves the
                server again after setup.
"""
import hashlib
import hmac
import json
import re
import secrets
import time
from datetime import datetime

import pyotp
import segno
from flask import current_app
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from models.database import User

from ..errors import ApiError
from ..extensions import db
from . import quota

ISSUER = 'SkillLens'
CHALLENGE_SECONDS = 5 * 60
RECOVERY_COUNT = 8
WRONG_CODES_PER_DAY = 10


def enabled(user):
    return bool(user.totp_secret and user.totp_enabled_at)


def _hash(code):
    return hashlib.sha256(code.encode('utf-8')).hexdigest()


def _clean(code):
    return re.sub(r'[\s-]', '', str(code or '')).lower()


def _new_recovery_codes(user):
    """Fresh recovery codes, shown once. Only their hashes are kept (they are long and random)."""
    codes = []
    for _ in range(RECOVERY_COUNT):
        raw = secrets.token_hex(5)  # 10 hex characters
        codes.append(f'{raw[:5]}-{raw[5:]}')
    user.recovery_codes = json.dumps([_hash(_clean(c)) for c in codes])
    return codes


def recovery_left(user):
    try:
        return len(json.loads(user.recovery_codes or '[]'))
    except ValueError:
        return 0


def _matching_step(secret, code, last_step):
    """The time step of a valid, not-yet-used code (30 seconds either side is allowed), or None."""
    if not re.fullmatch(r'\d{6}', code):
        return None
    totp = pyotp.TOTP(secret)
    now = int(time.time() // 30)
    for step in (now - 1, now, now + 1):
        if last_step is not None and step <= last_step:
            continue  # already used: a code can never be replayed
        if hmac.compare_digest(totp.at(step * 30), code):
            return step
    return None


def _use_recovery_code(user, code):
    try:
        hashes = json.loads(user.recovery_codes or '[]')
    except ValueError:
        hashes = []
    digest = _hash(code)
    for stored in hashes:
        if hmac.compare_digest(stored, digest):
            hashes.remove(stored)
            user.recovery_codes = json.dumps(hashes)
            return True
    return False


def check_code(user, code, allow_recovery=True):
    """True and records the use when `code` is a valid app code or (optionally) a recovery code.

    Wrong codes are counted per account per day, so guessing is cut off long before it could work.
    """
    bucket = f'2fa-wrong-{user.id}'
    if quota.remaining_today(bucket, WRONG_CODES_PER_DAY) <= 0:
        raise ApiError('Too many wrong codes today. Use a recovery code tomorrow, or ask the server owner to reset two-factor sign-in.', 429)
    code = _clean(code)
    step = _matching_step(user.totp_secret, code, user.totp_last_step) if user.totp_secret else None
    if step is not None:
        user.totp_last_step = step
        db.session.commit()
        return 'app'
    if allow_recovery and _use_recovery_code(user, code):
        db.session.commit()
        return 'recovery'
    quota.take(bucket, WRONG_CODES_PER_DAY)
    return None


# ----- setup -----

def begin_setup(user):
    """A new secret waiting for its first code, with the QR code to scan."""
    if enabled(user):
        raise ApiError('Two-factor sign-in is already on. Turn it off first to move it to another phone.', 409)
    secret = pyotp.random_base32()
    user.totp_pending_secret = secret
    db.session.commit()
    uri = pyotp.TOTP(secret).provisioning_uri(name=user.email, issuer_name=ISSUER)
    qr = segno.make(uri, error='m')
    return {
        'secret': ' '.join(secret[i:i + 4] for i in range(0, len(secret), 4)),
        'otpauth_uri': uri,
        'qr': qr.svg_data_uri(scale=6, border=2, dark='#1d1d1f'),
    }


def finish_setup(user, code):
    if not user.totp_pending_secret:
        raise ApiError('Start the setup first.', 400)
    step = _matching_step(user.totp_pending_secret, _clean(code), None)
    if step is None:
        raise ApiError('That code is not right. Check the time on your phone is set automatically, then try the newest code.', 400)
    user.totp_secret = user.totp_pending_secret
    user.totp_pending_secret = None
    user.totp_enabled_at = datetime.utcnow()
    user.totp_last_step = step
    codes = _new_recovery_codes(user)
    db.session.commit()
    return codes


def disable(user):
    user.totp_secret = user.totp_pending_secret = user.recovery_codes = None
    user.totp_enabled_at = user.totp_last_step = None
    db.session.commit()


def regenerate_recovery_codes(user):
    codes = _new_recovery_codes(user)
    db.session.commit()
    return codes


def status(user):
    return {
        'enabled': enabled(user),
        'enabled_at': user.totp_enabled_at.isoformat() if user.totp_enabled_at else None,
        'recovery_codes_left': recovery_left(user) if enabled(user) else 0,
    }


# ----- the sign-in challenge -----

def _serializer():
    return URLSafeTimedSerializer(current_app.config['JWT_SECRET_KEY'], salt='skilllens-two-factor')


def make_challenge(user):
    return _serializer().dumps({'uid': user.id, 'sv': user.session_version or 0})


def read_challenge(token):
    try:
        data = _serializer().loads(token or '', max_age=CHALLENGE_SECONDS)
    except SignatureExpired:
        raise ApiError('That took too long. Sign in again.', 401)
    except BadSignature:
        raise ApiError('Sign in again.', 401)
    user = db.session.get(User, int(data.get('uid', 0)))
    if user is None or user.blocked_at is not None or (user.session_version or 0) != data.get('sv'):
        raise ApiError('Sign in again.', 401)
    return user
