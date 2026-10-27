"""Sign in with Google (OpenID Connect, authorization code flow with PKCE). No extra package is needed.

1. /auth/google/start sends the browser to Google with a random `state`, a `nonce` and a PKCE
   challenge. Those are kept in a signed, httpOnly cookie that lives 10 minutes.
2. Google sends the browser back to /auth/google/callback with a one-time code.
3. The server swaps the code for the person's ID token directly with Google over HTTPS (with the
   client secret and the PKCE verifier), so the token cannot be faked on the way.
4. The token is checked: our client id, Google as issuer, not expired, our nonce, a verified email.
5. The person is matched by Google's permanent id, then by email (a Google-verified email links to an
   existing SkillLens account). New people get an account straight away.

The admin always signs in with email, password and the authenticator code, never with Google.
"""
import base64
import hashlib
import json
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

from flask import current_app, request
from itsdangerous import BadSignature, URLSafeTimedSerializer

AUTHORIZE_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
TOKEN_URL = 'https://oauth2.googleapis.com/token'
ISSUERS = ('https://accounts.google.com', 'accounts.google.com')
COOKIE = 'skilllens_google'
COOKIE_SECONDS = 10 * 60


class GoogleError(Exception):
    """`code` becomes ?error=google_<code> on the sign-in page, which shows a matching message."""

    def __init__(self, code, detail=''):
        super().__init__(detail or code)
        self.code = code
        self.detail = detail


def configured():
    cfg = current_app.config
    return bool(cfg.get('GOOGLE_CLIENT_ID') and cfg.get('GOOGLE_CLIENT_SECRET'))


def redirect_uri():
    return current_app.config.get('GOOGLE_REDIRECT_URI') or (request.url_root.rstrip('/') + '/auth/google/callback')


def _serializer():
    return URLSafeTimedSerializer(current_app.config['JWT_SECRET_KEY'], salt='skilllens-google-sign-in')


def _b64(data):
    return base64.urlsafe_b64encode(data).rstrip(b'=').decode('ascii')


def start(mode):
    """(Google URL to send the browser to, signed cookie value)."""
    state, nonce, verifier = secrets.token_urlsafe(24), secrets.token_urlsafe(24), secrets.token_urlsafe(48)
    params = {
        'client_id': current_app.config['GOOGLE_CLIENT_ID'],
        'redirect_uri': redirect_uri(),
        'response_type': 'code',
        'scope': 'openid email profile',
        'state': state,
        'nonce': nonce,
        'code_challenge': _b64(hashlib.sha256(verifier.encode('ascii')).digest()),
        'code_challenge_method': 'S256',
        'prompt': 'select_account',
    }
    cookie = _serializer().dumps({'state': state, 'nonce': nonce, 'verifier': verifier, 'mode': mode})
    return f'{AUTHORIZE_URL}?{urllib.parse.urlencode(params)}', cookie


def _decode_id_token(token):
    try:
        payload = token.split('.')[1]
        return json.loads(base64.urlsafe_b64decode(payload + '=' * (-len(payload) % 4)))
    except (IndexError, ValueError):
        raise GoogleError('failed', 'Unreadable ID token')


def finish(args, cookie):
    """Check Google's answer and return the person's verified identity, plus what the start asked for."""
    if args.get('error'):
        raise GoogleError('cancelled', args.get('error'))
    try:
        saved = _serializer().loads(cookie or '', max_age=COOKIE_SECONDS)
    except BadSignature:
        raise GoogleError('state', 'Missing or expired sign-in cookie')
    if not secrets.compare_digest(str(args.get('state', '')), saved['state']) or not args.get('code'):
        raise GoogleError('state', 'State does not match')

    body = urllib.parse.urlencode({
        'code': args['code'], 'client_id': current_app.config['GOOGLE_CLIENT_ID'],
        'client_secret': current_app.config['GOOGLE_CLIENT_SECRET'], 'redirect_uri': redirect_uri(),
        'grant_type': 'authorization_code', 'code_verifier': saved['verifier'],
    }).encode('ascii')
    try:
        req = urllib.request.Request(TOKEN_URL, data=body, method='POST',
                                     headers={'Content-Type': 'application/x-www-form-urlencoded'})
        with urllib.request.urlopen(req, timeout=15) as response:  # noqa: S310 (fixed https host)
            tokens = json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode('utf-8', 'ignore')[:200]
        raise GoogleError('failed', f'Token exchange failed ({exc.code}): {detail}')
    except (urllib.error.URLError, TimeoutError, ValueError) as exc:
        raise GoogleError('failed', f'Could not reach Google: {exc}')

    # The token came straight from Google over HTTPS, so its claims are checked rather than its signature
    claims = _decode_id_token(tokens.get('id_token', ''))
    if claims.get('aud') != current_app.config['GOOGLE_CLIENT_ID'] or claims.get('iss') not in ISSUERS:
        raise GoogleError('failed', 'ID token is for another app')
    if int(claims.get('exp', 0)) < time.time() - 60:
        raise GoogleError('failed', 'ID token expired')
    if not secrets.compare_digest(str(claims.get('nonce', '')), saved['nonce']):
        raise GoogleError('failed', 'Nonce does not match')
    if not claims.get('email') or claims.get('email_verified') not in (True, 'true'):
        raise GoogleError('unverified', 'Google email not verified')
    return {
        'sub': str(claims['sub']),
        'email': claims['email'].strip().lower(),
        'name': (claims.get('name') or '').strip()[:100],
        'mode': saved.get('mode'),
    }
