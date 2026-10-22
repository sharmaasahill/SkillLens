"""Job matching against 97,000+ Indian job postings (Naukri.com, 2025).

Skills are matched as whole tags (so "R" never matches "React"), weighted by rarity:
sharing "PyTorch" with a posting says more than sharing "communication skills". Each
posting's own experience range is used for the experience fit. Scoring is vectorised
with a sparse jobs-by-skills matrix, so a request takes a few milliseconds.
"""
import logging
import re
from collections import Counter
from typing import Any, Dict, List
from urllib.parse import quote

import numpy as np
import scipy.sparse as sp

from . import india_data

logger = logging.getLogger(__name__)

# Different spellings of the same skill, after lowercasing
SKILL_ALIASES = {
    'reactjs': 'react', 'react.js': 'react', 'react js': 'react',
    'nodejs': 'node.js', 'node js': 'node.js', 'node': 'node.js',
    'nextjs': 'next.js', 'vuejs': 'vue', 'vue.js': 'vue', 'angularjs': 'angular', 'angular js': 'angular',
    'expressjs': 'express', 'express.js': 'express',
    'sklearn': 'scikit-learn', 'scikit learn': 'scikit-learn',
    'ml': 'machine learning', 'dl': 'deep learning', 'ai': 'artificial intelligence',
    'nlp': 'natural language processing', 'cv': 'computer vision',
    'microsoft azure': 'azure', 'amazon web services': 'aws', 'google cloud': 'gcp', 'google cloud platform': 'gcp',
    'postgres': 'postgresql', 'mongo': 'mongodb', 'k8s': 'kubernetes',
    'ms excel': 'excel', 'advanced excel': 'excel', 'microsoft excel': 'excel',
    'restful api': 'rest api', 'rest apis': 'rest api', 'restful': 'rest api', 'rest': 'rest api',
    'ci cd': 'ci/cd', 'cicd': 'ci/cd', 'continuous integration': 'ci/cd',
    'golang': 'go', 'c sharp': 'c#', 'dot net': '.net', 'asp.net core': 'asp.net', 'powerbi': 'power bi',
    'communication': 'communication skills', 'team work': 'teamwork', 'tally erp': 'tally', 'tally prime': 'tally',
    'html5': 'html', 'css3': 'css', 'spring-boot': 'spring boot', 'springboot': 'spring boot',
}

CATEGORY_RULES = [
    ('Data Science', r'data scien|data analy|analytics|machine learning|\bml\b|\bai\b|artificial intelligence|deep learning|\bnlp\b|business intelligence|\bbi\b'),
    ('DevOps/Cloud', r'devops|cloud|\bsre\b|reliability|infrastructure|platform engineer|kubernetes|\baws\b|azure'),
    ('Software Development', r'software|developer|programmer|full ?stack|front ?end|back ?end|\bsde\b|android|\bios\b|web|java|python|\.net|application (?:developer|lead|engineer)|mobile'),
    ('Quality Assurance', r'\bqa\b|test|quality assurance|automation engineer'),
    ('Design', r'design|\bui\b|\bux\b|graphic|creative|animator|interior'),
    ('Sales & Business Development', r'sales|business development|\bbde\b|\bbdm\b|relationship manager|account manager|key account|telecall|telesales|inside sales'),
    ('Marketing', r'marketing|\bseo\b|content|social media|brand|digital|copywriter'),
    ('Finance & Accounting', r'account|finance|financial|audit|\btax|\bgst\b|\bca\b|chartered|payroll|banking|credit|treasury'),
    ('Human Resources', r'\bhr\b|human resource|recruit|talent acquisition|payroll'),
    ('Customer Support', r'customer (?:support|service|care|success)|\bbpo\b|voice process|call cent|chat process|helpdesk|help desk'),
    ('Operations & Supply Chain', r'operations|supply chain|logistic|procurement|purchase|warehouse|store|inventory'),
    ('Engineering & Manufacturing', r'mechanical|electrical|civil|production|manufactur|maintenance|plant|site engineer|quality control|\bqc\b|automobile'),
    ('Healthcare', r'doctor|nurse|medical|pharma|clinical|hospital|physio|lab technician|healthcare'),
    ('Education', r'teacher|faculty|professor|tutor|trainer|educat|lecturer'),
    ('Management', r'manager|head|director|\bvp\b|vice president|lead|chief|\bcxo\b'),
]
_CATEGORY_RE = [(name, re.compile(pattern)) for name, pattern in CATEGORY_RULES]

