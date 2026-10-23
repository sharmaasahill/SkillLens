"""Compare a resume with a job description (JD), the way an applicant tracking system ranks applicants.

The JD match score is out of 100:

    Required skills       45   skills the JD asks for that the resume shows (must-haves count double)
    JD keywords           25   the JD's most distinctive words and phrases found in the resume
    Experience            15   resume years vs. the years the JD asks for
    Education             10   a degree the JD names, found in the resume
    Job title              5   the JD's role title (or its key words) in the resume

Parts the JD does not mention (no experience or degree stated) are left out and the
remaining parts are scaled to 100, so a short JD is not penalised for what it omits.
"""
import io
import re
import zipfile
from collections import Counter

from . import skills_taxonomy as taxonomy
from .resume_analyzer import (
    DEGREE_RE, INDIAN_CITIES, KEYWORD_PATTERNS, ResumeAnalyzer, _match_terms, extract_text_from_pdf, find_skill_keys,
)

# How industry keywords that are not in the skills taxonomy are shown
KEYWORD_LABELS = {'api': 'APIs', 'b2b': 'B2B', 'b2c': 'B2C', 'nosql': 'NoSQL', 'etl': 'ETL'}

MAX_JD_CHARS = 20_000
MIN_JD_WORDS = 15

MUST_HINTS = re.compile(r'(?i)\b(must|required|requirement|mandatory|essential|minimum|need to have|should have|strong)\b')
NICE_HINTS = re.compile(r'(?i)\b(nice to have|good to have|preferred|preferably|plus|bonus|added advantage|desirable|optional)\b')
YEARS_RE = re.compile(
    r'(?i)(\d{1,2})\s*(?:\+|plus)?\s*(?:-|to|–)?\s*(\d{1,2})?\s*\+?\s*(?:years?|yrs?)(?:\s+of)?(?:\s+\w+){0,4}?\s+(?:experience|exp)\b'
    r'|(?:experience|exp)\s*(?:of|:)?\s*(\d{1,2})\s*(?:\+|-|to)?\s*(\d{1,2})?\s*(?:years?|yrs?)')
TITLE_RE = re.compile(r'(?im)^\s*(?:job\s*title|role|position|designation)\s*[:\-]\s*(.{3,80})$')

STOPWORDS = set('''
a about above across after again against all also am an and any are as at be been being below between both but by can
could did do does doing down during each either etc few for from further had has have having he her here hers him his how
i if in into is it its itself just me more most my no nor not now of off on once only or other our ours out over own per
same she should so some such than that the their them then there these they this those through to too under until up us
very was we were what when where which while who whom why will with within without would you your yours
ability able across apply candidate candidates company work working role roles job jobs team teams year years experience
responsibilities responsibility requirements required skills skill knowledge strong good excellent including include
looking join opportunity position must preferred plus etc using use based well new key day days level related relevant
ensure provide support help understanding understand across various multiple within least minimum
build building built develop developing deploy deploying deployed degree field fields location hybrid remote onsite
office about hands-on hands looking seeking hiring we're you'll our us india indian salary ctc lpa benefits apply
immediate joiner joiners notice period equivalent bachelor bachelors master masters graduate preferably like etc
nice have want wants need needs make makes across along other others
''' .split()) | {c.lower() for c in INDIAN_CITIES}


# ---------------------------------------------------------------------------
# Reading uploaded JDs
# ---------------------------------------------------------------------------

def text_from_upload(file_storage):
    """Plain text from an uploaded JD: PDF, DOCX or TXT."""
    name = (file_storage.filename or '').lower()
    data = file_storage.read(5 * 1024 * 1024 + 1)
    if len(data) > 5 * 1024 * 1024:
        raise ValueError('The job description file is larger than 5 MB')
    if name.endswith('.pdf') or data[:5] == b'%PDF-':
        return extract_text_from_pdf(io.BytesIO(data))
    if name.endswith('.docx') or data[:2] == b'PK':
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as docx:
                xml = docx.read('word/document.xml').decode('utf-8', 'ignore')
        except (zipfile.BadZipFile, KeyError):
            raise ValueError('Could not read the Word file. Save it as .docx, PDF or plain text')
        xml = re.sub(r'</w:p>', '\n', xml)
        return re.sub(r'<[^>]+>', '', xml)
    if name.endswith(('.txt', '.md')) or not name:
        return data.decode('utf-8', 'ignore')
    raise ValueError('Upload the job description as PDF, DOCX or TXT')


