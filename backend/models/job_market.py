"""What Indian employers ask for, from 97,000+ Naukri.com postings (September-October 2025).

The postings themselves have expired, so they are not offered as jobs to apply to. They are still a
good picture of demand: for a target role, which skills postings list and how often. That powers
"Market fit" on the resume page, and the job title suggestions on the salary page.

Skills are compared by key (see skills_taxonomy), so "Spring Boot", "springboot" and "spring-boot"
count as one skill. The index is a sparse postings-by-skills matrix, built once at startup.
"""
import logging
import re
from collections import Counter
from functools import lru_cache
from typing import Dict, List

import numpy as np
import pandas as pd
import scipy.sparse as sp

from . import india_data, skills_taxonomy

logger = logging.getLogger(__name__)

# Spellings in posting tags that the taxonomy does not cover
SKILL_ALIASES = {
    'ml': 'machine learning', 'dl': 'deep learning', 'ai': 'artificial intelligence',
    'nlp': 'natural language processing', 'cv': 'computer vision',
    'communication': 'communication skills', 'team work': 'teamwork',
    'api': 'api design', 'apis': 'api design', 'aws infrastructure': 'aws', 'aws cloud': 'aws',
}

# Tags that say nothing about a skill ("development", the "boot" of "spring, boot")
NOISE_TAGS = {
    'development', 'software development', 'application development', 'coding', 'programming', 'engineering',
    'technical', 'technology', 'it', 'software', 'boot', 'fresher', 'senior', 'manager technology', 'usage',
    'generation', 'handling', 'process', 'data', 'design', 'management', 'computer science', 'information technology',
    'analysis', 'project', 'field', 'general', 'team', 'office', 'corporate', 'international', 'quality', 'digital',
    'control', 'sr', 'assistance', 'focus', 'voice', 'calling', 'end', 'back', 'front', 'stack', 'full',
}
GENERIC_WORDS = {'development', 'developer', 'developers', 'engineering', 'engineer', 'programming', 'coding', 'software',
                 'technical', 'application', 'applications', 'it', 'professional'}

# Role words that mean the same thing in job titles, and words that only set seniority
SAME_ROLE = {'developer', 'engineer', 'programmer', 'sde'}
SENIORITY = {'senior', 'junior', 'lead', 'principal', 'associate', 'trainee', 'intern', 'fresher', 'staff', 'head',
             'i', 'ii', 'iii', 'iv', '1', '2', '3', 'sr', 'jr', 'executive'}
MIN_POSTINGS = 25
MIN_COMPANIES = 8
TOP_SKILLS = 15
UPPER_WORDS = {'qa', 'ui', 'ux', 'hr', 'it', 'sap', 'aws', 'ai', 'ml', 'bi', 'sde', 'sql', 'erp', 'crm', 'seo', 'gcp',
               'etl', 'mis', 'bpo', 'kyc', 'gst', 'php', 'ios', 'devops', 'dba', 'abap', 'fico', 'qc'}


@lru_cache(maxsize=131072)
def canonical_skill(skill: str) -> str:
    """One key per skill however it is written, shared with the resume analyzer's taxonomy."""
    s = re.sub(r'\s+', ' ', str(skill).lower()).strip(' .,;')
    s = SKILL_ALIASES.get(s, s)
    # "copy writing" and "copywriting" are one skill
    return skills_taxonomy.key_for(s) or (' ' in s and skills_taxonomy.key_for(s.replace(' ', ''))) or s


def skill_label(tag: str) -> str:
    """How a posting's skill tag is shown ("spring boot" -> "Spring Boot")."""
    return skills_taxonomy.display_name(tag, fallback='sentence')


def title_label(title_norm: str) -> str:
    """Display form of a normalised title ("sap abap developer" -> "SAP ABAP Developer")."""
    return ' '.join(w.upper() if w in UPPER_WORDS else w.capitalize() for w in title_norm.split())


def _compact_title(text: str) -> str:
    """Title form for role matching: "back end" and "back-end" both become "backend"."""
    return re.sub(r'\b(back|front|full)[\s-]?(end|stack)\b', r'\1\2', text)


