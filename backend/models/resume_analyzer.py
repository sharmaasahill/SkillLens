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
import logging
import re
from datetime import datetime

import PyPDF2

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Vocabulary
# ---------------------------------------------------------------------------

SKILLS = [
    # Programming languages
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "ruby", "php", "swift", "kotlin", "r", "sql",
    "bash", "rust", "scala", "perl", "matlab", "julia",
    # Web development
    "react", "angular", "vue", "next.js", "node.js", "express", "django", "flask", "spring", "fastapi", "laravel",
    "asp.net", "graphql", "rest api", "html", "css", "sass", "bootstrap", "tailwind", "jquery",
    # Data science and ML
    "tensorflow", "pytorch", "scikit-learn", "keras", "xgboost", "pandas", "numpy", "matplotlib", "seaborn", "plotly",
    "jupyter", "spark", "hadoop", "hive", "pyspark", "scipy", "statsmodels",
    # Cloud and DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins", "gitlab ci", "github actions", "git",
    "linux", "ansible", "puppet", "chef", "prometheus", "grafana", "elk stack",
    # Databases
    "mongodb", "mysql", "postgresql", "sqlite", "redis", "cassandra", "elasticsearch", "neo4j", "dynamodb", "oracle",
    "sql server",
    # AI and ML specialised
    "nlp", "computer vision", "deep learning", "llm", "bert", "gpt", "huggingface", "mlops", "feature engineering",
    "reinforcement learning", "transfer learning", "gan", "cnn", "rnn", "lstm",
    # Business intelligence
    "power bi", "tableau", "looker", "qlik", "excel", "bigquery", "snowflake", "redshift", "databricks", "alteryx", "sas",
    # Soft skills
    "leadership", "communication", "problem solving", "teamwork", "critical thinking", "agile", "scrum",
    "collaboration", "project management", "time management", "adaptability", "creativity",
    # Security
    "cybersecurity", "penetration testing", "security analysis", "network security", "cryptography", "siem", "soc",
    "vulnerability assessment",
    # Mobile
    "android", "ios", "react native", "flutter", "xamarin", "mobile app development",
    # Testing
    "unit testing", "integration testing", "end-to-end testing", "selenium", "jest", "pytest", "junit", "cypress",
    "test automation",
    # Data and marketing
    "seo", "sem", "analytics", "data analysis", "data visualization", "data reporting", "data modeling",
    "data warehousing", "data integration", "data cleansing", "data transformation", "data governance",
]

