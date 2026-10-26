"""Error log for the admin dashboard (no email, no outside service).

Three kinds of problems are recorded:
  server   a request crashed in the API (500), with the traceback
  client   someone's browser hit a JavaScript error, with the stack the browser reported
  service  an outside service failed: a job source, Gemini or Apify

The same error again does not add a row: its count goes up and "last seen" moves on. Errors are
written on their own database connection, so recording one never commits or undoes the work of
the request that failed. Recording can never raise.
"""
import hashlib
import logging
import re
from datetime import datetime, timedelta

from sqlalchemy import delete, func, insert, select, update

from models.database import ErrorLog

from ..extensions import db

logger = logging.getLogger(__name__)

KINDS = ('server', 'client', 'service')
MAX_ROWS = 1000  # oldest fixed errors go first when the log is full
KEEP_FIXED = timedelta(days=30)
DETAIL_CHARS = 8000


def _shape(text):
    """The message without numbers, ids and quoted values, so the same error groups together."""
    text = re.sub(r'0x[0-9a-f]+|[0-9a-f]{8,}', '#', str(text or '').lower())
    text = re.sub(r'\d+', '#', text)
    text = re.sub(r"'[^']*'|\"[^\"]*\"", "'?'", text)
    return re.sub(r'\s+', ' ', text).strip()[:300]


def fingerprint(kind, source, message, where=''):
    raw = '|'.join([kind, source, _shape(message), where])
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def record(kind, source, message, detail='', status=None, path=None, user_id=None, level='error', where=''):
    """Add or count one error. `where` (for example the failing line) helps group server errors."""
    try:
        now = datetime.utcnow()
        values = {
            'kind': kind if kind in KINDS else 'server',
            'level': 'warning' if level == 'warning' else 'error',
            'source': str(source or 'unknown')[:120],
            'message': str(message or 'Unknown error')[:500],
            'detail': str(detail or '')[:DETAIL_CHARS] or None,
            'status': status,
            'path': str(path)[:300] if path else None,
            'user_id': user_id,
        }
        fp = fingerprint(values['kind'], values['source'], values['message'], where)
        table = ErrorLog.__table__
        with db.engine.begin() as conn:
            open_row = conn.execute(
                select(table.c.id).where(table.c.fingerprint == fp, table.c.resolved_at.is_(None)).limit(1)).first()
            if open_row is not None:
                conn.execute(update(table).where(table.c.id == open_row.id).values(
                    count=table.c.count + 1, last_seen=now, **{k: v for k, v in values.items() if k != 'kind'}))
            else:
                conn.execute(insert(table).values(fingerprint=fp, count=1, first_seen=now, last_seen=now, **values))
                _prune(conn, table, now)
    except Exception:  # noqa: BLE001 - logging an error must never cause another one
        logger.exception('Could not record an error in the error log')


def _prune(conn, table, now):
    conn.execute(delete(table).where(table.c.resolved_at.is_not(None), table.c.resolved_at < now - KEEP_FIXED))
    total = conn.execute(select(func.count()).select_from(table)).scalar() or 0
    if total > MAX_ROWS:
        oldest = select(table.c.id).order_by(table.c.resolved_at.is_(None), table.c.last_seen).limit(total - MAX_ROWS)
        conn.execute(delete(table).where(table.c.id.in_(oldest)))


# ----- for the admin dashboard -----

def _entry(row):
    iso = lambda value: value.isoformat() if value else None  # noqa: E731
    return {
        'id': row.id, 'kind': row.kind, 'level': row.level, 'source': row.source, 'message': row.message,
        'detail': row.detail, 'status': row.status, 'path': row.path, 'user_id': row.user_id, 'count': row.count,
        'first_seen': iso(row.first_seen), 'last_seen': iso(row.last_seen), 'resolved_at': iso(row.resolved_at),
    }


def listing(view='open', kind=None, limit=100):
    query = ErrorLog.query.filter(ErrorLog.resolved_at.is_(None) if view == 'open' else ErrorLog.resolved_at.is_not(None))
    if kind in KINDS:
        query = query.filter(ErrorLog.kind == kind)
    rows = query.order_by(ErrorLog.last_seen.desc()).limit(limit).all()
    counts = dict(db.session.execute(
        select(ErrorLog.kind, func.count()).where(ErrorLog.resolved_at.is_(None)).group_by(ErrorLog.kind)).all())
    return {
        'errors': [_entry(r) for r in rows],
        'open_counts': {k: counts.get(k, 0) for k in KINDS},
        'open_total': sum(counts.values()),
    }


def open_total():
    return db.session.scalar(select(func.count(ErrorLog.id)).where(ErrorLog.resolved_at.is_(None))) or 0


def resolve(error_id=None):
    """Mark one error (or every open one) as fixed. If it happens again, it comes back as a new entry."""
    query = ErrorLog.query.filter(ErrorLog.resolved_at.is_(None))
    if error_id is not None:
        query = query.filter(ErrorLog.id == error_id)
    count = query.update({'resolved_at': datetime.utcnow()}, synchronize_session=False)
    db.session.commit()
    return count


def clear_fixed():
    count = ErrorLog.query.filter(ErrorLog.resolved_at.is_not(None)).delete(synchronize_session=False)
    db.session.commit()
    return count
