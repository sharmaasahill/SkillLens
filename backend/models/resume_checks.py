"""Recruiter checks that need no AI: the things a careful recruiter notices on a second read.

    repeated_verbs     the same opening verb on many bullets ("Developed" six times)
    unproven_skills    skills in the skills list that no job, project or achievement shows you using
    timeline           jobs that overlap, gaps between jobs, more than one "Present" role
    first_person       "I", "my" and "me", which most resume styles leave out

Everything here works on the plain text the ATS reads, so it copes with PDFs that lose bullet
symbols or mix up the order of columns.
"""
import re
from datetime import datetime

from . import skills_taxonomy as taxonomy
from .resume_analyzer import DATE_RANGE_RE, STRONG_VERBS, _list_line_skills, work_date_lines

# Past-tense verbs that commonly open a resume bullet, beyond the "strong" list used for scoring
OPENING_VERBS = set(STRONG_VERBS) | set('''
added analysed analyzed applied assembled assisted authored automated balanced boosted coded collaborated completed
conducted configured consolidated constructed contributed converted debugged defined delivered demonstrated deployed
developed devised documented edited enabled ensured evaluated expanded extended facilitated formulated founded handled
headed helped hired identified initiated installed integrated introduced investigated maintained mapped measured merged
modelled modeled modernised modernized monitored negotiated operated organised organized oversaw participated partnered
performed piloted planned prepared presented processed produced profiled programmed proposed prototyped provided
published raised ran rebuilt recognised recognized recruited redesigned refactored released replaced reported
researched restructured revamped reviewed rewrote secured selected served set simplified solved sourced standardised
standardized structured supported surveyed tested trained translated tuned upgraded used utilised utilized validated
verified won worked wrote containerized containerised dockerized orchestrated authenticated
'''.split())

ALTERNATIVES = {
    'developed': ['Engineered', 'Designed', 'Created', 'Shipped'],
    'built': ['Architected', 'Launched', 'Set up', 'Assembled'],
    'implemented': ['Introduced', 'Rolled out', 'Delivered', 'Applied'],
    'created': ['Designed', 'Produced', 'Established'],
    'managed': ['Led', 'Oversaw', 'Directed', 'Coordinated'],
    'worked': ['Collaborated', 'Partnered', 'Contributed'],
    'led': ['Directed', 'Headed', 'Drove'],
    'added': ['Introduced', 'Extended', 'Wrote'],
    'integrated': ['Connected', 'Unified', 'Wired up'],
    'designed': ['Architected', 'Modelled', 'Planned'],
    'improved': ['Boosted', 'Raised', 'Strengthened'],
    'handled': ['Managed', 'Resolved', 'Processed'],
    'helped': ['Supported', 'Enabled', 'Contributed to'],
    'used': ['Applied', 'Leveraged', 'Ran'],
    'responsible': ['Owned', 'Led', 'Ran'],
}
GENERAL_ALTERNATIVES = ['Delivered', 'Drove', 'Streamlined', 'Automated']

_BULLET_GLYPHS = re.compile(r'^[\s\u2022\u25cf\u25aa\u25e6\u25a0\u27a2\u27a4\u25ba\u2023\u2043*\-\u2013\u00b7]+')
_FIRST_PERSON = re.compile(r"\b(?:I|I'm|I've|my|My|me)\b")
_SKILLS_HEADING = re.compile(r'(?i)\b(?:technical skills|skills|core competencies|tech stack|technologies)\b')
_OTHER_HEADING = re.compile(
    r'^(?:professional |work )?(?:experience|employment|education|projects?|certifications?|achievements?|awards|'
    r'summary|profile|objective|internships?|training|publications|languages|interests|hobbies)\b', re.IGNORECASE)

# Skills that are proven by others: a PostgreSQL project shows SQL, a GitHub Actions setup shows CI/CD
IMPLIED_BY = {
    'sql': {'postgresql', 'mysql', 'sqlite', 'sql server', 'oracle', 'pl/sql', 'mariadb', 't-sql', 'sqlalchemy'},
    'javascript': {'typescript', 'react', 'node.js', 'next.js', 'express', 'nestjs', 'angular', 'vue', 'jquery'},
    'git': {'github', 'gitlab', 'bitbucket', 'github actions'},
    'ci/cd': {'github actions', 'jenkins', 'gitlab ci', 'circleci', 'argo cd', 'travis ci'},
    'containerization': {'docker', 'kubernetes'},
    'html': {'react', 'next.js', 'angular', 'vue'},
    'css': {'tailwind css', 'sass', 'bootstrap'},
}

MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']


# ----- bullets -----

def bullets(text):
    """Bullet points as single lines. A bullet starts at a bullet symbol or an opening verb, and runs on
    over wrapped lines until the next bullet or a line that looks like a heading."""
    out, current = [], None
    for raw in text.split('\n'):
        line = raw.strip()
        if not line:
            continue
        has_glyph = bool(_BULLET_GLYPHS.match(line)) and not line.startswith('--')
        body = _BULLET_GLYPHS.sub('', line).strip()
        first = re.match(r"[A-Za-z]+", body)
        starts_with_verb = bool(first) and body[:1].isupper() and first.group().lower() in OPENING_VERBS
        if has_glyph or starts_with_verb:
            if current:
                out.append(current)
            current = body
        elif current and (body[:1].islower() or (
                not _looks_like_heading(body) and len(current) < 400 and not DATE_RANGE_RE.search(body)
                and '|' not in body and not _list_line_skills(body))):
            current = f'{current} {body}'  # a wrapped line of the same bullet
        else:
            if current:
                out.append(current)
            current = None
    if current:
        out.append(current)
    return [b for b in out if len(b.split()) >= 5]