def clean_jd(text):
    text = (text or '').replace('\r\n', '\n').replace('\u00a0', ' ')
    text = re.sub(r'[ \t]+', ' ', text).strip()
    if len(text) > MAX_JD_CHARS:
        text = text[:MAX_JD_CHARS]
    if len(text.split()) < MIN_JD_WORDS:
        raise ValueError(f'The job description is too short. Paste at least {MIN_JD_WORDS} words')
    return text


# ---------------------------------------------------------------------------
# Matching
# ---------------------------------------------------------------------------

def _terms_by_line(lines):
    """The skill keys and industry keywords on each line, all as comparison keys."""
    out = []
    for line in lines:
        terms = set(find_skill_keys(line))
        terms.update(taxonomy.skill_key(k) for k in _match_terms(line, KEYWORD_PATTERNS))
        out.append(terms)
    return out


def _label(term):
    """Display form of a skill key or keyword."""
    if taxonomy.key_for(term):
        return taxonomy.display_name(term)
    return KEYWORD_LABELS.get(term, term[:1].upper() + term[1:])


def _skill_priority(jd, skills):
    """Split JD skills into must-have and nice-to-have, by the wording of the line they appear on."""
    lines = jd.split('\n')
    terms_on = _terms_by_line(lines)
    must, nice = [], []
    section_nice = False
    for skill in skills:
        verdict = None
        for line, terms in zip(lines, terms_on):
            if re.match(r'(?i)^\s*(nice|good|preferred|bonus|plus|desirable)', line) and len(line) < 60:
                section_nice = True
            elif re.match(r'(?i)^\s*(requirements?|must|required|qualifications?|what you)', line) and len(line) < 60:
                section_nice = False
            if skill in terms:
                if NICE_HINTS.search(line) or (section_nice and not MUST_HINTS.search(line)):
                    verdict = verdict or 'nice'
                else:
                    verdict = 'must'
        (must if verdict != 'nice' else nice).append(skill)
    return must, nice


def _stem(word):
    return word[:-1] if len(word) > 4 and word.endswith('s') and not word.endswith('ss') else word


def _jd_keywords(jd, exclude=(), limit=20):
    """Most repeated meaningful words and two-word phrases in the JD, in the form the JD uses them.

    Skills are scored separately, so words that are part of a recognised skill are left out here.
    """
    skip = set()
    for skill in exclude:
        skip.update(_stem(w) for w in re.findall(r"[a-z0-9+#./-]+", skill.lower()))
    raw = [w.strip('.,;:/-') for w in re.findall(r"[a-z][a-z0-9+#./-]{2,}", jd.lower())]
    raw = [w for w in raw if len(w) > 2 and w not in STOPWORDS]
    stems = [_stem(w) for w in raw]
    shown = {}
    for word, stem in zip(raw, stems):
        shown.setdefault(stem, Counter())[word] += 1
    counts = Counter(st for st in stems if st not in skip)
    counts.update(f'{a} {b}' for a, b in zip(stems, stems[1:]) if a != b and a not in skip and b not in skip)
    ranked = [(term, n) for term, n in counts.items() if n >= 2 or ' ' not in term]
    ranked.sort(key=lambda item: (-item[1] * (1.5 if ' ' in item[0] else 1), item[0]))
    picked = []
    for term, _ in ranked:
        if any(term in p or p in term for p in picked):
            continue
        picked.append(term)
        if len(picked) >= limit:
            break
    display = lambda term: ' '.join(shown[t].most_common(1)[0][0] if t in shown else t for t in term.split())
    return [(term, display(term)) for term in picked]


