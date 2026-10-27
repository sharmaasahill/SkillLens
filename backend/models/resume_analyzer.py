"""Resume parsing and ATS scoring.

The ATS score is a 100-point rubric made of seven parts, so a resume that does
everything well can reach 100 and every point lost is explained:

    Contact details        10   email, phone, LinkedIn/GitHub/portfolio link
    Standard sections      20   experience, education, skills, summary, extras
    Skills and keywords    20   recognised skills plus industry keywords
    Quantified impact      15   numbers that show results (%, money, counts)
    Action verbs           15   strong verbs, minus weak filler phrases
    Length                 10   enough detail without padding
    ATS-safe formatting    10   nothing that trips up applicant tracking parsers

All patterns are compiled once at import, so scoring a resume takes a few milliseconds.
"""
import io
import logging
import re
from datetime import datetime

import pypdf

from . import skills_taxonomy as taxonomy

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Vocabulary
# ---------------------------------------------------------------------------

# Skills come from the taxonomy in skills_taxonomy.py (display names, categories and spellings).
# The keywords below feed the separate "industry keywords" half of the skills score.

INDUSTRY_KEYWORDS = [
    # Finance, sales, HR and operations, so non-tech resumes are scored fairly
    'gst', 'tds', 'income tax', 'bank reconciliation', 'tally', 'mis', 'budgeting', 'forecasting', 'audit',
    'compliance', 'b2b', 'b2c', 'lead generation', 'crm', 'target achievement', 'key account management',
    'recruitment', 'onboarding', 'payroll', 'employee engagement', 'supply chain', 'vendor management',
    'inventory', 'quality assurance', 'six sigma', 'stakeholder management', 'customer satisfaction',
    # Software development
    'agile', 'scrum', 'sprint', 'version control', 'git', 'ci/cd', 'code review', 'unit testing',
    'integration testing', 'deployment', 'microservices', 'api', 'rest', 'graphql', 'database', 'sql', 'nosql',
    # Data science
    'machine learning', 'deep learning', 'data analysis', 'statistics', 'python', 'pandas', 'numpy', 'tensorflow',
    'pytorch', 'scikit-learn', 'data visualization', 'big data', 'hadoop', 'spark', 'a/b testing', 'etl',
    # Cloud and DevOps
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform', 'jenkins', 'monitoring', 'logging',
    'infrastructure as code', 'cloud architecture', 'serverless',
]

# Other ways people write the same keyword
ALIASES = {
    'scikit-learn': ['sklearn', 'scikit learn'],
    'kubernetes': ['k8s'],
    'machine learning': ['ml engineering'],
    'ci/cd': ['ci cd', 'continuous integration'],
    'a/b testing': ['ab testing', 'a b testing'],
}

# Short or everyday words that only count as a keyword when written the way the term is used
CASE_SENSITIVE = {
    'rest': r'\bREST(?:ful)?\b',
    'api': r'\bAPIs?\b',
    'logging': r'\blogging\b',
    'monitoring': r'\bmonitoring\b',
    'mis': r'\bMIS\b',
    'gst': r'\bGST\b',
    'tds': r'\bTDS\b',
    'crm': r'\bCRM\b',
    'audit': r'(?i)\baudit(?:s|ing|ed)?\b',
}


def _term_pattern(term):
    """Whole-word pattern that tolerates spaces, hyphens or nothing between words."""
    parts = [re.escape(p) for p in re.split(r'[\s\-]+', term.strip())]
    body = r'[\s\-]?'.join(parts)
    return rf'(?<![a-z0-9]){body}(?![a-z0-9])'


def _compile_terms(terms):
    compiled = []
    seen = set()
    for term in terms:
        if term in seen:
            continue
        seen.add(term)
        if term in CASE_SENSITIVE:
            compiled.append((term, re.compile(CASE_SENSITIVE[term])))
        else:
            variants = [term] + ALIASES.get(term, [])
            compiled.append((term, re.compile('|'.join(_term_pattern(v) for v in variants), re.IGNORECASE)))
    return compiled


KEYWORD_PATTERNS = _compile_terms(INDUSTRY_KEYWORDS)

STRONG_VERBS = [
    'achieved', 'accelerated', 'architected', 'automated', 'built', 'coordinated', 'created', 'cut', 'delivered',
    'deployed', 'designed', 'developed', 'drove', 'engineered', 'enhanced', 'established', 'executed', 'generated',
    'grew', 'implemented', 'improved', 'increased', 'launched', 'led', 'managed', 'mentored', 'migrated',
    'negotiated', 'optimized', 'optimised', 'owned', 'reduced', 'resolved', 'saved', 'scaled', 'shipped',
    'spearheaded', 'streamlined', 'supervised', 'transformed',
]
WEAK_PHRASES = [
    'responsible for', 'worked on', 'helped with', 'participated in', 'involved in', 'assisted with',
    'contributed to', 'duties included', 'tasked with',
]
VERB_PATTERNS = [(v, re.compile(rf'\b{v}\b', re.IGNORECASE)) for v in STRONG_VERBS]
WEAK_PATTERNS = [(p, re.compile(rf'\b{p}\b', re.IGNORECASE)) for p in WEAK_PHRASES]

