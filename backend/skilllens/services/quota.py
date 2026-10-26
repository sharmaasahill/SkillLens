"""Daily call budgets for quota-limited outside services (live job APIs, Gemini).

Calls are counted per "bucket" per day in the api_usage table, so server restarts and several
workers share one budget. A bucket is any short name: a provider ("adzuna", "gemini") or a
provider plus a user ("gemini-user-7").
"""
from datetime import date

from sqlalchemy.exc import IntegrityError

from models.database import ApiUsage

from ..extensions import db


def used_today(bucket):
    row = ApiUsage.query.filter_by(provider=bucket, day=date.today()).first()
    return row.calls if row else 0


def remaining_today(bucket, limit):
    return max(0, limit - used_today(bucket))


def take(bucket, limit):
    """Reserve one call for today. False when today's budget is used up.

    A conditional UPDATE is atomic, so two requests at once can never both take the last call.
    """
    today = date.today()
    for _ in range(2):
        updated = (ApiUsage.query.filter(ApiUsage.provider == bucket, ApiUsage.day == today, ApiUsage.calls < limit)
                   .update({'calls': ApiUsage.calls + 1}, synchronize_session=False))
        if updated:
            db.session.commit()
            return True
        if ApiUsage.query.filter_by(provider=bucket, day=today).first():
            db.session.rollback()
            return False  # today's row exists and is full
        try:
            db.session.add(ApiUsage(provider=bucket, day=today, calls=0))
            db.session.commit()
        except IntegrityError:
            db.session.rollback()  # another request created it first; retry the update
    return False


def give_back(bucket):
    """Return a reserved call that never reached the service (for example, it failed before sending)."""
    (ApiUsage.query.filter(ApiUsage.provider == bucket, ApiUsage.day == date.today(), ApiUsage.calls > 0)
     .update({'calls': ApiUsage.calls - 1}, synchronize_session=False))
    db.session.commit()
