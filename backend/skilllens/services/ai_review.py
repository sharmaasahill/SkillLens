"""AI resume review with Google Gemini, kept honest by checks on our side.

How one review works:

1. Personal details are removed: the name, email, phone numbers and links become [Candidate],
   [email], [phone] and [link]. Google may use free-tier requests to improve its products.
2. One request asks Gemini for: what a recruiter takes away, strengths, rewrites for the weakest
   bullets, likely interview questions and, when a job description is given, which requirements
   the resume covers.
3. The answer is checked before anyone sees it:
   - a "bullet" must really be in the resume, or it is dropped;
   - a rewrite may not add numbers the bullet did not have (missing numbers must be [placeholders]);
   - evidence for a job requirement must be a real quote, or "covered" becomes "partly covered".
4. The checked answer is saved. The same resume and JD again costs nothing.

The ATS score itself never comes from AI, so the same resume always gets the same score.
"""
import hashlib
import json
import re

from flask import current_app

from models.database import AiResult

from ..errors import ApiError
from ..extensions import db
from . import gemini, quota

KIND = 'resume_review'
PROMPT_VERSION = 'review-v1'
MAX_RESUME_CHARS = 14_000
MAX_JD_CHARS = 8_000

SYSTEM = """You are a senior technical recruiter and resume coach who hires for companies in India.
You read resumes the way recruiters and applicant tracking systems do, and you give specific, honest advice.

Rules you must follow:
1. Use only facts that are written in the resume. Never invent employers, tools, numbers, results, dates or titles.
2. When a rewrite needs a number the resume does not give, write a placeholder in square brackets for the candidate
   to fill in, such as [X%], [N users], [Rs X lakh] or [time saved]. Never guess the number.
3. When you quote the resume, copy the words exactly.
4. Speak to the candidate as "you". Use plain, specific English. Avoid buzzwords such as "results-driven",
   "dynamic", "synergy" or "passionate".
5. The resume's name, phone numbers, email and links were replaced with [Candidate], [phone], [email] and [link].
   Do not comment on them."""

BULLET_PROBLEMS = ['no result', 'no number', 'weak verb', 'vague', 'too long', 'jargon', 'passive', 'repeated verb']


def _schema(with_jd):
    text = {'type': 'string'}
    schema = {
        'type': 'object',
        'properties': {
            'recruiter_view': {
                'type': 'object',
                'properties': {
                    'headline': {**text, 'description': 'One sentence: who this person is, as a recruiter sees it in 6 seconds.'},
                    'points': {'type': 'array', 'items': text, 'description': 'Exactly 3 short takeaways.'},
                    'best_fit_roles': {'type': 'array', 'items': text, 'description': 'Up to 3 job titles this resume fits now.'},
                },
                'required': ['headline', 'points', 'best_fit_roles'],
            },
            'strengths': {'type': 'array', 'items': text, 'description': '3 specific strengths, each tied to something in the resume.'},
            'bullets': {
                'type': 'array',
                'description': 'Up to 8 bullets that gain most from a rewrite, weakest first.',
                'items': {
                    'type': 'object',
                    'properties': {
                        'original': {**text, 'description': 'The bullet, copied exactly from the resume.'},
                        'problems': {'type': 'array', 'items': {'type': 'string', 'enum': BULLET_PROBLEMS}},
                        'rewrite': {**text, 'description': 'One line. Strong verb first, every fact kept, [placeholders] for missing numbers.'},
                        'why': {**text, 'description': 'One short sentence on what the rewrite fixes.'},
                    },
                    'required': ['original', 'problems', 'rewrite', 'why'],
                },
            },
            'interview_questions': {
                'type': 'array',
                'description': '6 questions an interviewer would likely ask about this resume.',
                'items': {
                    'type': 'object',
                    'properties': {
                        'question': text,
                        'about': {**text, 'description': 'The project, job or claim it is about.'},
                    },
                    'required': ['question', 'about'],
                },
            },
        },
        'required': ['recruiter_view', 'strengths', 'bullets', 'interview_questions'],
    }
    if with_jd:
        schema['properties']['jd'] = {
            'type': 'object',
            'properties': {
                'fit_summary': {**text, 'description': 'Two sentences on how well the resume fits this job.'},
                'requirements': {
                    'type': 'array',
                    'description': 'Up to 12 key requirements from the job description.',
                    'items': {
                        'type': 'object',
                        'properties': {
                            'requirement': {**text, 'description': 'Short form of the requirement.'},
                            'status': {'type': 'string', 'enum': ['covered', 'partial', 'missing']},
                            'evidence': {**text, 'description': 'Exact quote from the resume that shows it, or empty.'},
                            'suggestion': {**text, 'description': 'What to add honestly, or empty when covered.'},
                        },
                        'required': ['requirement', 'status', 'evidence', 'suggestion'],
                    },
                },
            },
            'required': ['fit_summary', 'requirements'],
        }
        schema['required'].append('jd')
    return schema