class JobMarket:
    def __init__(self, jobs=None):
        df = india_data.load_jobs() if jobs is None else jobs.reset_index(drop=True)
        self.size = len(df)
        self.titles = df['title_norm'].astype(str).map(_compact_title)
        self.title_counts = df['title_norm'].astype(str).value_counts()
        self.company = pd.factorize(df['company'].astype(str).str.lower().str.strip())[0]
        self.exp_min = df['exp_min'].to_numpy(dtype=np.float32)
        self.vocab: Dict[str, int] = {}
        self.label: Dict[str, str] = {}  # key -> how the most common spelling reads
        rows, cols, spellings = [], [], Counter()
        for i, text in enumerate(df['skills'].astype(str)):
            keys = set()
            for tag in text.split('|'):
                if not tag:
                    continue
                key = canonical_skill(tag)
                spellings[(key, tag)] += 1
                keys.add(key)
            for key in keys:
                cols.append(self.vocab.setdefault(key, len(self.vocab)))
                rows.append(i)
        self.matrix = sp.csr_matrix((np.ones(len(rows), dtype=np.float32), (rows, cols)), shape=(self.size, len(self.vocab)))
        self.skill_counts = np.asarray(self.matrix.sum(axis=0)).ravel()
        self.names = np.array(list(self.vocab), dtype=object)
        for (key, tag), _ in sorted(spellings.items(), key=lambda kv: -kv[1]):
            known = skills_taxonomy.SKILLS.get(key)
            self.label.setdefault(key, known.name if known else skill_label(tag))
        logger.info('Market index: %d postings, %d distinct skills', self.size, len(self.vocab))

    # ----- titles -----
    def popular_titles(self, min_count=3, limit=None) -> List[str]:
        """Titles seen in at least `min_count` postings, most common first, for suggestions."""
        titles = [t for t, n in self.title_counts.items()
                  if n >= min_count and 2 < len(t) <= 60 and not any(ch.isdigit() for ch in t)]
        return [title_label(t) for t in titles[:limit]]

    def guess_role(self, *texts) -> str:
        """The most specific common job title found in the given texts (for example a resume headline)."""
        common = [t for t, n in self.title_counts.items() if n >= 20 and len(t.split()) >= 2]
        best = ''
        for text in texts:
            low = ' ' + re.sub(r'[^a-z0-9+#. ]', ' ', str(text or '').lower()) + ' '
            for title in common:
                if len(title) > len(best) and f' {title} ' in low:
                    best = title
            if best:
                break
        return title_label(best) if best else ''

    # ----- role matching -----
    def _role_rows(self, role):
        words = [w for w in _compact_title(india_data.normalise_title(role)).split() if w not in SENIORITY]
        others = [w for w in words if w not in SAME_ROLE]
        needs_role_word = len(others) < len(words)
        if not others and not needs_role_word:
            return np.array([], dtype=int), ''

        def rows_for(ws):
            mask = np.ones(self.size, dtype=bool)
            for w in ws:
                mask &= self.titles.str.contains(rf'(?<![a-z0-9]){re.escape(w)}(?![a-z0-9])', regex=True).to_numpy()
            if needs_role_word:
                mask &= self.titles.str.contains(r'\b(?:developer|engineer|programmer|sde)\b', regex=True).to_numpy()
            return np.flatnonzero(mask)

        rows = rows_for(others)
        # Too few postings or employers for every word: drop the most common word first ("application" before "cloud")
        while (len(rows) < MIN_POSTINGS or len(np.unique(self.company[rows])) < MIN_COMPANIES) and len(others) > 1:
            freq = {w: self.titles.str.contains(rf'\b{re.escape(w)}\b', regex=True).sum() for w in others}
            others = [w for w in others if w != max(freq, key=freq.get)]
            rows = rows_for(others)
        used = ' '.join(others + (['developer / engineer'] if needs_role_word else []))
        return rows, used

    # ----- market fit -----
    def role_fit(self, role: str, resume_skills: List[str], resume_text: str = '') -> Dict:
        """How well a resume covers the skills that postings for `role` ask for."""
        role = (role or '').strip()
        rows, matched_on = self._role_rows(role) if role else (np.array([], dtype=int), '')
        companies, codes = np.unique(self.company[rows], return_inverse=True) if len(rows) else (np.array([]), None)
        base = {'role': role, 'matched_on': matched_on, 'postings': int(len(rows)), 'companies': int(len(companies)),
                'source': india_data.SOURCE}
        if len(companies) < MIN_COMPANIES:
            return {**base, 'skills': [], 'coverage': None, 'typical_experience': None}

        have_keys = {canonical_skill(s) for s in resume_skills}
        have_keys |= {canonical_skill(skills_taxonomy.SKILLS[k].name) for k in self._resume_keys(resume_text)}
        low_text = (resume_text or '').lower()
        role_norm = india_data.normalise_title(role)
        role_words = set(role_norm.split()) | SAME_ROLE

        # Share of hiring companies that ask for each skill, so one employer's many postings count once
        by_company = sp.csr_matrix((np.ones(len(rows), dtype=np.float32), (codes, np.arange(len(rows)))),
                                   shape=(len(companies), len(rows)))
        asked = (by_company @ self.matrix[rows]) > 0
        share = np.asarray(asked.sum(axis=0)).ravel() / len(companies)
        out = []
        for j in np.argsort(-share):
            if share[j] < 0.03 or len(out) >= TOP_SKILLS:
                break
            key = self.names[j]
            words = set(key.split())
            known = skills_taxonomy.key_for(key) is not None
            if (key in NOISE_TAGS or key == role_norm or (not known and words <= role_words | GENERIC_WORDS)
                    or (len(words) > 1 and words & GENERIC_WORDS and words <= role_words | GENERIC_WORDS)):
                continue
            has = key in have_keys or (len(key) > 2 and re.search(rf'(?<![a-z0-9]){re.escape(key)}(?![a-z0-9])', low_text) is not None)
            out.append({'skill': self.label.get(key, skill_label(key)), 'share': round(float(share[j]) * 100, 1), 'have': bool(has)})

        total = sum(s['share'] for s in out) or 1
        coverage = round(sum(s['share'] for s in out if s['have']) / total * 100)
        exp = self.exp_min[rows]
        return {**base, 'skills': out, 'coverage': coverage, 'typical_experience': float(np.median(exp)) if len(exp) else None}

    @staticmethod
    def _resume_keys(text):
        return {key for _, _, key in skills_taxonomy.scan(text or '')}
