"""Security headers on every response.

What each one stops, in short:
  Content-Security-Policy   scripts, styles, images and fonts load only from this site, so injected
                            code from elsewhere cannot run; frame-ancestors stops other sites from
                            showing SkillLens inside an invisible frame (clickjacking)
  X-Frame-Options           the same frame protection, for older browsers
  X-Content-Type-Options    browsers never guess a file's type (an upload cannot run as a script)
  Referrer-Policy           other sites see only "skilllens...onrender.com", never full page addresses
  Permissions-Policy        no camera, microphone, location or payment access
  Strict-Transport-Security browsers use HTTPS for a year (sent only over HTTPS)
  Cache-Control: no-store   API answers with personal data are never kept in shared caches

The React build must not inline its startup script (INLINE_RUNTIME_CHUNK=false in the Dockerfile),
because the policy allows scripts from this site's files only.
"""
from flask import request

CSP = '; '.join([
    "default-src 'self'",
    "script-src 'self'",
    # React and the animation library set inline styles; styles cannot run code
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])

def register(app):
    @app.after_request
    def add_security_headers(response):
        if not app.config.get('SECURITY_HEADERS', True):
            return response
        headers = response.headers
        headers.setdefault('Content-Security-Policy', CSP)
        headers.setdefault('X-Frame-Options', 'DENY')
        headers.setdefault('X-Content-Type-Options', 'nosniff')
        headers.setdefault('Referrer-Policy', 'strict-origin-when-cross-origin')
        headers.setdefault('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(), usb=()')
        headers.setdefault('Cross-Origin-Opener-Policy', 'same-origin')

        if request.is_secure:
            headers.setdefault('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
        # Personal data from the API is never stored by browsers' shared caches or proxies
        if response.mimetype == 'application/json' or request.path.startswith(('/api/', '/auth/', '/profile', '/resume')):
            headers.setdefault('Cache-Control', 'no-store')
        return response