# Section headings: a short line that starts with one of these words
SECTION_GROUPS = [
    ('experience', 6, ['professional experience', 'work experience', 'work history', 'employment', 'experience']),
    ('education', 5, ['education', 'academic background', 'academic qualifications', 'educational qualifications',
                      'academics', 'qualifications']),
    ('skills', 5, ['technical skills', 'core competencies', 'skills', 'technologies', 'tech stack']),
    ('summary', 2, ['professional summary', 'summary', 'objective', 'profile', 'about me']),
    ('projects', 2, ['projects', 'internships', 'certifications', 'achievements', 'awards', 'publications',
                     'certificates', 'extra-curricular']),
]
SECTION_PATTERNS = [
    (name, points, re.compile(
        r'(?im)^[ \t]*[^\w\n]{0,3}(?:' + '|'.join(re.escape(w) for w in words) + r')\b[^\n]{0,30}$'))
    for name, points, words in SECTION_GROUPS
]
SECTION_ANYWHERE = [
    (name, points, re.compile(r'(?i)\b(?:' + '|'.join(re.escape(w) for w in words) + r')\b'))
    for name, points, words in SECTION_GROUPS
]
# Upper-case headings, even when the PDF glued them to neighbouring text ("SKILLSSUMMARY")
SECTION_UPPER = [
    (name, points, re.compile('|'.join(re.escape(w.upper()) for w in words if len(w) >= 6)))
    for name, points, words in SECTION_GROUPS
]

EMAIL_RE = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b')
PHONE_RE = re.compile(r'(?<![\w])\+?\d[\d\s().-]{7,}\d(?![\w])')
# PDF text loses hyperlink targets, so a visible "LinkedIn" or "GitHub" label also counts
PROFILE_LINK_RE = re.compile(r'(?i)\b(?:linkedin|github|gitlab|behance|dribbble|portfolio)\b')

QUANTIFIED_PATTERNS = [
    re.compile(r'\b\d+(?:\.\d+)?\s?%'),
    re.compile(r'(?i)(?:[$\u20b9\u20ac\u00a3]|\brs\.?|\binr\b|\busd\b)\s?\d[\d,.]*'),
    re.compile(r'(?i)\b\d+(?:\.\d+)?\s?(?:x|k|m|mn|million|billion|lakhs?|lacs?|crores?|cr|lpa)\b'),
    re.compile(
        r'(?i)\b\d{1,3}(?:,\d{3})*\+?\s+(?:users|customers|clients|people|engineers|developers|members|projects|'
        r'applications|apps|services|countries|cities|stores|students|hours|days|weeks|downloads|requests|'
        r'transactions|records|teams|products|reports|dashboards|models|pipelines|tickets|bugs|accounts|leads|'
        r'partners|stakeholders|features|releases|servers|employees)\b'),
]

FORMAT_CHECKS = [
    ('complex table structures', re.compile(r'\|\s*[-=]{3,}\s*\||\+[-=]{3,}\+|[\u250c\u251c\u2514][\u2500\u252c\u253c\u2534]+')),
    ('embedded image references', re.compile(r'(?i)\b[\w-]+\.(?:jpe?g|png|gif|bmp|svg)\b')),
    ('page numbers in headers or footers', re.compile(r'(?i)\bpage\s+\d+\s+of\s+\d+\b|continued on next page')),
    ('confidential or draft notices', re.compile(r'(?i)\b(?:confidential|draft copy|do not (?:copy|distribute))\b')),
]
ICON_GLYPHS_RE = re.compile('[\ue000-\uf8ff\ufffd]')

# Common on Indian resumes, but not needed by recruiters and a privacy and bias risk
PERSONAL_DETAILS_RE = re.compile(
    r"(?i)\b(?:date of birth|d\.?\s?o\.?\s?b\.?|marital status|father'?s name|mother'?s name|religion|caste|"
    r"nationality|gender\s*:|passport no)\b")

INDIAN_CITIES = [
    'Bengaluru', 'Bangalore', 'Hyderabad', 'Pune', 'Mumbai', 'Navi Mumbai', 'Thane', 'Chennai', 'Gurugram',
    'Gurgaon', 'Noida', 'Greater Noida', 'Delhi', 'New Delhi', 'Ghaziabad', 'Faridabad', 'Ahmedabad', 'Gandhinagar',
    'Kolkata', 'Jaipur', 'Kochi', 'Coimbatore', 'Chandigarh', 'Mohali', 'Vadodara', 'Nagpur', 'Surat', 'Lucknow',
    'Nashik', 'Indore', 'Bhopal', 'Bhubaneswar', 'Visakhapatnam', 'Vijayawada', 'Mysuru', 'Mysore', 'Madurai',
    'Thiruvananthapuram', 'Trivandrum', 'Patna', 'Ranchi', 'Raipur', 'Dehradun', 'Ludhiana', 'Guwahati',
    'Aurangabad', 'Rajkot', 'Udaipur', 'Kanpur', 'Varanasi', 'Mangaluru', 'Mangalore', 'Hubli', 'Goa',
]
CITY_RE = re.compile(r'\b(' + '|'.join(re.escape(c) for c in sorted(INDIAN_CITIES, key=len, reverse=True)) + r')\b')