def _years_required(jd):
    found = []
    for m in YEARS_RE.finditer(jd):
        lo = m.group(1) or m.group(3)
        hi = m.group(2) or m.group(4)
        if lo and int(lo) <= 30:
            found.append((int(lo), int(hi) if hi and int(hi) >= int(lo) else None))
    if not found:
        return None
    # The smallest stated minimum is the real requirement ("3+ years Python, 1 year AWS" -> 1 is a sub-skill)
    lo, hi = max(found, key=lambda r: r[0]) if len(found) == 1 else min(found, key=lambda r: r[0])
    return {'min': lo, 'max': hi}


def _degrees(text):
    out = []
    for m in DEGREE_RE.finditer(text):
        label = re.sub(r'[\s.]', '', m.group()).upper().replace('PHD', 'PhD')
        label = {'BACHELOR': "BACHELOR'S", 'BACHELORS': "BACHELOR'S", "BACHELOR'S": "BACHELOR'S",
                 'MASTER': "MASTER'S", 'MASTERS': "MASTER'S"}.get(label, label)
        if label not in out and label not in ('10TH', '12TH', 'SSC', 'HSC', 'CBSE', 'ICSE'):
            out.append(label)
    return out


BACHELOR_LIKE = {"BACHELOR'S", 'BTECH', 'BE', 'BSC', 'BCOM', 'BCA', 'BBA', 'BA'}
MASTER_LIKE = {"MASTER'S", 'MTECH', 'ME', 'MSC', 'MCOM', 'MCA', 'MBA', 'PGDM', 'MA', 'PhD'}


def _education_fit(jd_degrees, resume_degrees):
    if not jd_degrees:
        return None
    have = set(resume_degrees)
    if have & set(jd_degrees):
        return True
    # A generic "Bachelor's" or "Master's" in the JD is satisfied by any degree of that level or higher
    if "BACHELOR'S" in jd_degrees and have & (BACHELOR_LIKE | MASTER_LIKE):
        return True
    if "MASTER'S" in jd_degrees and have & MASTER_LIKE:
        return True
    return False


def _title(jd):
    m = TITLE_RE.search(jd)
    if m:
        return m.group(1).strip(' .')
    first = next((line.strip() for line in jd.split('\n') if line.strip()), '')
    return first if 2 <= len(first.split()) <= 8 and not first.endswith('.') else None