def _prompt(resume_text, jd_text):
    parts = [
        'Review this resume. The text was extracted from a PDF, so line breaks and column order may be off.',
        f'RESUME:\n<<<\n{resume_text}\n>>>',
    ]
    if jd_text:
        parts.append(f'JOB DESCRIPTION the candidate is applying for:\n<<<\n{jd_text}\n>>>')
    parts.append(
        'Return JSON with: recruiter_view (headline, 3 points, best_fit_roles), strengths (3), '
        'bullets (up to 8 weakest bullets with original, problems, rewrite, why), '
        'interview_questions (6, each with question and about)'
        + (', and jd (fit_summary and up to 12 requirements with status covered, partial or missing, '
           'evidence quoted from the resume, and an honest suggestion).' if jd_text else '.'))
    parts.append(
        'For bullets: pick different kinds of weakness and never two bullets that say nearly the same thing. '
        'Copy the original without any leading dash or bullet symbol. '
        'For jd requirements: when the resume lists or uses a skill the job asks for, mark it covered and quote '
        'the words that show it; use partial only when the resume shows some of it.')
    return '\n\n'.join(parts)


# ----- personal details -----

EMAIL_RE = re.compile(r'[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}')
URL_RE = re.compile(r'(?i)\b(?:https?://|www\.)\S+|\b(?:linkedin\.com|github\.com|gitlab\.com|behance\.net|medium\.com)/\S+')
PHONE_RE = re.compile(r'(?<![\w])\+?\d[\d\s().-]{7,}\d(?![\w])')


def redact(text, full_name=None):
    """Text with the name, emails, links and phone numbers replaced. Returns (text, what was removed)."""
    removed = {'name': 0, 'email': 0, 'phone': 0, 'link': 0}

    def sub(pattern, label, value, flags=0):
        nonlocal text
        text, n = re.subn(pattern, value, text, flags=flags)
        removed[label] += n

    sub(EMAIL_RE, 'email', '[email]')
    sub(URL_RE, 'link', '[link]')
    # Phone numbers have 10 to 13 digits; year ranges ("2019 - 2021") are left alone
    text, n = PHONE_RE.subn(lambda m: '[phone]' if 10 <= len(re.sub(r'\D', '', m.group())) <= 13 else m.group(), text)
    removed['phone'] += sum(1 for _ in re.finditer(r'\[phone\]', text))

    names = set()
    if full_name:
        names.add(full_name.strip())
    first_line = next((ln.strip() for ln in text.split('\n') if ln.strip()), '')
    if re.fullmatch(r"[A-Za-z][A-Za-z.' -]{2,40}", first_line) and 2 <= len(first_line.split()) <= 4:
        names.add(first_line)
    for name in sorted(names, key=len, reverse=True):
        sub(rf'(?<![A-Za-z]){re.escape(name)}(?![A-Za-z])', 'name', '[Candidate]', re.IGNORECASE)
        for part in name.split():
            if len(part) >= 3:
                sub(rf'(?<![A-Za-z]){re.escape(part)}(?![A-Za-z])', 'name', '[Candidate]', re.IGNORECASE)
    text = re.sub(r'(?:\[Candidate\][\s.]*){2,}', '[Candidate] ', text)
    return text, {k: v for k, v in removed.items() if v}


# ----- grounding checks -----

def _words(text):
    return re.findall(r'[a-z0-9]+', text.lower())


def _trigrams(words):
    return {tuple(words[i:i + 3]) for i in range(len(words) - 2)}


def _is_quote(snippet, text_trigrams):
    """True when almost every three-word run of the snippet appears in the resume."""
    grams = _trigrams(_words(snippet))
    if not grams:
        return False
    return len(grams & text_trigrams) / len(grams) >= 0.8


NUMBER_RE = re.compile(r'\d+(?:[.,]\d+)*')


def _new_numbers(rewrite, original):
    """Numbers in the rewrite that the original bullet did not have, ignoring [placeholders]."""
    outside = re.sub(r'\[[^\]]*\]', ' ', rewrite)
    have = set(NUMBER_RE.findall(original))
    return [n for n in NUMBER_RE.findall(outside) if n not in have]