# Indian degrees, longest first so "B.Tech" is not read as "B"
DEGREE_RE = re.compile(
    r"(?i)(?<![a-z])(b\.?\s?tech|m\.?\s?tech|b\.?\s?e\.?(?=\s|,|$)|m\.?\s?e\.?(?=\s|,|$)|b\.?\s?sc|m\.?\s?sc|"
    r"b\.?\s?com|m\.?\s?com|bca|mca|bba|mba|pgdm|b\.?\s?a\.?(?=\s|,|$)|m\.?\s?a\.?(?=\s|,|$)|ph\.?\s?d|"
    r"chartered accountant|\bca\b(?=\s+(?:final|inter|foundation))|diploma|bachelor'?s?|master'?s?|"
    r"\b(?:10th|12th|ssc|hsc|cbse|icse)\b)")


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text_from_pdf(file_path):
    """Extract text from a PDF, using pdfplumber when installed and pypdf otherwise."""
    text = ''
    if PDFPLUMBER_AVAILABLE:
        try:
            with pdfplumber.open(file_path) as pdf:
                text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
            if text.strip():
                return _normalise(text)
        except Exception as exc:
            logger.warning('pdfplumber failed: %s', exc)

    # Accepts a path or an open binary file (used for uploaded job descriptions)
    if hasattr(file_path, 'read'):
        file_path.seek(0)
        reader = pypdf.PdfReader(file_path)
    else:
        with open(file_path, 'rb') as handle:
            reader = pypdf.PdfReader(io.BytesIO(handle.read()))
    if reader.is_encrypted:
        raise ValueError('PDF is encrypted and cannot be read')
    pages = []
    for page in reader.pages:
        try:
            pages.append(page.extract_text() or '')
        except Exception as exc:
            logger.warning('Error extracting text from page: %s', exc)
    text = '\n'.join(pages)
    if not text.strip():
        raise ValueError('No text could be extracted from the PDF')
    return _normalise(text)


LETTER_SPACED_RE = re.compile(r'(?<![A-Za-z])(?:[A-Za-z] ){3,}[A-Za-z](?![A-Za-z])')


def _normalise(text):
    text = text.replace('\r\n', '\n').replace('\r', '\n').replace('\u00a0', ' ')
    text = re.sub(r'[ \t]+', ' ', text)
    # Designer resumes often letter-space headings ("E X P E R I E N C E"); join them back into words
    return LETTER_SPACED_RE.sub(lambda m: m.group().replace(' ', ''), text)


# ---------------------------------------------------------------------------
# Analysis
# ---------------------------------------------------------------------------

def _match_terms(text, patterns):
    return [term for term, pattern in patterns if pattern.search(text)]


# ----- Skills -----
#
# Two passes over the resume:
#  1. Running text: every spelling of every known skill, whole words only. When spellings overlap
#     the longest wins, so "Spring Boot" is not also counted as "Spring", nor "React Native" as "React".
#  2. Skill lists ("Languages: Python, Java", "Python, AWS (Lambda, S3, EC2)"): each item is looked up
#     on its own, with the list's label as context ("Lambda" under AWS is AWS Lambda). Items the
#     taxonomy does not know are kept as written when the line is clearly a skills list.

_BULLET_RE = re.compile(r'^[\s\u2022\u25cf\u25aa\u25e6\u25a0\u25a1\u27a2\u27a4\u25ba\u2023\u2043*\-\u2013\u00b7]+')
_LABEL_RE = re.compile(r'^(?P<label>[A-Za-z][A-Za-z0-9 &/+.()\'\-]{0,38}?)\s*(?::|\s[\u2013\u2014-]\s)\s*(?P<items>\S.*)$')
_LIST_SEPARATORS = ',;|\u2022\u00b7'
_AND_RE = re.compile(r'\s+(?:and|&)\s+', re.IGNORECASE)
_DATE_RE = re.compile(r'(?i)\b(?:19|20)\d{2}\b|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d')
_NOT_A_SKILL = set('''
and or etc others other more many various basic basics beginner intermediate advanced expert proficient familiar
knowledge working good strong excellent fundamentals concepts skills skill tools frameworks libraries languages
experience years year present current using with including include like such as the a an of in on for to
'''.split()) | {'working knowledge', 'hands on', 'many more', 'and more', 'and others', 'etc.'}

