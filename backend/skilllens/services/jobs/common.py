"""Shared helpers for job sources: HTTP, cleaning text, places, salary and experience.

Every source turns its own format into one job shape (see `make_job`), so ranking, de-duplication
and the jobs page never need to know where a job came from.
"""
import html
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone

from models import india_data, skills_taxonomy
from models.resume_analyzer import INDIAN_CITIES

USER_AGENT = 'SkillLens/1.0 (career platform; job search)'
DESCRIPTION_CHARS = 3500


class SourceError(Exception):
    """A source could not answer. `message` is safe to show to users."""

    def __init__(self, message, status=None):
        super().__init__(message)
        self.message = message
        self.status = status


def request_json(url, method='GET', params=None, body=None, headers=None, timeout=20):
    if params:
        url += ('&' if '?' in url else '?') + urllib.parse.urlencode({k: v for k, v in params.items() if v not in (None, '')})
    data = json.dumps(body).encode('utf-8') if body is not None else None
    head = {'User-Agent': USER_AGENT, 'Accept': 'application/json', **(headers or {})}
    if data is not None:
        head['Content-Type'] = 'application/json'
    req = urllib.request.Request(url, data=data, method=method, headers=head)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:  # noqa: S310 (fixed https hosts)
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as exc:
        detail = ''
        try:
            detail = exc.read().decode('utf-8', 'ignore')[:300]
        except Exception:  # noqa: BLE001
            pass
        if exc.code in (401, 403):
            raise SourceError('The API key was rejected. Check it in backend/.env.', exc.code)
        if exc.code == 402:
            raise SourceError('The free credit for this source is used up.', exc.code)
        if exc.code == 429:
            raise SourceError('This source is rate limiting us. Try again later.', exc.code)
        raise SourceError(f'The source answered with an error ({exc.code}). {detail[:120]}'.strip(), exc.code)
    except (urllib.error.URLError, TimeoutError) as exc:
        raise SourceError(f'Could not reach the source ({getattr(exc, "reason", exc)}).')
    except ValueError:
        raise SourceError('The source sent back something that is not JSON.')


# ----- text -----

def plain(markup, limit=DESCRIPTION_CHARS):
    """Readable text from HTML (some sources escape it twice, like Greenhouse)."""
    text = str(markup or '')
    if '&lt;' in text:
        text = html.unescape(text)
    text = re.sub(r'(?i)<br\s*/?>|</p>|</li>|</div>|</h\d>', '\n', text)
    text = re.sub(r'(?i)<li[^>]*>', '\n- ', text)
    text = html.unescape(re.sub(r'<[^>]+>', ' ', text))
    text = re.sub(r'[ \t\u00a0]+', ' ', text)
    text = re.sub(r'\n\s*\n+', '\n', text).strip()
    return text[:limit]


def norm_key(text):
    return re.sub(r'[^a-z0-9]+', ' ', str(text or '').lower()).strip()


# Text that was UTF-8 encoded twice, which some feeds send (Remote OK): "Sothebyâ\x80\x99s" for "Sotheby's",
# "fÃ¼r" for "für". A lead byte (Â to ô) followed by continuation bytes, read as Latin-1 or Windows-1252.
_CP1252_HIGH = '\u20ac\u201a\u0192\u201e\u2026\u2020\u2021\u02c6\u2030\u0160\u2039\u0152\u017d\u2018\u2019\u201c\u201d\u2022\u2013\u2014\u02dc\u2122\u0161\u203a\u0153\u017e\u0178'
_MOJIBAKE_RE = re.compile(f'[\u00c2-\u00f4](?:[\u0080-\u00bf]|[{_CP1252_HIGH}])+')


def _as_byte(ch):
    return bytes([ord(ch)]) if ord(ch) < 256 else ch.encode('cp1252')


def fix_mojibake(text):
    """Repair double-encoded UTF-8. Text that is already correct is returned unchanged."""
    if not text or not _MOJIBAKE_RE.search(text):
        return text

    def repair(match):
        try:
            return b''.join(_as_byte(ch) for ch in match.group()).decode('utf-8')
        except UnicodeError:
            return match.group()  # a real "Â" or "Ã" followed by a symbol, not broken text
    return _MOJIBAKE_RE.sub(repair, text)


# ----- places -----

_CITY_NAMES = sorted(set(INDIAN_CITIES) | {v for v in india_data.CITY_ALIASES.values()} | {k.title() for k in india_data.CITY_ALIASES}, key=len, reverse=True)
_CITY_RE = re.compile(r'(?i)\b(' + '|'.join(re.escape(c) for c in _CITY_NAMES) + r')\b')
_INDIA_RE = re.compile(r'(?i)\b(india|bharat)\b')
_REMOTE_RE = re.compile(r'(?i)\b(remote|work from home|wfh|anywhere|distributed)\b')
_OPEN_TO_INDIA_RE = re.compile(r'(?i)\b(worldwide|anywhere|global|globally|asia|apac|asia[- ]pacific|india|south asia|international)\b')
_ONLY_ELSEWHERE_RE = re.compile(r'(?i)\b(us|usa|u\.s\.|united states|canada|uk|united kingdom|europe|eu|emea|latam|latin america|australia|germany|brazil|mexico)\b')
_FILLER = set('location locations not stated only based first friendly from in within the of time zone timezone hours '
              'overlap job position candidates and or any home office your fully full partially'.split())


