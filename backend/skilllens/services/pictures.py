"""Profile photos: uploaded on the Profile page, or copied from Google when someone signs in with Google.

The image is kept in the stored_files table under users/<id>/picture/, so it survives the free host
wiping its disk and is deleted with the account. Only the signed-in owner can load it
(GET /profile/picture); there is no public link to it.

The Profile page crops photos to a small square before uploading, which also drops hidden photo
details such as where it was taken. The server still checks the file really is an image.
"""
import logging
import re
import urllib.parse
import urllib.request
import uuid
from datetime import datetime

from models.database import StoredFile

from ..errors import ApiError
from ..extensions import db

logger = logging.getLogger(__name__)

MAX_BYTES = 2 * 1024 * 1024
MIME = {'jpg': 'image/jpeg', 'png': 'image/png', 'webp': 'image/webp'}


def image_kind(data):
    """'jpg', 'png' or 'webp' from the file's first bytes (not its name), or None."""
    if data.startswith(b'\xff\xd8\xff'):
        return 'jpg'
    if data.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    if data[:4] == b'RIFF' and data[8:12] == b'WEBP':
        return 'webp'
    return None


def _save(user, data, source):
    kind = image_kind(data)
    if kind is None:
        raise ApiError('Use a JPG, PNG or WebP photo.', 400)
    if len(data) > MAX_BYTES:
        raise ApiError('The photo is larger than 2 MB. Pick a smaller one.', 413)
    old = user.picture_path
    path = f'users/{int(user.id)}/picture/{uuid.uuid4().hex}.{kind}'
    db.session.add(StoredFile(path=path, data=data))
    if old:
        StoredFile.query.filter_by(path=old).delete()
    user.picture_path = path
    user.picture_source = source
    user.picture_updated_at = datetime.utcnow()
    db.session.commit()
    return user


def save_upload(user, file_storage):
    if file_storage is None or not file_storage.filename:
        raise ApiError('No photo selected', 400)
    return _save(user, file_storage.read(MAX_BYTES + 1), 'upload')


def remove(user):
    if user.picture_path:
        StoredFile.query.filter_by(path=user.picture_path).delete()
    user.picture_path = None
    user.picture_source = 'removed'  # so the next Google sign-in does not add the Google photo back
    user.picture_updated_at = datetime.utcnow()
    db.session.commit()


def load(user):
    """(bytes, mime type) of the user's photo, or raise 404."""
    stored = db.session.get(StoredFile, user.picture_path) if user.picture_path else None
    if stored is None:
        raise ApiError('No profile photo', 404)
    return stored.data, MIME.get(user.picture_path.rsplit('.', 1)[-1], 'application/octet-stream')


def copy_from_google(user, url):
    """Save the person's Google photo, unless they already have a photo or removed theirs.

    Sign-in must never fail because of a photo, so problems are only logged.
    """
    if not url or user.picture_path or user.picture_source == 'removed':
        return
    parts = urllib.parse.urlsplit(url)
    if parts.scheme != 'https' or not (parts.hostname or '').endswith('.googleusercontent.com'):
        return
    # Google picks the size from the end of the link ("=s96-c" is 96 px); ask for 256 px instead
    url = re.sub(r'=s\d+(-c)?$', '=s256-c', url)
    try:
        request = urllib.request.Request(url, headers={'User-Agent': 'SkillLens'})
        with urllib.request.urlopen(request, timeout=5) as response:  # noqa: S310 (Google host checked above)
            data = response.read(MAX_BYTES + 1)
        _save(user, data, 'google')
    except Exception as exc:  # noqa: BLE001
        db.session.rollback()
        logger.warning('Could not copy the Google photo for user %s: %s', user.id, exc)