# Labels that introduce a skills list, and the category to file unfamiliar items under
_LABEL_CATEGORIES = [
    (r'spoken|human language', 'Spoken languages'),
    (r'language', 'Programming languages'),
    (r'mobile|android|ios', 'Mobile'),
    (r'front|ui\b|web', 'Frontend'),
    (r'back|server|framework|librar|runtime', 'Backend'),
    (r'database|\bdbs?\b|storage|orm|persistence', 'Databases'),
    (r'cloud|aws|azure|gcp|amazon|google', 'Cloud'),
    (r'devops|build|delivery|deploy|infra|ci\b|cd\b|container|version|operating|\bos\b|platform', 'DevOps & infrastructure'),
    (r'test|qa\b|quality', 'Testing & QA'),
    (r'api|security|auth', 'APIs & security'),
    (r'\bai\b|\bml\b|machine|deep|llm|gen ?ai|nlp|vision|intelligence', 'AI & machine learning'),
    (r'data|analytic|\bbi\b|visuali|report', 'Data & analytics'),
    (r'design|ux|creative', 'Design'),
    (r'erp|crm|office|software|productivity', 'Business software'),
    (r'account|finance|tax', 'Finance & accounting'),
    (r'sales|marketing', 'Sales & marketing'),
    (r'soft|interpersonal|personal skills', 'Soft skills'),
    (r'skill|tech|tool|stack|competenc|expertise|proficienc|other|misc|additional|core|area|concept|method|practice|integration', 'Other'),
]
_LABEL_CATEGORIES = [(re.compile(p, re.IGNORECASE), c) for p, c in _LABEL_CATEGORIES]
_NOT_SKILL_LABEL = re.compile(
    r'(?i)\b(?:email|e-mail|phone|mobile no|contact|address|linkedin|github|portfolio|website|date|dob|birth|'
    r'cgpa|gpa|percentage|marks|location|nationality|gender|interests?|hobbies|references?|declaration|'
    r'duration|period|role|designation|company|client|team size|objective)\b')
_CLOUD_CONTEXT = {'aws': ['aws', 'amazon'], 'amazon': ['amazon', 'aws'], 'azure': ['azure', 'microsoft azure'],
                  'gcp': ['google cloud', 'gcp', 'google'], 'google': ['google', 'google cloud']}


def _text_hits(text):
    """Known skills in running text: {key: [mentions, first position]}, longest spelling wins on overlap."""
    hits = {}
    for start, _end, key in taxonomy.scan(text):
        hits.setdefault(key, [0, start])[0] += 1
    return hits


def _split_items(text):
    """Split a list on commas, semicolons, pipes and bullets, but not inside brackets."""
    items, depth, buf = [], 0, []
    for ch in text:
        if ch in '([{':
            depth += 1
        elif ch in ')]}':
            depth = max(0, depth - 1)
        if depth == 0 and ch in _LIST_SEPARATORS:
            items.append(''.join(buf))
            buf = []
        else:
            buf.append(ch)
    items.append(''.join(buf))
    return [i.strip(' .\t') for i in items if i.strip(' .\t')]


def _contexts(parent):
    """Prefixes to try for items of a list ("Lambda" under "AWS" -> "aws lambda", "amazon lambda")."""
    if not parent:
        return []
    words = [w for w in taxonomy.norm(parent).split() if len(w) > 1 and w not in _NOT_A_SKILL]
    out = [taxonomy.norm(parent)] + words
    for w in words:
        out += _CLOUD_CONTEXT.get(w, [])
    return list(dict.fromkeys(out))


def _plausible_skill(item):
    """Whether an unfamiliar list item looks like a skill name rather than a phrase, date or contact detail."""
    low = item.lower()
    words = item.split()
    return (2 <= len(item) <= 40 and len(words) <= 4 and re.search(r'[A-Za-z]', item)
            and (item[0].isalnum() or item[0] == '.') and low not in _NOT_A_SKILL
            and not any(w.lower() in ('and', 'with', 'using', 'for', 'of', 'in', 'to') for w in words[1:-1])
            and not re.search(r'@|https?:|www\.|\.com\b', low) and not _DATE_RE.search(item)
            and sum(c.isdigit() for c in item) <= len(item) / 2)


def _classify(item, contexts):
    """('known', [keys]) for recognised skills, ('unknown', item) for a plausible new skill, or None."""
    item = re.sub(r'^(?:and|&)\s+', '', item.strip(), flags=re.IGNORECASE).strip(' .')
    if not item:
        return None
    key = taxonomy.key_for(item)
    if key is None:
        for prefix in contexts:
            key = taxonomy.key_for(f'{prefix} {item}')
            if key:
                break
    if key:
        return 'known', [key]
    # "Python and Java", "OpenAPI/Swagger": try the parts
    for splitter in (_AND_RE, re.compile(r'\s*/\s*')):
        parts = [p for p in splitter.split(item) if p.strip()]
        if len(parts) > 1:
            results = [_classify(p, contexts) for p in parts]
            if all(results):
                keys = [k for kind, val in results if kind == 'known' for k in val]
                unknown = [val for kind, val in results if kind == 'unknown']
                if keys and not unknown:
                    return 'known', keys
                if keys:
                    return 'mixed', (keys, unknown)
    inner = list(_text_hits(item))
    if inner:
        return 'known', inner
    return ('unknown', item) if _plausible_skill(item) else None