def canonical_city(name):
    """'Bangalore' -> 'Bengaluru', 'Gurgaon' -> 'Gurugram'. Unknown names are returned title-cased."""
    raw = str(name or '').strip()
    return india_data.CITY_ALIASES.get(raw.lower(), raw.title() if raw.islower() else raw)


def city_in(text):
    """First Indian city named in a location string, in its canonical spelling, or ''."""
    m = _CITY_RE.search(str(text or ''))
    return canonical_city(m.group(1)) if m else ''


def place(location, remote=None, country=''):
    """(city, in_india, remote, open_to_india) for a location string.

    open_to_india is True for Indian locations, False for places clearly elsewhere, and None when a
    remote job does not say where candidates may live.
    """
    text = f'{location or ""} {country or ""}'
    city = city_in(text)
    india = bool(city or _INDIA_RE.search(text) or str(country).upper() in ('IN', 'IND'))
    is_remote = bool(remote) or bool(_REMOTE_RE.search(str(location or '')))
    if india or (is_remote and _OPEN_TO_INDIA_RE.search(text)):
        open_to = True
    elif is_remote:
        # "Remote, Poland" or "Remote - US" name somewhere else; a bare "Remote" says nothing
        rest = re.sub(r'[^a-z ]+', ' ', _REMOTE_RE.sub(' ', f'{location or ""} {country or ""}'.lower())).split()
        open_to = False if [w for w in rest if w not in _FILLER] or _ONLY_ELSEWHERE_RE.search(text) else None
    else:
        open_to = False
    return city, india, is_remote, open_to


# ----- dates, salary, experience -----

def iso_date(value):
    """ISO date string from a timestamp (s or ms), an ISO string or a 'YYYY-MM-DD' date. None if unknown."""
    if value in (None, '', 0):
        return None
    try:
        if isinstance(value, (int, float)) or (isinstance(value, str) and value.isdigit()):
            number = float(value)
            if number > 1e11:  # milliseconds
                number /= 1000
            return datetime.fromtimestamp(number, tz=timezone.utc).date().isoformat()
        text = str(value).strip().replace('Z', '+00:00')
        return datetime.fromisoformat(text[:25] if 'T' in text else text[:10]).date().isoformat()
    except (ValueError, OverflowError, OSError):
        m = re.search(r'(20\d{2})-(\d{2})-(\d{2})', str(value))
        return f'{m.group(1)}-{m.group(2)}-{m.group(3)}' if m else None


def days_old(posted):
    if not posted:
        return None
    try:
        return max(0, (datetime.now(timezone.utc).date() - datetime.fromisoformat(posted).date()).days)
    except ValueError:
        return None


_YEARS_RE = re.compile(
    r'(?i)(\d{1,2})\s*(?:\+|plus)?\s*(?:-|to|–)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+\w+){0,3}?\s*(?:experience|exp)?')


def experience_from(text):
    """{'min', 'max'} years from text such as '3-5 years' or '2+ yrs of experience', or None."""
    for m in _YEARS_RE.finditer(str(text or '')[:3000]):
        lo = int(m.group(1))
        hi = int(m.group(2)) if m.group(2) else None
        if lo <= 25 and (hi is None or lo <= hi <= 30):
            return {'min': lo, 'max': hi}
    return None


def salary(minimum=None, maximum=None, currency=None, period=None, text=None):
    """Salary dict, or None when nothing useful is known."""
    def num(v):
        try:
            v = float(str(v).replace(',', ''))
            return int(v) if v > 0 else None
        except (TypeError, ValueError):
            return None
    lo, hi = num(minimum), num(maximum)
    text = (str(text).strip() if text else '') or None
    if not lo and not hi and not text:
        return None
    return {'min': lo, 'max': hi or lo, 'currency': (currency or '').upper() or None, 'period': period or None, 'text': text}


# ----- the one job shape -----

def make_job(source, native_id, title, company, url, location='', description='', posted=None, remote=None,
             country='', salary_info=None, experience=None, employment_type='', tags=(), via='', work_mode=''):
    title = fix_mojibake(re.sub(r'\s+', ' ', str(title or '')).strip())
    company = fix_mojibake(re.sub(r'\s+', ' ', str(company or '')).strip())
    location = fix_mojibake(str(location or ''))
    if not title or not url:
        return None
    description = plain(description) if description and '<' in str(description) else str(description or '')[:DESCRIPTION_CHARS]
    description = fix_mojibake(description)
    city, india, is_remote, open_to = place(location, remote, country)
    if not work_mode:
        work_mode = 'Remote' if is_remote else ('Hybrid' if re.search(r'(?i)\bhybrid\b', f'{location} {title}') else 'On-site')
    tags = [str(t).strip() for t in tags or [] if str(t).strip()][:30]
    keys = list(dict.fromkeys(
        [k for k in (skills_taxonomy.key_for(t) for t in tags) if k]
        + [k for _, _, k in skills_taxonomy.scan(f'{title}\n{description}')]))
    return {
        'id': f'{source}:{native_id}',
        'source': source,
        'via': via,
        'title': title,
        'company': company or 'Company not named',
        'location': re.sub(r'\s+', ' ', str(location or '')).strip() or ('Remote' if is_remote else ''),
        'city': city,
        'in_india': india,
        'open_to_india': open_to,
        'remote': is_remote,
        'work_mode': work_mode,
        'url': url,
        'posted': iso_date(posted),
        'description': description,
        'salary': salary_info,
        'experience': experience or experience_from(f'{title}\n{description}'),
        'employment_type': str(employment_type or '').replace('_', ' ').strip().lower(),
        'skill_keys': keys,
    }