def _looks_like_heading(line):
    letters = re.sub(r'[^A-Za-z]', '', line)
    return bool(letters) and (line.isupper() or _OTHER_HEADING.match(line) is not None) and len(line) < 50


def repeated_verbs(items):
    counts = {}
    for b in items:
        word = re.match(r"[A-Za-z]+", b)
        if word and word.group().lower() in OPENING_VERBS:
            counts[word.group().lower()] = counts.get(word.group().lower(), 0) + 1
    limit = max(3, round(len(items) * 0.15))
    return [{'verb': verb.capitalize(), 'count': n, 'alternatives': ALTERNATIVES.get(verb, GENERAL_ALTERNATIVES)}
            for verb, n in sorted(counts.items(), key=lambda kv: -kv[1]) if n >= limit]


# ----- skills listed but not shown -----

def unproven_skills(text):
    """Skills named only in skills lists, never in a job, project or achievement."""
    claimed, shown, evidence = {}, set(), []
    in_skills = False
    for raw in text.split('\n'):
        line = raw.strip()
        if not line:
            continue
        line_skills = _list_line_skills(line)
        labelled = bool(re.match(r'^[^:]{1,40}:\s*\S', _BULLET_GLYPHS.sub('', line)))
        # A skills heading may be glued to other text by the PDF ("...DevelopmentTECHNICAL SKILLS")
        if _SKILLS_HEADING.search(line) and len(line) < 90 and not line_skills:
            in_skills = True
            continue
        if in_skills and (_looks_like_heading(line) or not line_skills):
            in_skills = False
        if line_skills and (labelled or in_skills):
            for key, name, _ in line_skills:
                if key:
                    claimed.setdefault(key, name)
            continue
        evidence.append(line)
        shown.update(key for key, _, _ in line_skills if key)
    # Scanned as one text, so a skill wrapped over two lines ("GitHub" / "Actions") still counts
    shown.update(key for _, _, key in taxonomy.scan('\n'.join(evidence)))
    for skill, proofs in IMPLIED_BY.items():
        if shown & proofs:
            shown.add(skill)
    cloud = {k for k in shown if taxonomy.SKILLS.get(k) and taxonomy.SKILLS[k].category == 'Cloud'}
    if any(taxonomy.SKILLS[k].name.startswith(('AWS', 'Amazon')) for k in cloud):
        shown.add('aws')
    soft = {'Soft skills', 'Spoken languages'}
    return [name for key, name in claimed.items()
            if key not in shown and taxonomy.SKILLS.get(key) and taxonomy.SKILLS[key].category not in soft]


# ----- timeline -----

def _month_index(month, year):
    return int(year) * 12 + (MONTHS.index(month[:3].lower()) if month else 0)


def _label_for(lines, index, match_start):
    """The role a date range belongs to: the text before it, or the nearest "Company | Role" line above."""
    before = lines[index][:match_start].strip(' |,-\t')
    if before and '|' in before or (before and before[:1].isupper() and not before.endswith('.') and len(before) <= 90):
        return before
    for prev in reversed(lines[max(0, index - 14):index]):
        p = prev.strip()
        if '|' in p and not DATE_RANGE_RE.search(p) and len(p) <= 90:
            return p
    return before or 'A role'


def timeline(text, today=None):
    today = today or datetime.now()
    now = today.year * 12 + today.month - 1
    lines = text.split('\n')
    roles = []
    for line, i in work_date_lines(text):
        m = DATE_RANGE_RE.search(line)
        start = _month_index(m.group(1), m.group(2))
        end = now if m.group(3) else _month_index(m.group(4) or 'dec', m.group(5))
        if end < start or start < 1970 * 12:
            continue
        roles.append({'label': _label_for(lines, i, m.start()), 'start': start, 'end': end,
                      'present': bool(m.group(3)), 'dates': m.group().strip()})
    roles.sort(key=lambda r: r['start'])

    notes = []
    for a_i, a in enumerate(roles):
        for b in roles[a_i + 1:]:
            months = min(a['end'], b['end']) - b['start']
            if months >= 1:
                notes.append({'kind': 'overlap', 'months': months,
                              'text': f"{_short(b['label'])} ({b['dates']}) overlaps {_short(a['label'])} ({a['dates']}). "
                                      'Fine for freelance, part-time or a side project, but say so, because recruiters ask.'})
    for a, b in zip(roles, roles[1:]):
        gap = b['start'] - max(r['end'] for r in roles[:roles.index(b)])
        if gap > 6:
            notes.append({'kind': 'gap', 'months': gap,
                          'text': f"About {gap} months between roles before {_short(b['label'])}. "
                                  'A one-line reason (study, a course, a family move) stops recruiters guessing.'})
    if sum(r['present'] for r in roles) > 1:
        notes.append({'kind': 'present', 'months': 0,
                      'text': 'More than one role says "Present". Check whether they really run at the same time.'})
    return notes


def _short(label):
    label = re.sub(r'\s+', ' ', label).strip()
    return label if len(label) <= 60 else label[:57].rsplit(' ', 1)[0] + '...'


# ----- all together -----

def review(text):
    items = bullets(text)
    first_person = len(_FIRST_PERSON.findall(text))
    return {
        'bullet_count': len(items),
        'repeated_verbs': repeated_verbs(items),
        'unproven_skills': unproven_skills(text),
        'timeline': timeline(text),
        'first_person': first_person if first_person >= 2 else 0,
    }