def _list_line_skills(line):
    """Skills from one line if it is a skills list. Returns [(key_or_None, name, category)] or []."""
    line = _BULLET_RE.sub('', line).strip()
    if len(line) < 3:
        return []
    label, body = None, line
    m = _LABEL_RE.match(line)
    if m and len(m.group('label').split()) <= 4:
        label, body = m.group('label').strip(), m.group('items')
        if _NOT_SKILL_LABEL.search(label):
            return []
    leaves = []  # (text, contexts, parent text)
    for item in _split_items(body):
        pm = re.match(r'^(.*?)\s*\((.+)\)\s*$', item)
        if pm and pm.group(1).strip():
            parent = pm.group(1).strip()
            leaves.append((parent, _contexts(label), None))
            for child in _split_items(pm.group(2)):
                leaves.append((child, _contexts(parent) + _contexts(label), parent))
        else:
            leaves.append((re.sub(r'\s*\([^)]*\)\s*$', '', item), _contexts(label), None))
    if not leaves or (label is None and len(leaves) < 3):
        return []

    classified = [(_classify(text, ctx), parent) for text, ctx, parent in leaves]
    known = sum(1 for c, _ in classified if c and c[0] in ('known', 'mixed'))
    label_category = next((c for p, c in _LABEL_CATEGORIES if label and p.search(label)), None)
    if label is not None:
        is_list = label_category is not None or (known >= 2 and known >= 0.5 * len(leaves))
    else:
        # A bare line of items ("Next.js, React, TypeScript, Prisma") counts when most are known skills
        is_list = known >= 2 and known >= 0.6 * len(leaves) and all(len(t.split()) <= 4 for t, _, _ in leaves)
    if not is_list:
        return []

    out = []
    for c, parent in classified:
        if not c:
            continue
        kind, value = c
        keys, unknown = (value, []) if kind == 'known' else ([], [value]) if kind == 'unknown' else value
        out += [(k, taxonomy.SKILLS[k].name, taxonomy.SKILLS[k].category) for k in keys]
        parent_category = taxonomy.category_of(parent) if parent else None
        out += [(None, u, parent_category or label_category or 'Other') for u in unknown]
    return out


def extract_skills(text):
    """Every skill in a resume, most mentioned first: [{'name', 'key', 'category', 'mentions'}]."""
    hits = _text_hits(text)
    extra = {}  # skills only visible through lists: key -> [name, category, mentions, first position]
    offset = 0
    for line in text.split('\n'):
        if ',' in line or ';' in line or '|' in line or ':' in line or '\u2022' in line:
            for key, name, category in _list_line_skills(line):
                k = key or taxonomy.norm(name)
                if key and key in hits:
                    continue  # already counted from the running text
                entry = extra.setdefault(k, [name, category, 0, offset])
                entry[2] += 1
        offset += len(line) + 1

    skills = []
    for key, (mentions, first) in hits.items():
        s = taxonomy.SKILLS[key]
        skills.append({'name': s.name, 'key': key, 'category': s.category, 'mentions': mentions, 'first': first})
    for k, (name, category, mentions, first) in extra.items():
        if k in taxonomy.SKILLS:
            name, category = taxonomy.SKILLS[k].name, taxonomy.SKILLS[k].category
        skills.append({'name': name, 'key': k, 'category': category, 'mentions': mentions, 'first': first})
    skills.sort(key=lambda s: (-s['mentions'], s['first']))
    for s in skills:
        del s['first']
    return skills


def group_skills(skills):
    """Skills grouped by category, in taxonomy order: [{'category', 'skills': [{'name', 'mentions'}]}]."""
    groups = {}
    for s in skills:
        groups.setdefault(s['category'], []).append({'name': s['name'], 'mentions': s['mentions']})
    order = {c: i for i, c in enumerate(taxonomy.CATEGORIES)}
    return [{'category': c, 'skills': items} for c, items in sorted(groups.items(), key=lambda g: order.get(g[0], len(order)))]


def find_skill_keys(text):
    """Keys of known skills in running text, in order of first mention (used for job descriptions)."""
    return [key for key, _ in sorted(_text_hits(text).items(), key=lambda item: item[1][1])]


def extract_skills_simple(text):
    """Display names of every skill in the text, most mentioned first."""
    return [s['name'] for s in extract_skills(text)]


def analyze_action_verbs(text):
    strong = [verb for verb, pattern in VERB_PATTERNS if pattern.search(text)]
    weak = [phrase for phrase, pattern in WEAK_PATTERNS if pattern.search(text)]
    return {'strong': strong, 'weak': weak}