MAX_PER_COMPANY = 2


def canonical_skill(skill: str) -> str:
    s = re.sub(r'\s+', ' ', str(skill).lower()).strip(' .,;')
    return SKILL_ALIASES.get(s, s)


def categorize(title_norm: str) -> str:
    for name, pattern in _CATEGORY_RE:
        if pattern.search(title_norm):
            return name
    return 'Other'


def experience_label(lo: int, hi: int) -> str:
    if hi <= 0:
        return 'Fresher'
    return f'{lo}-{hi} yrs' if hi > lo else f'{lo}+ yrs'


def naukri_search_url(title: str, city: str) -> str:
    """Naukri's search page for the role in that city. The 2025 postings themselves have expired."""
    slug = re.sub(r'[^a-z0-9]+', '-', india_data.normalise_title(title)).strip('-') or 'jobs'
    place = '' if city in ('', 'Remote', 'Unspecified') else f"-in-{re.sub(r'[^a-z0-9]+', '-', city.lower()).strip('-')}"
    return f'https://www.naukri.com/{quote(slug)}-jobs{place}'


class JobRecommender:
    def __init__(self, jobs=None):
        self.jobs_df = india_data.load_jobs() if jobs is None else jobs.reset_index(drop=True)
        self._build_index()
        logger.info('Indexed %d postings and %d distinct skills', len(self.jobs_df), len(self.vocab))

    # ----- index -----
    def _build_index(self):
        df = self.jobs_df
        df['category'] = df['title_norm'].map(categorize)
        self.vocab: Dict[str, int] = {}
        rows, cols = [], []
        for i, text in enumerate(df['skills']):
            for tag in set(canonical_skill(t) for t in str(text).split('|') if t):
                cols.append(self.vocab.setdefault(tag, len(self.vocab)))
                rows.append(i)
        n_jobs, n_skills = len(df), len(self.vocab)
        self.matrix = sp.csr_matrix((np.ones(len(rows), dtype=np.float32), (rows, cols)), shape=(n_jobs, n_skills))
        self.skill_counts = np.asarray(self.matrix.sum(axis=0)).ravel()
        # Rare skills weigh more; very common soft skills weigh little
        self.idf = np.log((1 + n_jobs) / (1 + self.skill_counts)).astype(np.float32) + 1.0
        self.job_weight = np.asarray(self.matrix @ self.idf).ravel()
        self.exp_min = df['exp_min'].to_numpy(dtype=np.float32)
        self.exp_max = df['exp_max'].to_numpy(dtype=np.float32)
        self.city_lower = df['city'].str.lower().to_numpy()
        self.mode = df['work_mode'].to_numpy()
        self.category = df['category'].to_numpy()
        self.company = df['company'].to_numpy()
        names = np.array(list(self.vocab), dtype=object)
        top = np.argsort(-self.skill_counts)
        self._trending = [names[i] for i in top[:20]]

    def _user_vector(self, user_skills):
        idx = sorted({self.vocab[s] for s in (canonical_skill(x) for x in user_skills) if s in self.vocab})
        vec = np.zeros(len(self.vocab), dtype=np.float32)
        vec[idx] = 1.0
        return vec, idx

    # ----- scoring -----
    def _experience_fit(self, years):
        lo, hi = self.exp_min, np.maximum(self.exp_max, self.exp_min)
        fit = np.ones_like(lo)
        under = years < lo
        over = years > hi + 2  # a little overqualified is fine
        fit[under] = np.maximum(0.3, 1.0 - (lo[under] - years) * 0.2)
        fit[over] = np.maximum(0.5, 1.0 - (years - hi[over] - 2) * 0.08)
        return fit

    def recommend_jobs(self, user_skills: List[str], user_experience: float = 0,
                       preferred_locations: List[str] = None, preferred_categories: List[str] = None,
                       top_k: int = 10) -> List[Dict[str, Any]]:
        if not len(self.jobs_df) or not user_skills:
            return []
        vec, idx = self._user_vector(user_skills)
        if not idx:
            return []

        shared_weight = np.asarray(self.matrix @ (vec * self.idf)).ravel()
        shared_count = np.asarray(self.matrix @ vec).ravel()
        # Share of the posting's (rarity-weighted) requirements you cover, damped for postings with few tags
        skill_score = shared_weight / (self.job_weight + 2.0 * self.idf.mean())
        min_shared = 2 if len(idx) >= 3 else 1
        candidates = np.flatnonzero(shared_count >= min_shared)
        if not len(candidates):
            candidates = np.flatnonzero(shared_count >= 1)

        exp_fit = self._experience_fit(float(user_experience or 0))
        locations = [loc.lower().strip() for loc in (preferred_locations or []) if loc.strip()]
        loc_match = cat_match = None
        if locations:
            loc_match = np.array([any(l in c for l in locations) for c in self.city_lower[candidates]], dtype=bool)
            if 'remote' in locations:
                loc_match |= self.mode[candidates] == 'Remote'
        if preferred_categories:
            cat_match = np.isin(self.category[candidates], list(preferred_categories))
        # Preferences filter the list when enough postings satisfy them, otherwise they only rank
        for which in ('location', 'category'):
            match = loc_match if which == 'location' else cat_match
            if match is None or match.sum() < top_k:
                continue
            candidates = candidates[match]
            loc_match = None if loc_match is None else loc_match[match]
            cat_match = None if cat_match is None else cat_match[match]
        loc_score = np.ones(len(candidates)) if loc_match is None else np.where(loc_match, 1.2, 0.8)
        cat_score = np.ones(len(candidates)) if cat_match is None else np.where(cat_match, 1.2, 0.8)

        s = np.clip(skill_score[candidates] * 1.6, 0, 1)
        overall = s * 0.55 + exp_fit[candidates] * 0.25 + loc_score * 0.1 + cat_score * 0.1
        order = candidates[np.lexsort((candidates, -overall))]
        rank = {job: i for i, job in enumerate(candidates)}

        picked, per_company, seen_roles = [], Counter(), set()
        for job in order:
            role = (self.company[job], self.jobs_df.at[job, 'title_norm'])
            if role in seen_roles or per_company[self.company[job]] >= MAX_PER_COMPANY:
                continue
            seen_roles.add(role)
            per_company[self.company[job]] += 1
            picked.append(job)
            if len(picked) >= top_k:
                break

        user_set = {canonical_skill(x) for x in user_skills}
        results = []
        for job in picked:
            i = rank[job]
            results.append(self._job_payload(job, user_set, user_experience, float(s[i]), float(exp_fit[job]),
                                             float(loc_score[i]), float(cat_score[i]), float(overall[i])))
        return results

    def _job_payload(self, job, user_set, years, skill_score, exp_score, loc_score, cat_score, overall):
        row = self.jobs_df.loc[job]
        tags, seen = [], set()
        for tag in str(row['skills']).split('|'):
            key = canonical_skill(tag)
            if tag and key not in seen:
                seen.add(key)
                tags.append(tag)
        matched = [t for t in tags if canonical_skill(t) in user_set]
        missing = [t for t in tags if canonical_skill(t) not in user_set][:5]
        salary = None
        if row['salary_min'] >= india_data.MIN_SALARY and row['salary_max'] > 0:
            salary = {'min': int(row['salary_min']), 'max': int(row['salary_max']), 'currency': 'INR', 'period': 'year'}
        description = str(row['description'])
        return {
            'job_id': int(row['job_id']),
            'source': 'Naukri.com (2025 dataset)',
            'position': row['title'],
            'company': row['company'],
            'location': row['location'] or row['city'],
            'city': row['city'],
            'work_mode': row['work_mode'],
            'job_url': naukri_search_url(row['title'], row['city']),
            'job_url_label': 'Find similar on Naukri',
            'job_description': description + ('...' if len(description) >= india_data.DESCRIPTION_CHARS else ''),
            'required_skills': ', '.join(tags),
            'job_category': row['category'],
            'experience_level': experience_label(int(row['exp_min']), int(row['exp_max'])),
            'experience_range': {'min': int(row['exp_min']), 'max': int(row['exp_max'])},
            'salary': salary,
            'company_rating': None if row['rating'] in ('', None) or row['rating'] != row['rating'] else float(row['rating']),
            'posted': row['posted'],
            'overall_score': round(overall, 3),
            'skill_match_score': round(skill_score, 3),
            'experience_match_score': round(exp_score, 3),
            'matched_skills': matched,
            'missing_skills': missing,
            'recommendation_reasoning': self._reasoning(row, matched, missing, years, skill_score, exp_score, loc_score, cat_score),
            'why_recommended': self._highlights(row, matched, skill_score, exp_score, salary),
        }

    @staticmethod
    def _reasoning(row, matched, missing, years, skill_score, exp_score, loc_score, cat_score):
        reasons = []
        pct = int(skill_score * 100)
        if matched:
            label = 'Strong skill match' if skill_score >= 0.6 else 'Good skill match' if skill_score >= 0.35 else 'Partial skill match'
            reasons.append(f"**{label}** ({pct}%) - you have {len(matched)} of the listed skills: {', '.join(matched[:4])}")
        if missing:
            reasons.append(f"**To close the gap** - learn {', '.join(missing[:3])}")
        lo, hi = int(row['exp_min']), int(row['exp_max'])
        if exp_score >= 0.95:
            reasons.append(f"**Experience fits** - the role asks for {experience_label(lo, hi)}, you have {years:g}")
        elif years < lo:
            reasons.append(f"**Stretch role** - asks for {lo}+ years, you have {years:g}")
        else:
            reasons.append(f"**You are senior for this** - it asks for up to {hi} years")
        if loc_score > 1:
            reasons.append(f"**Preferred location** - {row['city']}")
        if cat_score > 1:
            reasons.append(f"**Preferred field** - {row['category']}")
        return ' • '.join(reasons)

    @staticmethod
    def _highlights(row, matched, skill_score, exp_score, salary):
        out = []
        if skill_score >= 0.6:
            out.append(f'{len(matched)} matching skills')
        if exp_score >= 0.95:
            out.append('Experience level fits')
        if salary:
            out.append(f"Disclosed pay: Rs {salary['min'] / 1e5:.1f}-{salary['max'] / 1e5:.1f} LPA")
        if row['work_mode'] in ('Remote', 'Hybrid'):
            out.append(f"{row['work_mode']} work")
        if row['rating'] not in ('', None) and row['rating'] == row['rating'] and float(row['rating']) >= 4:
            out.append(f"Company rated {float(row['rating']):.1f}/5")
        return out[:3]

    # ----- lookups -----
    def get_job_categories(self) -> List[str]:
        counts = Counter(self.category)
        return [name for name, _ in counts.most_common() if name != 'Other'] + ['Other']

    def get_locations(self) -> List[str]:
        counts = Counter(self.jobs_df['city'])
        return [city for city, n in counts.most_common() if n >= 20 and city != 'Unspecified']

    def get_skills_analysis(self, user_skills: List[str]) -> Dict[str, Any]:
        if not len(self.jobs_df) or not user_skills:
            return {}
        total = len(self.jobs_df)
        demand = {}
        for skill in user_skills:
            j = self.vocab.get(canonical_skill(skill))
            if j is None:
                demand[skill] = {'demand_percentage': 0.0, 'job_count': 0, 'avg_experience_level': 'Unknown'}
                continue
            jobs = self.matrix[:, j].nonzero()[0]
            median_exp = float(np.median(self.exp_min[jobs])) if len(jobs) else 0
            demand[skill] = {
                'demand_percentage': round(len(jobs) / total * 100, 2),
                'job_count': int(len(jobs)),
                'avg_experience_level': f'{median_exp:g}+ yrs' if median_exp else 'Fresher',
            }
        user_set = {canonical_skill(s) for s in user_skills}
        gaps = [s for s in self._related_skills(user_set) if s not in user_set][:5]
        return {
            'user_skills_demand': demand,
            'trending_skills': self._trending,
            'total_jobs_analyzed': total,
            'skill_gap_analysis': gaps,
            'source': india_data.SOURCE,
        }

    def _related_skills(self, user_set):
        """Skills that most often appear alongside yours, i.e. what similar roles also ask for."""
        idx = [self.vocab[s] for s in user_set if s in self.vocab]
        if not idx:
            return self._trending
        jobs = np.unique(self.matrix[:, idx].nonzero()[0])
        co = np.asarray(self.matrix[jobs].sum(axis=0)).ravel()
        names = list(self.vocab)
        # How much more often a skill appears in postings like yours than in postings overall.
        # Weighted by how common it is among them, so niche one-offs do not dominate.
        local = co / max(len(jobs), 1)
        overall = self.skill_counts / len(self.jobs_df)
        score = np.where(co >= 10, local * np.log(np.maximum(local / np.maximum(overall, 1e-9), 1e-9)), -np.inf)
        return [names[i] for i in np.argsort(-score)[:40] if np.isfinite(score[i])]