def _clean(review, resume_text, with_jd):
    grams = _trigrams(_words(resume_text))
    dropped = 0

    bullets = []
    for item in review.get('bullets') or []:
        original, rewrite = str(item.get('original', '')).strip(), str(item.get('rewrite', '')).strip()
        original = re.sub(r'^[\s\-\u2022*\u00b7\u2013]+', '', original)
        if not original or not rewrite or not _is_quote(original, grams) or _new_numbers(rewrite, original):
            dropped += 1
            continue
        # Several near-identical rewrites ("analysis 1", "analysis 2"...) teach nothing new: keep the first
        shape = re.sub(r'\d+', '#', rewrite.lower())
        if any(re.sub(r'\d+', '#', b['rewrite'].lower()) == shape for b in bullets):
            continue
        bullets.append({
            'original': re.sub(r'\s+', ' ', original),
            'problems': [p for p in item.get('problems') or [] if p in BULLET_PROBLEMS][:3],
            'rewrite': rewrite,
            'why': str(item.get('why', '')).strip(),
        })

    view = review.get('recruiter_view') or {}
    out = {
        'recruiter_view': {
            'headline': str(view.get('headline', '')).strip(),
            'points': [str(p).strip() for p in view.get('points') or [] if str(p).strip()][:3],
            'best_fit_roles': [str(r).strip() for r in view.get('best_fit_roles') or [] if str(r).strip()][:3],
        },
        'strengths': [str(s).strip() for s in review.get('strengths') or [] if str(s).strip()][:3],
        'bullets': bullets[:8],
        'interview_questions': [
            {'question': str(q.get('question', '')).strip(), 'about': str(q.get('about', '')).strip()}
            for q in review.get('interview_questions') or [] if str(q.get('question', '')).strip()][:6],
        'dropped': dropped,  # suggestions removed because they did not quote the resume or added numbers
    }
    if with_jd:
        jd = review.get('jd') or {}
        requirements = []
        for req in jd.get('requirements') or []:
            status = req.get('status') if req.get('status') in ('covered', 'partial', 'missing') else 'missing'
            evidence = str(req.get('evidence', '')).strip()
            if evidence and not _is_quote(evidence, grams):
                evidence = ''
            if status == 'covered' and not evidence:
                status = 'partial'  # a claim without a quote is not proof
            requirements.append({
                'requirement': str(req.get('requirement', '')).strip(),
                'status': status,
                'evidence': re.sub(r'\s+', ' ', evidence),
                'suggestion': str(req.get('suggestion', '')).strip(),
            })
        out['jd'] = {'fit_summary': str(jd.get('fit_summary', '')).strip(),
                     'requirements': [r for r in requirements if r['requirement']][:12]}
    return out


# ----- limits and status -----

def _limits():
    cfg = current_app.config
    return int(cfg.get('AI_DAILY_LIMIT', 40)), int(cfg.get('AI_USER_DAILY_LIMIT', 10))


def _user_bucket(user):
    return f'gemini-user-{user.id}'


def status(user):
    """Whether the AI review button should show, and how many reviews are left today."""
    if not gemini.configured():
        return {'enabled': False}
    total, per_user = _limits()
    return {
        'enabled': True,
        'provider': 'Google Gemini',
        'remaining_today': min(quota.remaining_today('gemini', total), quota.remaining_today(_user_bucket(user), per_user)),
        'daily_limit': per_user,
    }


# ----- the review -----

def review(user, resume, jd_text=None):
    """AI review of one saved resume, optionally against a job description. Returns a dict for the API."""
    if not gemini.configured():
        raise ApiError('AI review is not set up on this server.', 404)
    if not (resume.raw_text or '').strip():
        raise ApiError('This resume has no stored text. Upload it again to review it.', 400)

    text, removed = redact(resume.raw_text[:MAX_RESUME_CHARS], user.full_name)
    jd = (jd_text or '').strip()[:MAX_JD_CHARS] or None
    key = hashlib.sha256('\x1f'.join([PROMPT_VERSION, text, jd or '']).encode('utf-8')).hexdigest()

    saved = AiResult.query.filter_by(user_id=user.id, cache_key=key).first()
    if saved is not None:
        return {'review': json.loads(saved.result), 'model': saved.model, 'cached': True, 'removed': removed,
                'created_at': saved.created_at.isoformat() if saved.created_at else None, 'ai': status(user)}

    total, per_user = _limits()
    if not quota.take(_user_bucket(user), per_user):
        raise ApiError(f'You have used your {per_user} AI reviews for today. Try again tomorrow.', 429)
    if not quota.take('gemini', total):
        quota.give_back(_user_bucket(user))
        raise ApiError("Today's AI reviews for this site are used up. Try again tomorrow.", 429)

    try:
        raw, model = gemini.generate_json(_prompt(text, jd), _schema(bool(jd)), system=SYSTEM)
    except gemini.GeminiError as exc:
        if not exc.quota:  # nothing useful came back, so the attempt should not count against the user
            quota.give_back(_user_bucket(user))
        raise ApiError(exc.message, exc.status)
    result = _clean(raw if isinstance(raw, dict) else {}, text, bool(jd))

    row = AiResult(user_id=user.id, resume_id=resume.id, kind=KIND, cache_key=key, model=model,
                   result=json.dumps(result))
    db.session.add(row)
    db.session.commit()
    return {'review': result, 'model': model, 'cached': False, 'removed': removed,
            'created_at': row.created_at.isoformat() if row.created_at else None, 'ai': status(user)}