def _count_quantified(text):
    spans = []
    for pattern in QUANTIFIED_PATTERNS:
        spans.extend(m.span() for m in pattern.finditer(text))
    spans.sort()
    count, last_end = 0, -1
    for start, end in spans:
        if start >= last_end:  # overlapping matches count once
            count += 1
            last_end = end
    return count


def _find_sections(text):
    has_structure = text.count('\n') >= 5
    found, points = [], 0
    for (name, value, heading), (_, _, anywhere), (_, _, upper) in zip(SECTION_PATTERNS, SECTION_ANYWHERE, SECTION_UPPER):
        # Prefer real headings; fall back to any mention when the PDF lost its line breaks
        if heading.search(text) or upper.search(text) or (not has_structure and anywhere.search(text)):
            found.append(name)
            points += value
    return found, points


def _length_points(words):
    if 300 <= words <= 1000:
        return 10
    if 200 <= words < 300 or 1000 < words <= 1300:
        return 6
    if 120 <= words < 200:
        return 3
    return 0


def check_ats_compatibility(text, skills=None):
    """Score a resume out of 100 and explain every missing point."""
    skills = extract_skills_simple(text) if skills is None else skills
    issues = []
    breakdown = []

    def part(key, label, score, maximum, detail):
        score = max(0, min(maximum, round(score, 1)))
        breakdown.append({'key': key, 'label': label, 'score': score, 'max': maximum, 'detail': detail})
        return score

    # Contact details (10)
    has_email = bool(EMAIL_RE.search(text))
    has_phone = any(10 <= len(re.sub(r'\D', '', m.group())) <= 13 for m in PHONE_RE.finditer(text))
    has_link = bool(PROFILE_LINK_RE.search(text))
    missing = [label for ok, label in ((has_email, 'email'), (has_phone, 'phone number'), (has_link, 'LinkedIn or portfolio link')) if not ok]
    if not has_email or not has_phone:
        issues.append(f"Missing contact information: add your {' and '.join(missing[:2])}")
    elif not has_link:
        issues.append('Add a LinkedIn, GitHub or portfolio link so recruiters can learn more')
    contact = part('contact', 'Contact details', 4 * has_email + 3 * has_phone + 3 * has_link, 10,
                   'Complete' if not missing else f"Missing {', '.join(missing)}")

    # Sections (20)
    found_sections, section_points = _find_sections(text)
    missing_core = [s for s in ('experience', 'education', 'skills') if s not in found_sections]
    if missing_core:
        issues.append(f"Missing important sections: {', '.join(missing_core)}")
    elif 'summary' not in found_sections:
        issues.append('Add a short summary at the top to frame your experience')
    sections = part('sections', 'Standard sections', section_points, 20,
                    f"{len(found_sections)} of {len(SECTION_GROUPS)} found")

    # Skills and keywords (20)
    keywords = _match_terms(text, KEYWORD_PATTERNS)
    if len(skills) < 8:
        issues.append(f'Only {len(skills)} recognised skills. List the tools and technologies you use')
    if len(keywords) < 5:
        issues.append(f'Only {len(keywords)} industry keywords. Mirror the wording of job descriptions you target')
    skill_score = part('skills', 'Skills and keywords', min(12, len(skills)) + min(8, len(keywords)), 20,
                       f'{len(skills)} skills, {len(keywords)} industry keywords')

    # Quantified impact (15)
    quantified = _count_quantified(text)
    if quantified < 3:
        issues.append(f'Only {quantified} quantified results. Add numbers: percentages, money saved, users served')
    impact = part('impact', 'Quantified impact', quantified * 3, 15, f'{quantified} measurable results')

    # Action verbs (15)
    verbs = analyze_action_verbs(text)
    if verbs['weak']:
        issues.append(f"Replace weak phrases such as \"{verbs['weak'][0]}\" with strong action verbs")
    elif len(verbs['strong']) < 6:
        issues.append('Start more bullet points with strong action verbs like led, built or reduced')
    verb_score = part('verbs', 'Action verbs', len(verbs['strong']) * 1.5 - len(verbs['weak']) * 2, 15,
                      f"{len(verbs['strong'])} strong, {len(verbs['weak'])} weak")

    # Length (10)
    words = len(text.split())
    if words < 200:
        issues.append(f'Resume is short ({words} words). Add detail about your experience and results')
    elif words > 1300:
        issues.append(f'Resume is long ({words} words). Trim it to what matters for the role')
    length = part('length', 'Length', _length_points(words), 10, f'{words} words')

    # ATS-safe formatting (10)
    problematic = [label for label, pattern in FORMAT_CHECKS if pattern.search(text)]
    glyphs = len(ICON_GLYPHS_RE.findall(text))
    if glyphs > 3:
        problematic.append('icon fonts or symbols that do not convert to text')
    if problematic:
        issues.append(f"Contains elements that might not parse well in ATS: {', '.join(problematic)}")
    personal = sorted({m.group().lower().rstrip(' :') for m in PERSONAL_DETAILS_RE.finditer(text)})
    if personal:
        issues.append(f"Remove personal details recruiters do not need ({', '.join(personal[:3])}). "
                      "They take space and can introduce bias")
    if words < 100:
        # Too little text to judge formatting, so these points are not given away for free
        formatting = part('formatting', 'ATS-safe formatting', 0, 10, 'Not enough content to assess')
    else:
        found_issues = len(problematic) + (1 if personal else 0)
        formatting = part('formatting', 'ATS-safe formatting', 10 - 4 * len(problematic) - (3 if personal else 0), 10,
                          'Clean' if not found_issues else f'{found_issues} issue(s)')

    total = contact + sections + skill_score + impact + verb_score + length + formatting
    return {
        'score': round(min(100, max(0, total)), 1),
        'max_score': 100,
        'breakdown': breakdown,
        'issues': issues,
        'found_sections': found_sections,
        'keyword_matches': len(keywords),
        'keywords': keywords,
        'quantified_achievements': quantified,
        'action_verbs': verbs,
        'word_count': words,
        'problematic_elements': problematic,
        'personal_details': personal,
    }


