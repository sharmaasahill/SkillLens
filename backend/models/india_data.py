"""Indian job-market data: download, clean and load.

Source: "Indian Job Market Dataset 2025" by Shivam Shrivastava (Kaggle), 97,929 Naukri.com
postings collected in September and October 2025. Licence: CC BY-NC-SA 4.0, which allows
non-commercial use with attribution, and requires derived data to carry the same licence.
https://www.kaggle.com/datasets/shivamshrivastava21/indian-job-market-dataset-2025-2026

The raw CSV (83 MB) is downloaded on demand into data/raw and is not committed. The cleaned,
compact copy used at runtime (data/india_jobs.csv.gz) is committed so a fresh clone works offline.
"""
import html
import logging
import os
import re
import urllib.request

import numpy as np
import pandas as pd

logger = logging.getLogger(__name__)

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BACKEND_DIR, 'data')
RAW_PATH = os.path.join(DATA_DIR, 'raw', 'naukri_jobs_2025.csv')
CLEAN_PATH = os.path.join(DATA_DIR, 'india_jobs.csv.gz')

# Public mirror of the Kaggle file, so no Kaggle account is needed to rebuild
RAW_URL = ('https://raw.githubusercontent.com/JasobantaParida/Indian-Job-Market-Intelligence/'
           'HEAD/indian-job-market-dataset-2025.csv')
RAW_SHA256_PREFIX = '240665f34067c2d9'

SOURCE = {
    'name': 'Indian Job Market Dataset 2025 (Naukri.com)',
    'collected': 'September-October 2025',
    'licence': 'CC BY-NC-SA 4.0',
    'url': 'https://www.kaggle.com/datasets/shivamshrivastava21/indian-job-market-dataset-2025-2026',
}

# Salary sanity bounds for training, in INR per year
MIN_SALARY = 60_000
MAX_SALARY = 15_000_000
DESCRIPTION_CHARS = 600

# Different spellings of the same city
CITY_ALIASES = {
    'bangalore': 'Bengaluru', 'bengaluru': 'Bengaluru', 'bangalore rural': 'Bengaluru',
    'gurgaon': 'Gurugram', 'gurugram': 'Gurugram',
    'new delhi': 'Delhi', 'delhi': 'Delhi', 'delhi / ncr': 'Delhi NCR', 'delhi ncr': 'Delhi NCR',
    'mumbai suburban': 'Mumbai', 'mumbai (all areas)': 'Mumbai', 'bombay': 'Mumbai',
    'navi mumbai': 'Navi Mumbai', 'thane': 'Thane',
    'noida': 'Noida', 'greater noida': 'Noida',
    'madras': 'Chennai', 'calcutta': 'Kolkata', 'kolkata': 'Kolkata',
    'cochin': 'Kochi', 'kochi': 'Kochi', 'ernakulam': 'Kochi',
    'mysore': 'Mysuru', 'mysuru': 'Mysuru', 'vizag': 'Visakhapatnam',
    'trivandrum': 'Thiruvananthapuram', 'baroda': 'Vadodara', 'poona': 'Pune',
    'secunderabad': 'Hyderabad', 'hyderabad/secunderabad': 'Hyderabad',
}


def download_raw(force=False):
    """Fetch the raw CSV into data/raw. Returns its path."""
    if os.path.exists(RAW_PATH) and not force:
        return RAW_PATH
    os.makedirs(os.path.dirname(RAW_PATH), exist_ok=True)
    logger.info('Downloading %s', RAW_URL)
    tmp = RAW_PATH + '.part'
    urllib.request.urlretrieve(RAW_URL, tmp)  # noqa: S310 (fixed https URL)
    import hashlib
    digest = hashlib.sha256(open(tmp, 'rb').read()).hexdigest()
    if not digest.startswith(RAW_SHA256_PREFIX):
        os.remove(tmp)
        raise RuntimeError(f'Downloaded file checksum {digest[:16]} does not match {RAW_SHA256_PREFIX}')
    os.replace(tmp, RAW_PATH)
    return RAW_PATH


def normalise_city(raw):
    """Primary city and work mode from a Naukri location string.

    'Hybrid - Pune, Mumbai' -> ('Pune', 'Hybrid'); 'Bengaluru(HAL)' -> ('Bengaluru', 'On-site').
    """
    text = str(raw or '').strip()
    mode = 'On-site'
    if not text or text.lower() in ('nan', 'none'):
        return 'Unspecified', mode
    first = text.split(',')[0].strip()
    if first.lower().startswith('hybrid'):
        mode = 'Hybrid'
        first = re.sub(r'(?i)^hybrid\s*-?\s*', '', first)
    if first.lower().startswith(('remote', 'work from home', 'wfh')):
        return 'Remote', 'Remote'
    first = re.sub(r'\(.*$', '', first).strip(' -/')
    return CITY_ALIASES.get(first.lower(), first.title() if first.islower() else first), mode


