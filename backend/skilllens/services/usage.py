"""API usage and cost for the admin dashboard.

Everything here comes from the api_usage table, which already counts every call to a paid or
quota-limited service per day (see quota.py), plus Apify's own account limits for real dollars.
"""
import logging
import time
from datetime import date, datetime, timedelta

from flask import current_app
from sqlalchemy import func, select

from models.database import ApiUsage, JobSourceResult

from ..extensions import db
from . import gemini, maintenance
from .jobs import sources
from .jobs.common import SourceError, request_json

logger = logging.getLogger(__name__)

DAYS = 14
APIFY_CACHE_SECONDS = 10 * 60
_apify_cache = {}  # token -> (time fetched, result)


def _counts(since):
    """{provider: {day: calls}} for site-wide buckets since `since` (per-user buckets are summed)."""
    out = {}
    rows = db.session.execute(
        select(ApiUsage.provider, ApiUsage.day, ApiUsage.calls).where(ApiUsage.day >= since)).all()
    for provider, day, calls in rows:
        if provider.startswith('gemini-user-'):
            provider = 'gemini-users'
        elif provider.startswith('jobsearch-user-'):
            provider = 'job-searches'
        bucket = out.setdefault(provider, {})
        bucket[day] = bucket.get(day, 0) + calls
    return out


def _sum(days, since):
    return sum(calls for day, calls in (days or {}).items() if day >= since)


def apify_account(token):
    """Apify's own numbers for this month: dollars used and the plan's limit. Cached for 10 minutes."""
    cached = _apify_cache.get(token)
    if cached and time.time() - cached[0] < APIFY_CACHE_SECONDS:
        return cached[1]
    try:
        data = request_json('https://api.apify.com/v2/users/me/limits',
                            headers={'Authorization': f'Bearer {token}'}, timeout=10).get('data') or {}
        cycle = data.get('monthlyUsageCycle') or {}
        result = {
            'used_usd': round(float((data.get('current') or {}).get('monthlyUsageUsd') or 0), 3),
            'limit_usd': float((data.get('limits') or {}).get('maxMonthlyUsageUsd') or 0) or None,
            'cycle_start': cycle.get('startAt'),
            'cycle_end': cycle.get('endAt'),
        }
    except (SourceError, ValueError, TypeError, AttributeError) as exc:
        result = {'error': getattr(exc, 'message', None) or 'Could not read Apify usage.'}
    _apify_cache[token] = (time.time(), result)
    return result


def _last_errors(since):
    """The latest error message per job source in the last week."""
    latest = (select(JobSourceResult.source, func.max(JobSourceResult.id).label('id'))
              .where(JobSourceResult.status == 'error', JobSourceResult.started_at >= since)
              .group_by(JobSourceResult.source).subquery())
    rows = db.session.execute(
        select(JobSourceResult.source, JobSourceResult.error, JobSourceResult.finished_at)
        .join(latest, JobSourceResult.id == latest.c.id)).all()
    return {source: {'message': error, 'at': at.isoformat() if at else None} for source, error, at in rows}


def overview():
    cfg = current_app.config
    today = date.today()
    month_start = today.replace(day=1)
    since = min(month_start, today - timedelta(days=DAYS - 1))
    counts = _counts(since)
    days = [today - timedelta(days=i) for i in range(DAYS - 1, -1, -1)]
    errors = _last_errors(datetime.utcnow() - timedelta(days=7))

    job_sources = []
    for name, src in sources.SOURCES.items():
        used = counts.get(f'jobs-{name}', {})
        job_sources.append({
            'name': name, 'label': src.label, 'group': src.group, 'cost': src.cost,
            'configured': sources.configured(src),
            'needs': [k for k in src.needs if not cfg.get(k)],
            'disabled': name in (cfg.get('JOB_SOURCES_DISABLED') or []),
            'today': used.get(today, 0), 'daily_limit': sources.daily_limit(src),
            'month': _sum(used, month_start), 'last_error': errors.get(name),
        })

    gemini_days = counts.get('gemini', {})
    apify_runs = sum(_sum(counts.get(f'jobs-{n}', {}), month_start) for n in sources.SOURCES if n.startswith('apify_'))
    return {
        'gemini': {
            'configured': gemini.configured(),
            'models': list(cfg.get('GEMINI_MODELS') or []),
            'today': gemini_days.get(today, 0),
            'daily_limit': int(cfg.get('AI_DAILY_LIMIT', 40)),
            'user_daily_limit': int(cfg.get('AI_USER_DAILY_LIMIT', 10)),
            'month': _sum(gemini_days, month_start),
        },
        'apify': {
            'configured': bool(cfg.get('APIFY_TOKEN')),
            'runs_this_month': apify_runs,
            'max_usd_per_run': float(cfg.get('APIFY_MAX_USD_PER_RUN') or 0.15),
            **(apify_account(cfg['APIFY_TOKEN']) if cfg.get('APIFY_TOKEN') else {}),
        },
        'job_searches': {
            'today': counts.get('job-searches', {}).get(today, 0),
            'month': _sum(counts.get('job-searches', {}), month_start),
            'user_daily_limit': int(cfg.get('JOB_SEARCH_USER_DAILY_LIMIT') or 30),
        },
        'sources': job_sources,
        'storage': maintenance.storage(),
        'daily': [{
            'day': d.isoformat(),
            'gemini': gemini_days.get(d, 0),
            'job_sources': sum(v.get(d, 0) for k, v in counts.items() if k.startswith('jobs-')),
        } for d in days],
    }