def analyze_text(text):
    """Skills and ATS analysis for already-extracted resume text."""
    if not text or not text.strip():
        raise ValueError('No text could be extracted from the resume')
    from .resume_checks import review  # imported here: resume_checks builds on this module

    text = _normalise(text)
    found = extract_skills(text)
    skills = [s['name'] for s in found]
    return {
        'skills': skills,
        'skill_groups': group_skills(found),
        'text': text,
        'ats_analysis': check_ats_compatibility(text, skills),
        'checks': review(text),
    }


def extract_skills_from_resume(file_path):
    """Extract text from a PDF resume, then find skills and score it."""
    try:
        return analyze_text(extract_text_from_pdf(file_path))
    except Exception as exc:
        logger.error('Error in extract_skills_from_resume: %s', exc)
        raise ValueError(f'Failed to analyze resume: {exc}')


_MONTHS = {m: i for i, m in enumerate(['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'], 1)}
DATE_RANGE_RE = re.compile(
    r'(?i)\b(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*[\'’]?)?((?:19|20)\d{2})\s*(?:-|–|—|to|till)\s*'
    r'(?:(present|current|now|till date|date|ongoing)|(?:(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s*[\'’]?)?((?:19|20)\d{2}))')
EDUCATION_LINE_RE = re.compile(r'(?i)\b(university|college|institute|school|b\.?\s?tech|b\.?\s?e\b|b\.?\s?sc|b\.?\s?com|bca|mca|mba|m\.?\s?tech|m\.?\s?sc|degree|diploma|cgpa|10th|12th|hsc|ssc|bachelor|master)\b')


def work_date_lines(text):
    """(line, line index) for lines with a date range that belongs to work, not to education.

    Two-column PDFs often put a degree's dates on a line of their own, so a line that holds little
    more than the dates also counts as education when one of the two lines above it is about a degree.
    """
    lines = text.split('\n')
    out = []
    for i, line in enumerate(lines):
        match = DATE_RANGE_RE.search(line)
        if not match or EDUCATION_LINE_RE.search(line):
            continue
        rest = (line[:match.start()] + ' ' + line[match.end():]).strip(' |,-\t')
        if len(rest.split()) <= 3 and any(EDUCATION_LINE_RE.search(prev) for prev in lines[max(0, i - 2):i]):
            continue
        out.append((line, i))
    return out


def years_from_date_ranges(text, today=None):
    """Total work experience from date ranges, skipping education lines and merging overlaps."""
    today = today or datetime.now()
    spans = []
    for line, _ in work_date_lines(text):
        for m in DATE_RANGE_RE.finditer(line):
            start = int(m.group(2)) + (_MONTHS.get((m.group(1) or 'jan')[:3].lower(), 1) - 1) / 12
            if m.group(3):
                end = today.year + (today.month - 1) / 12
            else:
                end = int(m.group(5)) + (_MONTHS.get((m.group(4) or 'dec')[:3].lower(), 12) - 1) / 12
            if 1970 <= start <= end <= today.year + 1:
                spans.append((start, end))
    total, last_end = 0.0, None
    for start, end in sorted(spans):
        if last_end is not None and start < last_end:
            start = last_end
        if end > start:
            total += end - start
            last_end = end if last_end is None else max(last_end, end)
    return int(round(min(total, 45)))