def normalise_title(title):
    """Lowercase title without locations, bracketed notes or work-mode suffixes."""
    t = str(title or '').lower()
    t = re.sub(r'\(.*?\)|\[.*?\]', ' ', t)
    t = re.sub(r'\b(?:urgent(?:ly)?|hiring|opening|immediate joiners?|wfo|wfh|remote|hybrid|work from (?:home|office))\b', ' ', t)
    t = re.sub(r'\s+[-|@,]\s+.*$', '', t)  # "Sales Executive - Pune" -> "sales executive"
    t = re.sub(r'\bsr\b\.?', 'senior', t)
    t = re.sub(r'\bjr\b\.?', 'junior', t)
    t = re.sub(r'[^a-z0-9+#./ ]', ' ', t)
    return re.sub(r'\s+', ' ', t).strip()


def plain_text(markup):
    """Job descriptions arrive as HTML fragments; keep readable text only."""
    text = re.sub(r'(?i)<br\s*/?>|</p>|</li>', ' ', str(markup or ''))
    text = html.unescape(re.sub(r'<[^>]+>', ' ', text))
    return re.sub(r'\s+', ' ', text).strip()


def split_skills(text):
    """Lowercase, de-duplicated skill tags in their original order."""
    seen, out = set(), []
    for tag in str(text or '').split(','):
        tag = re.sub(r'\s+', ' ', tag).strip().lower()
        if 1 < len(tag) <= 40 and tag not in seen and tag != 'nan':
            seen.add(tag)
            out.append(tag)
    return out


def build_clean_dataset(raw_path=None):
    """Clean the raw postings and write data/india_jobs.csv.gz. Returns the DataFrame."""
    df = pd.read_csv(raw_path or download_raw())
    df = df.drop_duplicates('jobId').dropna(subset=['title', 'companyName'])
    df = df[df['currency'].fillna('INR') == 'INR']

    cities = df['location'].map(normalise_city)
    out = pd.DataFrame({
        'job_id': df['jobId'].astype('int64'),
        'title': df['title'].str.strip(),
        'title_norm': df['title'].map(normalise_title),
        'company': df['companyName'].str.strip(),
        'location': df['location'].fillna('').str.strip(),
        'city': cities.str[0],
        'work_mode': cities.str[1],
        'skills': df['tagsAndSkills'].map(lambda s: '|'.join(split_skills(s))),
        'exp_min': df['minimumExperience'].fillna(0).clip(0, 40).astype(int),
        'exp_max': df['maximumExperience'].fillna(0).clip(0, 45).astype(int),
        'salary_min': df['minimumSalary'].fillna(0).astype('int64'),
        'salary_max': df['maximumSalary'].fillna(0).astype('int64'),
        'rating': df['AggregateRating'].round(1),
        'reviews': df['ReviewsCount'].fillna(0).astype(int),
        'posted': df['jobUploaded'].fillna(''),
        'description': df['jobDescription'].fillna('').map(plain_text).str[:DESCRIPTION_CHARS],
    })
    out['exp_max'] = np.maximum(out['exp_max'], out['exp_min'])
    swap = out['salary_min'] > out['salary_max']
    out.loc[swap, ['salary_min', 'salary_max']] = out.loc[swap, ['salary_max', 'salary_min']].values
    out = out[out['title_norm'].str.len() > 1].reset_index(drop=True)

    os.makedirs(DATA_DIR, exist_ok=True)
    out.to_csv(CLEAN_PATH, index=False, compression='gzip')
    logger.info('Wrote %d cleaned postings to %s', len(out), CLEAN_PATH)
    return out


def load_jobs():
    """Cleaned postings, building them from the raw file the first time."""
    if not os.path.exists(CLEAN_PATH):
        return build_clean_dataset()
    df = pd.read_csv(CLEAN_PATH, keep_default_na=False, na_values={'rating': ['']})
    df['skills'] = df['skills'].astype(str)
    return df


def salary_rows(df):
    """Postings with a believable disclosed salary, for training."""
    s = df[(df['salary_min'] >= MIN_SALARY) & (df['salary_max'] <= MAX_SALARY) & (df['salary_max'] > 0)]
    # Ranges wider than 4x are usually placeholders ("1-10 Lacs"), not real offers
    s = s[s['salary_max'] <= s['salary_min'] * 4]
    return s.assign(salary_mid=(s['salary_min'] + s['salary_max']) / 2,
                    exp_mid=(s['exp_min'] + s['exp_max']) / 2)