INDUSTRY_KEYWORDS = [
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

# Other ways people write the same skill
ALIASES = {
    'node.js': ['nodejs', 'node js'],
    'next.js': ['nextjs'],
    'react': ['react.js', 'reactjs'],
    'vue': ['vue.js', 'vuejs'],
    'scikit-learn': ['sklearn', 'scikit learn'],
    'postgresql': ['postgres'],
    'kubernetes': ['k8s'],
    'machine learning': ['ml engineering'],
    'ci/cd': ['ci cd', 'continuous integration'],
    'a/b testing': ['ab testing', 'a b testing'],
}

# Short or everyday words that only count as a skill when written the way the tool is named
CASE_SENSITIVE = {
    'r': r'(?<![A-Za-z0-9])R(?![A-Za-z0-9&\'.\-])',
    'go': r'(?<![A-Za-z0-9])(?:Go(?![\-a-z])|Golang|golang)(?![A-Za-z0-9])',
    'spring': r'\bSpring(?:\s?Boot)?\b',
    'excel': r'\b(?:MS\s)?Excel\b',
    'express': r'\bExpress(?:\.js)?\b',
    'oracle': r'\bOracle\b',
    'gan': r'\bGANs?\b',
    'soc': r'\bSOC\b',
    'sas': r'\bSAS\b',
    'hive': r'\bHive\b',
    'jest': r'\bJest\b',
    'bert': r'\bBERT\b',
    'chef': r'\bChef\b',
    'puppet': r'\bPuppet\b',
    'swift': r'\bSwift\b',
    'rust': r'\bRust\b',
    'julia': r'\bJulia\b',
    'looker': r'\bLooker\b',
    'flutter': r'\bFlutter\b',
    'rest': r'\bREST(?:ful)?\b',
    'api': r'\bAPIs?\b',
    'logging': r'\blogging\b',
    'monitoring': r'\bmonitoring\b',
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


SKILL_PATTERNS = _compile_terms(SKILLS)
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
    ('education', 5, ['education', 'academic background', 'academics', 'qualifications']),
    ('skills', 5, ['technical skills', 'core competencies', 'skills', 'technologies', 'tech stack']),
    ('summary', 2, ['professional summary', 'summary', 'objective', 'profile', 'about me']),
    ('projects', 2, ['projects', 'certifications', 'achievements', 'awards', 'publications', 'certificates']),
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
    re.compile(r'(?i)\b\d+(?:\.\d+)?\s?(?:x|k|m|mn|million|billion|lakhs?|crores?)\b'),
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


# ---------------------------------------------------------------------------
# Text extraction
# ---------------------------------------------------------------------------

def extract_text_from_pdf(file_path):
    """Extract text from a PDF, using pdfplumber when installed and PyPDF2 otherwise."""
    text = ''
    if PDFPLUMBER_AVAILABLE:
        try:
            with pdfplumber.open(file_path) as pdf:
                text = '\n'.join(page.extract_text() or '' for page in pdf.pages)
            if text.strip():
                return _normalise(text)
        except Exception as exc:
            logger.warning('pdfplumber failed: %s', exc)

    with open(file_path, 'rb') as handle:
        reader = PyPDF2.PdfReader(handle)
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


def extract_skills_simple(text):
    """Skills from the known vocabulary, matched as whole words."""
    return _match_terms(text, SKILL_PATTERNS)


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
    if words < 100:
        # Too little text to judge formatting, so these points are not given away for free
        formatting = part('formatting', 'ATS-safe formatting', 0, 10, 'Not enough content to assess')
    else:
        formatting = part('formatting', 'ATS-safe formatting', 10 - 4 * len(problematic), 10,
                          'Clean' if not problematic else f'{len(problematic)} issue(s)')

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
    }


def analyze_text(text):
    """Skills and ATS analysis for already-extracted resume text."""
    if not text or not text.strip():
        raise ValueError('No text could be extracted from the resume')
    text = _normalise(text)
    skills = extract_skills_simple(text)
    return {'skills': skills, 'text': text, 'ats_analysis': check_ats_compatibility(text, skills)}


def extract_skills_from_resume(file_path):
    """Extract text from a PDF resume, then find skills and score it."""
    try:
        return analyze_text(extract_text_from_pdf(file_path))
    except Exception as exc:
        logger.error('Error in extract_skills_from_resume: %s', exc)
        raise ValueError(f'Failed to analyze resume: {exc}')


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

            years = info['total_years']
            info['experience_level'] = (
                'Entry' if years == 0 else 'Junior' if years <= 2 else 'Mid-level' if years <= 5
                else 'Senior' if years <= 10 else 'Executive'
            )

            company_patterns = [
                r'(?:worked?\s*(?:at|for)|employed\s*(?:at|by))\s+([A-Z][A-Za-z\s&]+(?:Inc|LLC|Corp|Company|Ltd)?)',
                r'\b([A-Z][A-Za-z\s&]+(?:Inc|LLC|Corp|Company|Ltd))\b',
            ]
            companies = set()
            for pattern in company_patterns:
                companies.update(m.strip() for m in re.findall(pattern, text) if len(m.strip()) > 2)
            info['companies'] = list(companies)[:5]
        except Exception as exc:
            self.logger.warning('Error extracting experience info: %s', exc)
        return info

    def _extract_education_info(self, text):
        info = {'degrees': [], 'institutions': [], 'graduation_years': []}
        try:
            degree_patterns = [
                r'\b(?:bachelor|master|phd|doctorate|diploma|certificate|associate)s?\s*(?:of\s*)?(?:science|arts|engineering|business|technology)?\b',
                r'\b(?:bs|ba|ms|ma|mba|phd|btech|mtech)\b',
            ]
            degrees = set()
            for pattern in degree_patterns:
                degrees.update(re.findall(pattern, text.lower()))
            info['degrees'] = sorted(degrees)

            years = {int(y) for y in re.findall(r'\b(19\d{2}|20\d{2})\b', text) if 1950 <= int(y) <= datetime.now().year}
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
            location = re.search(r'\b([A-Z][a-z]+),\s*([A-Z]{2})\b', text)
            info['location'] = f'{location.group(1)}, {location.group(2)}' if location else None
        except Exception as exc:
            self.logger.warning('Error extracting contact info: %s', exc)
        return info
