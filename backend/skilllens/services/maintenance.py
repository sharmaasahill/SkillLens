"""Keep the database small, so it stays inside Neon's free 1 GB.

What gets deleted, and why it is safe:
  cached job results older than CACHE_KEEP_DAYS (7)  the longest any source is reused is 24 hours
  job searches older than that                        a search page only reads its own results
  daily usage counters older than 120 days            the dashboard shows this month and 14 days

Users' resumes, profiles and saved AI answers are never touched. It runs by itself at most every
six hours while the site is in use (Render's free plan sleeps, so a fixed timer would not fire),
and on demand with `flask --app app cleanup`.
"""
import logging
import os
import threading
import time
from datetime import date, datetime, timedelta

from flask import current_app
from sqlalchemy import delete, func, select, text

from models.database import ApiUsage, JobSearch, JobSourceResult, StoredFile

from ..extensions import db

logger = logging.getLogger(__name__)

EVERY_SECONDS = 6 * 60 * 60
USAGE_KEEP_DAYS = 120
_lock = threading.Lock()
_last_run = 0.0


def cleanup():
    days = int(current_app.config.get('CACHE_KEEP_DAYS', 7))
    before = datetime.utcnow() - timedelta(days=days)
    counts = {
        'cached job results': db.session.execute(
            delete(JobSourceResult).where(JobSourceResult.started_at < before)).rowcount,
        # JobSearch has a column named "query", so the plain delete statement is used
        'job searches': db.session.execute(delete(JobSearch).where(JobSearch.created_at < before)).rowcount,
        'usage counters': db.session.execute(
            delete(ApiUsage).where(ApiUsage.day < date.today() - timedelta(days=USAGE_KEEP_DAYS))).rowcount,
    }
    db.session.commit()
    return counts


def maybe_cleanup():
    """Run the cleanup if it has not run in the last six hours. Never raises."""
    global _last_run
    if time.time() - _last_run < EVERY_SECONDS or not _lock.acquire(blocking=False):
        return
    try:
        _last_run = time.time()
        counts = cleanup()
        if any(counts.values()):
            logger.info('Cleanup: %s', counts)
    except Exception:  # noqa: BLE001 - housekeeping must never break a request
        db.session.rollback()
        logger.exception('Cleanup failed')
    finally:
        _lock.release()


def storage():
    """Database size against the plan's limit, and what takes the space."""
    engine = db.engine
    size = None
    try:
        if engine.url.get_backend_name() == 'postgresql':
            size = db.session.scalar(text('SELECT pg_database_size(current_database())'))
        elif engine.url.database and os.path.exists(engine.url.database):
            size = os.path.getsize(engine.url.database)
    except Exception:  # noqa: BLE001
        size = None
    return {
        'database_bytes': int(size) if size is not None else None,
        'limit_bytes': int(current_app.config.get('DATABASE_LIMIT_MB', 1024)) * 1024 * 1024,
        'resume_files_bytes': int(db.session.scalar(select(func.coalesce(func.sum(func.length(StoredFile.data)), 0))) or 0),
        'resume_files': db.session.scalar(select(func.count()).select_from(StoredFile)) or 0,
        'cached_job_results': db.session.scalar(select(func.count()).select_from(JobSourceResult)) or 0,
        'keep_days': int(current_app.config.get('CACHE_KEEP_DAYS', 7)),
    }