class ResumeAnalyzer:
    """Resume analysis with experience, education and contact extraction."""

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def analyze_resume(self, file_path):
        try:
            text = extract_text_from_pdf(file_path)
            data = analyze_text(text)
            experience_summary = self._extract_experience_info(text)
            contact_info = self._extract_contact_info(text)
            return {
                'extracted_skills': data['skills'],
                'experience_summary': experience_summary,
                'education_info': self._extract_education_info(text),
                'contact_info': contact_info,
                'ats_analysis': data['ats_analysis'],
                'raw_text': text,
                'analysis_summary': {
                    'total_skills_found': len(data['skills']),
                    'text_length': len(text),
                    'ats_score': data['ats_analysis']['score'],
                    'has_contact_info': bool(contact_info.get('email') or contact_info.get('phone')),
                    'estimated_experience': experience_summary.get('total_years', 0),
                },
            }
        except Exception as exc:
            self.logger.error('Error analyzing resume: %s', exc)
            raise ValueError(f'Failed to analyze resume: {exc}')

    def _extract_experience_info(self, text):
        """Years of experience and experience level from resume text."""
        info = {'total_years': 0, 'companies': [], 'positions': [], 'experience_level': 'Entry'}
        try:
            patterns = [
                r'(\d+)\+?\s*years?\s*(?:of\s*)?experience',
                r'experience[:\s]*(\d+)\+?\s*years?',
                r'(\d+)\+?\s*years?\s*(?:in|of)',
                r'over\s*(\d+)\s*years?',
                r'more\s*than\s*(\d+)\s*years?',
            ]
            lower = text.lower()
            for pattern in patterns:
                matches = [int(m) for m in re.findall(pattern, lower) if int(m) <= 50]
                if matches:
                    info['total_years'] = max(matches)
                    break
            if not info['total_years']:
                # Most Indian resumes give dates ("2019 - Present") rather than a total
                info['total_years'] = years_from_date_ranges(text)

            years = info['total_years']
            info['experience_level'] = (
                'Entry' if years == 0 else 'Junior' if years <= 2 else 'Mid-level' if years <= 5
                else 'Senior' if years <= 10 else 'Executive'
            )

            company_patterns = [
                r'(?:worked?\s*(?:at|for|with)|employed\s*(?:at|by))\s+([A-Z][A-Za-z\s&]+?(?:Pvt\.?\s?Ltd\.?|Private Limited|Limited|Ltd\.?|LLP)?)(?=[,.\n]|$)',
                r'\b([A-Z][A-Za-z&]+(?:\s[A-Z][A-Za-z&]+){0,4}\s(?:Pvt\.?\s?Ltd\.?|Private Limited|Limited|Ltd\.?|LLP|Technologies|Solutions|Infotech|Consultancy Services))\b',
            ]
            companies = set()
            for pattern in company_patterns:
                companies.update(m.strip() for m in re.findall(pattern, text) if len(m.strip()) > 2)
            info['companies'] = list(companies)[:5]
        except Exception as exc:
            self.logger.warning('Error extracting experience info: %s', exc)
        return info

    def _extract_education_info(self, text):
        info = {'degrees': [], 'institutions': [], 'graduation_years': [], 'cgpa': None}
        try:
            degrees = []
            for match in DEGREE_RE.finditer(text):
                label = re.sub(r'[\s.]', '', match.group()).upper().replace('PHD', 'PhD')
                if label not in degrees:
                    degrees.append(label)
            info['degrees'] = degrees
            institutions = re.findall(r'\b((?:[A-Z][A-Za-z.&]+\s){0,6}(?:University|Institute|College|IIT|NIT|IIIT|IIM|BITS|Vidyalaya|School)'
                                      r'(?:\s(?:of|for)\s[A-Z][A-Za-z&]+(?:\s[A-Z][A-Za-z&]+){0,4})?)', text)
            info['institutions'] = list(dict.fromkeys(i.strip() for i in institutions))[:4]
            cgpa = re.search(r'(?i)\b(?:cgpa|cpi|gpa)\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*(?:/\s*10)?', text)
            info['cgpa'] = float(cgpa.group(1)) if cgpa and float(cgpa.group(1)) <= 10 else None
            years = {int(y) for y in re.findall(r'\b(19\d{2}|20\d{2})\b', text) if 1950 <= int(y) <= datetime.now().year + 4}
            info['graduation_years'] = sorted(years)
        except Exception as exc:
            self.logger.warning('Error extracting education info: %s', exc)
        return info

    def _extract_contact_info(self, text):
        info = {'email': None, 'phone': None, 'linkedin': None, 'location': None}
        try:
            email = EMAIL_RE.search(text)
            info['email'] = email.group() if email else None
            phone = next((m.group().strip() for m in PHONE_RE.finditer(text)
                          if 10 <= len(re.sub(r'\D', '', m.group())) <= 13), None)
            info['phone'] = phone
            linkedin = re.search(r'(?i)(?:https?://)?(?:www\.)?linkedin\.com/in/[\w-]+', text)
            info['linkedin'] = linkedin.group().lower() if linkedin else None
            city = CITY_RE.search(text[:1500])  # the header area, where candidates put their city
            info['location'] = city.group(1) if city else None
        except Exception as exc:
            self.logger.warning('Error extracting contact info: %s', exc)
        return info
