"""Resume file storage.

Every upload is saved under a random name inside a per-user folder:
    <UPLOAD_FOLDER>/users/<user_id>/<uuid>.pdf
so two users uploading "Resume.pdf" can never overwrite or delete each other's files.
The database stores the path relative to UPLOAD_FOLDER.

The PDF bytes are also saved in the stored_files table. Free hosts wipe the disk on restart, so
when a disk copy is missing it is written back from the database before it is read.
"""
import os
import uuid

from flask import current_app
from werkzeug.utils import secure_filename

from models.database import StoredFile

from ..errors import ApiError
from ..extensions import db

PDF_MAGIC = b'%PDF-'


def _root():
    return os.path.abspath(current_app.config['UPLOAD_FOLDER'])


def original_name(file_storage):
    """Sanitised original filename, used for display only."""
    name = secure_filename(file_storage.filename or '') or 'resume.pdf'
    return name[-255:]


def validate_pdf(file_storage):
    if file_storage is None or not file_storage.filename:
        raise ApiError('No file selected', 400)
    if not file_storage.filename.lower().endswith('.pdf'):
        raise ApiError('Only PDF files are allowed', 400)
    head = file_storage.stream.read(len(PDF_MAGIC))
    file_storage.stream.seek(0)
    if head != PDF_MAGIC:
        raise ApiError('File is not a valid PDF', 400)


def save_pdf(file_storage, user_id, subfolder=None):
    """Validate and save an uploaded PDF. Returns the stored relative path.

    The database copy is added to the session; it is saved when the caller commits.
    """
    validate_pdf(file_storage)
    parts = ['users', str(int(user_id))] + ([subfolder] if subfolder else [])
    relative = '/'.join(parts + [f'{uuid.uuid4().hex}.pdf'])
    absolute = resolve(relative)
    os.makedirs(os.path.dirname(absolute), exist_ok=True)
    file_storage.save(absolute)
    with open(absolute, 'rb') as saved:
        db.session.add(StoredFile(path=relative, data=saved.read()))
    return relative


def resolve(relative):
    """Absolute path for a stored file, refusing anything outside the upload folder."""
    root = _root()
    absolute = os.path.abspath(os.path.join(root, relative))
    if os.path.commonpath([root, absolute]) != root:
        raise ApiError('Invalid file path', 400)
    return absolute


def delete(relative):
    """Remove a stored file from the database and the disk."""
    if not relative:
        return
    absolute = resolve(relative)
    StoredFile.query.filter_by(path=relative).delete()
    db.session.commit()
    if os.path.exists(absolute):
        os.remove(absolute)


def _local(relative):
    """Absolute path of a stored file, writing the disk copy back from the database if it is gone."""
    absolute = resolve(relative)
    if not os.path.exists(absolute):
        stored = db.session.get(StoredFile, relative)
        if stored is not None:
            os.makedirs(os.path.dirname(absolute), exist_ok=True)
            with open(absolute, 'wb') as restored:
                restored.write(stored.data)
    return absolute


def resume_path(resume):
    """Absolute path of a Resume's file, including files uploaded before unique storage."""
    return _local(resume.stored_filename or resume.filename)


def profile_resume_path(user):
    """Absolute path of a user's profile resume, including pre-migration uploads."""
    if user.profile_resume_path:
        return _local(user.profile_resume_path)
    if user.profile_resume_filename:
        return resolve(os.path.join('profile_resumes', user.profile_resume_filename))
    return None