def match(resume_text, jd_text, resume_skills=None):
    jd = clean_jd(jd_text)
    resume_lower = resume_text.lower()
    # Everything is compared by key, so "PostgreSQL", "postgres" and "Postgres DB" are the same skill
    resume_skills = {taxonomy.skill_key(s) for s in (resume_skills or [])} | set(find_skill_keys(resume_text))
    resume_skills |= {taxonomy.skill_key(k) for k in _match_terms(resume_text, KEYWORD_PATTERNS)}

    jd_skills = list(dict.fromkeys(
        find_skill_keys(jd) + [taxonomy.skill_key(k) for k in _match_terms(jd, KEYWORD_PATTERNS)]))
    must, nice = _skill_priority(jd, jd_skills)
    matched_must = [s for s in must if s in resume_skills]
    matched_nice = [s for s in nice if s in resume_skills]
    weight_total = 2 * len(must) + len(nice)
    skill_ratio = (2 * len(matched_must) + len(matched_nice)) / weight_total if weight_total else None

    keyword_pairs = _jd_keywords(jd, exclude=jd_skills)
    found_kw = [shown for stem, shown in keyword_pairs
                if re.search(r'(?<![a-z0-9])' + re.escape(stem) + r'(?:s|es)?(?![a-z0-9])', resume_lower)]
    keywords = [shown for _, shown in keyword_pairs]
    keyword_ratio = len(found_kw) / len(keywords) if keywords else None

    required = _years_required(jd)
    resume_years = ResumeAnalyzer()._extract_experience_info(resume_text).get('total_years', 0)
    if required is None:
        exp_ratio, exp_note = None, 'The JD does not state years of experience'
    elif resume_years >= required['min']:
        exp_ratio, exp_note = 1.0, f"Asks for {required['min']}+ years, your resume shows {resume_years}"
    elif resume_years == 0:
        exp_ratio, exp_note = 0.4, f"Asks for {required['min']}+ years. State your total years clearly (for example \"{required['min']} years of experience\")"
    else:
        exp_ratio = max(0.0, 1 - (required['min'] - resume_years) * 0.25)
        exp_note = f"Asks for {required['min']}+ years, your resume shows {resume_years}"

    jd_degrees = _degrees(jd)
    edu_fit = _education_fit(jd_degrees, _degrees(resume_text))
    edu_ratio = None if edu_fit is None else (1.0 if edu_fit else 0.0)

    title = _title(jd)
    title_ratio = None
    if title:
        words = [w for w in re.findall(r'[a-z+#.]{2,}', title.lower()) if w not in STOPWORDS]
        title_ratio = 1.0 if title.lower() in resume_lower else (
            sum(1 for w in words if re.search(r'\b' + re.escape(w) + r'\b', resume_lower)) / len(words) if words else None)

    parts = [
        ('skills', 'Required skills', 45, skill_ratio,
         f'{len(matched_must)} of {len(must)} must-have, {len(matched_nice)} of {len(nice)} nice-to-have' if jd_skills else 'No recognised skills in the JD'),
        ('keywords', 'JD keywords', 25, keyword_ratio, f'{len(found_kw)} of {len(keywords)} key terms'),
        ('experience', 'Experience', 15, exp_ratio, exp_note),
        ('education', 'Education', 10, edu_ratio,
         'The JD does not name a degree' if edu_fit is None else (f"Asks for {', '.join(jd_degrees[:3])}" + (' - found' if edu_fit else ' - not found'))),
        ('title', 'Job title', 5, title_ratio, f'"{title}"' if title else 'No clear title in the JD'),
    ]
    scored = [p for p in parts if p[3] is not None]
    available = sum(p[2] for p in scored) or 1
    breakdown = []
    total = 0.0
    for key, label, maximum, ratio, detail in parts:
        if ratio is None:
            breakdown.append({'key': key, 'label': label, 'score': None, 'max': maximum, 'detail': detail})
            continue
        points = ratio * maximum * 100 / available
        total += points
        breakdown.append({'key': key, 'label': label, 'score': round(points, 1),
                          'max': round(maximum * 100 / available, 1), 'detail': detail})

    missing_must = [_label(s) for s in must if s not in resume_skills]
    missing_nice = [_label(s) for s in nice if s not in resume_skills]
    matched_must = [_label(s) for s in matched_must]
    matched_nice = [_label(s) for s in matched_nice]
    missing_kw = [k for k in keywords if k not in found_kw][:10]
    suggestions = []
    if missing_must:
        suggestions.append(f"Add the must-have skills you have actually used: {', '.join(missing_must[:5])}. "
                           'Mention each one in a bullet that shows how you used it')
    if missing_kw:
        suggestions.append(f"Mirror the JD's wording where it is true for you: {', '.join(missing_kw[:5])}")
    if exp_ratio is not None and exp_ratio < 1:
        suggestions.append(exp_note)
    if edu_fit is False:
        suggestions.append(f"List your degree in the same words the JD uses ({', '.join(jd_degrees[:2])})")
    if title and (title_ratio or 0) < 0.5:
        suggestions.append(f'Use the target title "{title}" in your summary if it fits your experience')
    if missing_nice and not missing_must:
        suggestions.append(f"Nice-to-have skills that would strengthen this application: {', '.join(missing_nice[:4])}")

    score = round(min(100.0, total), 1)
    return {
        'score': score,
        'verdict': 'Strong match' if score >= 75 else 'Good match' if score >= 55 else 'Partial match' if score >= 35 else 'Weak match',
        'breakdown': breakdown,
        'job_title': title,
        'must_have': {'matched': matched_must, 'missing': missing_must},
        'nice_to_have': {'matched': matched_nice, 'missing': missing_nice},
        'keywords': {'matched': found_kw, 'missing': missing_kw},
        'experience': {'required': required, 'resume_years': resume_years},
        'education': {'required': jd_degrees, 'met': edu_fit},
        'suggestions': suggestions,
        'jd_word_count': len(jd.split()),
    }


def combined_score(ats_score, jd_score):
    """Overall score when a JD is given: 40% resume quality, 60% fit for this job."""
    return round(0.4 * ats_score + 0.6 * jd_score, 1)
