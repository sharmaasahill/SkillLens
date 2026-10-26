"""How well a live job fits a resume, out of 100, with the reasons.

    Skills       50   share of the skills the job names that the resume shows
    Role         25   the job title against the role searched for
    Experience   15   the years the job asks for against the resume's years
    Freshness    10   newer postings get more applicants' attention from recruiters

Everything is computed on our side from the job text and the stored resume, so ranking is free
and instant, and gives the same answer every time.
"""
import re

from models import skills_taxonomy
from models.job_market import SAME_ROLE

from .common import days_old, norm_key
from .sources import role_words, title_matches

# Skills that say little about fit: nearly every posting lists them
WEAK = {'communication', 'teamwork', 'problem solving', 'leadership', 'collaboration', 'english', 'hindi',
        'analytical skills', 'time management', 'adaptability', 'creativity', 'critical thinking', 'documentation'}
SOFT_CATEGORIES = {'Soft skills', 'Spoken languages'}


def resume_keys(skills, text=''):
    keys = {skills_taxonomy.key_for(s) or skills_taxonomy.norm(s) for s in skills or []}
    keys |= {k for _, _, k in skills_taxonomy.scan(text or '')}
    return keys


def _useful(key):
    skill = skills_taxonomy.SKILLS.get(key)
    return key not in WEAK and not (skill and skill.category in SOFT_CATEGORIES)


GENERIC = {'development', 'developer', 'engineering', 'engineer', 'management', 'design', 'stack', 'full', 'end'}


def _names_the_role(key, role_text):
    """'Backend development' for a backend role says nothing new: the title already says it."""
    words = set(norm_key(key).split())
    # Only phrases with a generic word ("development", "engineering"); a real skill in the title ("Go", "Java") stays
    return bool(words & GENERIC) and words <= role_text | GENERIC and bool(words & role_text)


def _relevant_first(missing, matched):
    """Missing skills from the same areas as the matched ones first, so a tech role suggests tech
    skills before words from the company's own description ("Brand management")."""
    areas = {skills_taxonomy.SKILLS[k].category for k in matched if k in skills_taxonomy.SKILLS}
    return sorted(missing, key=lambda k: 0 if k in skills_taxonomy.SKILLS and skills_taxonomy.SKILLS[k].category in areas else 1)


def _role_score(role, title):
    if title_matches(role, title):
        return 1.0
    core, needs_role_word = role_words(role)
    words = set(norm_key(title).split())
    hits = sum(1 for w in core if w in words) + (1 if needs_role_word and words & SAME_ROLE else 0)
    total = len(core) + (1 if needs_role_word else 0)
    return hits / total if total else 0.0


def _experience_score(job_exp, years):
    if not job_exp:
        return None, ''
    lo, hi = job_exp.get('min') or 0, job_exp.get('max')
    asked = f'{lo}-{hi} years' if hi and hi != lo else f'{lo}+ years'
    if years >= lo and (hi is None or years <= hi + 2):
        return 1.0, f'Asks for {asked}, you have {years:g}'
    if years < lo:
        return max(0.0, 1 - (lo - years) * 0.3), f'Asks for {asked}, you have {years:g}: a stretch'
    return 0.7, f'Asks for {asked}, you have {years:g}: you may be senior for it'


def _fresh_score(posted):
    age = days_old(posted)
    if age is None:
        return 0.5, ''
    return max(0.0, 1 - age / 30), 'Posted today' if age == 0 else f'Posted {age} day{"s" if age != 1 else ""} ago'


def score(job, role, have, years):
    """Job dict plus 'match' (0-100), 'parts', 'matched_skills', 'missing_skills' and 'notes'."""
    role_text = set(norm_key(f"{role} {job['title']}").split())
    wanted = [k for k in job.get('skill_keys') or [] if _useful(k) and not _names_the_role(k, role_text)]
    matched = [k for k in wanted if k in have]
    missing = _relevant_first([k for k in wanted if k not in have], matched)
    if wanted:
        # Postings list 3 to 30 skills; covering 8 of them is already a strong fit. With fewer than 4
        # named skills there is little evidence either way, so the ratio is pulled towards one half.
        considered = min(len(wanted), 8)
        skill_ratio = min(1.0, len(matched) / considered) if considered >= 4 else (len(matched) + 0.5 * (4 - considered)) / 4
    else:
        skill_ratio = None
    # A skill in the title ("Backend Developer - Go") is the core of the job: missing it matters most
    title_missing = [k for _, _, k in skills_taxonomy.scan(job['title'])
                     if _useful(k) and not _names_the_role(k, role_text) and k not in have]
    if title_missing and skill_ratio is not None:
        skill_ratio *= 0.55
    role_ratio = _role_score(role, job['title'])
    exp_ratio, exp_note = _experience_score(job.get('experience'), years)
    fresh_ratio, fresh_note = _fresh_score(job.get('posted'))

    parts = [('skills', 50, skill_ratio), ('role', 25, role_ratio), ('experience', 15, exp_ratio), ('freshness', 10, fresh_ratio)]
    available = sum(w for _, w, r in parts if r is not None) or 1
    total = sum(w * r for _, w, r in parts if r is not None) * 100 / available

    notes = []
    name = lambda k: skills_taxonomy.SKILLS[k].name if k in skills_taxonomy.SKILLS else k
    if matched:
        notes.append(f'You have {len(matched)} of the {len(wanted)} skills it names')
    elif wanted:
        notes.append('Your resume shows none of the skills it names')
    if title_missing:
        notes.append(f"The title asks for {', '.join(name(k) for k in title_missing)}, which your resume does not show")
    if exp_note:
        notes.append(exp_note)
    if job.get('open_to_india') is None:
        notes.append('Remote, but it does not say which countries it hires from')
    if fresh_note:
        notes.append(fresh_note)
    missing = [k for k in title_missing if k in missing] + [k for k in missing if k not in title_missing]
    out = {k: v for k, v in job.items() if k != 'skill_keys'}
    out.update({
        'match': round(total),
        'parts': {p: (None if r is None else round(r * 100)) for p, _, r in parts},
        'matched_skills': [name(k) for k in matched][:10],
        'missing_skills': [name(k) for k in missing][:6],
        'notes': notes,
    })
    return out


def dedupe(jobs):
    """One entry per company and title. The copy with the longest description wins; other sources are listed."""
    best, also = {}, {}
    for job in jobs:
        key = (norm_key(job['company']), re.sub(r'\b(?:senior|sr|junior|jr|i|ii|iii)\b', '', norm_key(job['title'])).strip())
        also.setdefault(key, [])
        if job['via'] not in also[key]:
            also[key].append(job['via'])
        current = best.get(key)
        if current is None or len(job.get('description') or '') > len(current.get('description') or ''):
            best[key] = job
    out = []
    for key, job in best.items():
        job = dict(job)
        job['also_on'] = [v for v in also[key] if v != job['via']]
        out.append(job)
    return out
