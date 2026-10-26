"""Live job search across every configured source.

1. A search starts every chosen source in the background and returns at once with a search id.
2. The jobs page asks for the search every second or so, and shows jobs as each source finishes.
   Scrapers take up to two minutes; APIs take a few seconds.
3. Results are cached per source and query (12 hours for paid sources, 1 to 6 hours for free ones),
   and shared between users, so the same search does not spend a source's free quota twice.
4. Each source has a daily cap, counted in the database. A capped source is skipped, not failed.
5. Jobs are de-duplicated (one entry per company and title) and ranked against the user's primary
   resume when the results are read, so ranking is always personal and costs nothing.
"""
import hashlib
import json
import logging
import traceback
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta

from flask import current_app

from models.database import JobSearch, JobSourceResult

from ...errors import ApiError
from ...extensions import db
from .. import error_log, quota
from . import ranking, sources
from .common import SourceError, canonical_city, norm_key

logger = logging.getLogger(__name__)

STALE_AFTER = timedelta(minutes=6)  # a source still "running" after this is treated as failed
MAX_JOBS_SHOWN = 150
_pool = ThreadPoolExecutor(max_workers=8, thread_name_prefix='job-source')


def _query_key(name, search):
    raw = '|'.join([name, norm_key(search['role']), norm_key(search['city']), str(search['days']), str(bool(search['remote_only']))])
    return hashlib.sha256(raw.encode('utf-8')).hexdigest()


def _user_limit():
    return int(current_app.config.get('JOB_SEARCH_USER_DAILY_LIMIT') or 30)


def source_list(user=None):
    """Every source with whether it is set up and how many searches it has left today."""
    out = []
    boards = sources.boards_count()
    for name, src in sources.SOURCES.items():
        ready = sources.configured(src)
        limit = sources.daily_limit(src)
        covers = src.covers + (f' ({boards[name]} companies)' if name in boards else '')
        out.append({
            'name': name, 'label': src.label, 'group': src.group, 'covers': covers, 'cost': src.cost,
            'configured': ready, 'needs': [k for k in src.needs if not current_app.config.get(k)],
            'daily_limit': limit, 'remaining_today': quota.remaining_today(f'jobs-{name}', limit) if ready else 0,
            'attribution': {'name': src.attribution[0], 'url': src.attribution[1]},
        })
    return out


def start(user, role, city=None, days=14, remote_only=False, wanted=None):
    search = {'role': role.strip(), 'city': canonical_city(city) if city else '', 'days': int(days), 'remote_only': bool(remote_only)}
    names = [n for n in (wanted or sources.SOURCES) if n in sources.SOURCES and sources.configured(sources.SOURCES[n])]
    if not names:
        raise ApiError('Choose at least one job source that is set up.', 400)
    if not quota.take(f'jobsearch-user-{user.id}', _user_limit()):
        raise ApiError(f'You have run {_user_limit()} job searches today. Try again tomorrow.', 429)

    now = datetime.utcnow()
    results, to_run = {}, []
    for name in names:
        src = sources.SOURCES[name]
        key = _query_key(name, search)
        fresh = (JobSourceResult.query
                 .filter(JobSourceResult.source == name, JobSourceResult.query_key == key,
                         JobSourceResult.started_at >= now - timedelta(hours=src.cache_hours))
                 .filter(JobSourceResult.status.in_(('done', 'running')))
                 .order_by(JobSourceResult.started_at.desc()).first())
        if fresh is not None and not (fresh.status == 'running' and now - fresh.started_at > STALE_AFTER):
            results[name] = fresh.id  # cached or already being fetched for someone else: free
            continue
        if not quota.take(f'jobs-{name}', sources.daily_limit(src)):
            results[name] = 'limit'
            continue
        row = JobSourceResult(source=name, query_key=key, status='running', started_at=now)
        db.session.add(row)
        db.session.flush()
        results[name] = row.id
        to_run.append((row.id, name))

    item = JobSearch(id=uuid.uuid4().hex, user_id=user.id, query=json.dumps(search), results=json.dumps(results), created_at=now)
    db.session.add(item)
    db.session.commit()

    app = current_app._get_current_object()
    for row_id, name in to_run:
        if app.config.get('JOB_SEARCH_SYNC'):
            _run(app, row_id, name, search)
        else:
            _pool.submit(_run, app, row_id, name, search)
    return item


def _run(app, row_id, name, search):
    with app.app_context():
        try:
            jobs, error = sources.fetch(name, search), None
        except SourceError as exc:
            jobs, error = [], exc.message
            # Quota and rate limits are expected now and then; anything else needs a look
            level = 'warning' if exc.status in (402, 429) else 'error'
            error_log.record('service', f'job:{name}', f'{sources.SOURCES[name].label}: {exc.message}',
                             status=exc.status, level=level)
        try:
            row = db.session.get(JobSourceResult, row_id)
            if row is None:
                return
            row.status = 'error' if error else 'done'
            row.error = (error or '')[:300] or None
            row.jobs = json.dumps(jobs)
            row.finished_at = datetime.utcnow()
            db.session.commit()
        except Exception as exc:  # noqa: BLE001 - a background thread has nobody to report to
            db.session.rollback()
            logger.exception('Saving results from %s failed', name)
            error_log.record('server', f'job search: {name}', f'{type(exc).__name__}: {exc}',
                             detail=traceback.format_exc())
        finally:
            db.session.remove()


def owned(user, search_id):
    item = db.session.get(JobSearch, search_id)
    if item is None or item.user_id != user.id:
        raise ApiError('Search not found', 404)
    return item


def snapshot(item, have, years):
    """Where every source is, and the jobs found so far ranked against the resume."""
    search = json.loads(item.query)
    links = json.loads(item.results)
    ids = [v for v in links.values() if isinstance(v, int)]
    rows = {r.id: r for r in JobSourceResult.query.filter(JobSourceResult.id.in_(ids)).all()} if ids else {}
    now = datetime.utcnow()
    status, jobs = [], []
    for name, link in links.items():
        src = sources.SOURCES.get(name)
        label = src.label if src else name
        if link == 'limit':
            status.append({'name': name, 'label': label, 'status': 'limit', 'count': 0,
                           'message': "Today's searches for this source are used up."})
            continue
        row = rows.get(link)
        if row is None:
            status.append({'name': name, 'label': label, 'status': 'error', 'count': 0, 'message': 'Result missing.'})
            continue
        state = row.status
        if state == 'running' and now - row.started_at > STALE_AFTER:
            state = 'error'
        found = json.loads(row.jobs or '[]') if state == 'done' else []
        jobs.extend(found)
        status.append({
            'name': name, 'label': label, 'status': state, 'count': len(found),
            'message': row.error if state == 'error' else ('Took too long.' if row.status == 'running' and state == 'error' else ''),
            'cached': row.started_at < item.created_at,  # fetched for an earlier search
        })

    ranked = [ranking.score(j, search['role'], have, years) for j in ranking.dedupe(jobs)]
    ranked.sort(key=lambda j: (-j['match'], j.get('posted') is None, -(int((j.get('posted') or '0').replace('-', '')))))
    attribution = {name: {'name': s.attribution[0], 'url': s.attribution[1]} for name, s in sources.SOURCES.items()}
    return {
        'id': item.id,
        'query': search,
        'sources': status,
        'done': all(s['status'] != 'running' for s in status),
        'total': len(ranked),
        'jobs': ranked[:MAX_JOBS_SHOWN],
        'attribution': attribution,
        'started_at': item.created_at.isoformat() + 'Z',
    }
