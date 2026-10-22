"""Indian salary models trained on disclosed salaries in Naukri.com postings (2025).

Inputs: job title, years of experience, city, work mode and (optionally) skills.
Output: annual CTC in INR.

Two models share one feature pipeline:

* Quick: Ridge regression on log salary. It is linear, so every estimate can be split
  exactly into how much the title, experience, city and skills moved it.
* Advanced: the Ridge model blended with gradient-boosted trees, plus quantile models
  that give a data-driven likely range (25th-75th percentile) and an 80% interval.

Accuracy is measured on companies the model never saw during training (see METRICS).
"""
import logging
import os
import re
import threading

import joblib
import numpy as np
import pandas as pd
import scipy.sparse as sp
from sklearn.decomposition import TruncatedSVD
from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import Ridge
from sklearn.model_selection import GroupShuffleSplit
from sklearn.preprocessing import OneHotEncoder, SplineTransformer

from . import india_data

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'india_salary_model.pkl')
MODEL_VERSION = 'India 2025.10'
RIDGE_ALPHA = 6.0
# Likely range = middle 60% of similar postings; interval = middle 90%
RANGE_Q = (0.20, 0.80)
INTERVAL_Q = (0.05, 0.95)
QUANTILES = RANGE_Q + INTERVAL_Q
MAX_EXPERIENCE = 30
_train_lock = threading.Lock()


def _skill_tokens(text):
    return text.split('|') if text else []


def _skills_field(skills):
    """Normalise a skills list or 'a|b' string into the pipe format used in training."""
    if isinstance(skills, str):
        skills = re.split(r'[|,]', skills)
    return '|'.join(india_data.split_skills(','.join(skills or [])))


class SalaryModel:
    """Feature pipeline plus fitted models. Built by `train()`, saved with joblib."""

    def __init__(self):
        self.title_words = TfidfVectorizer(ngram_range=(1, 2), min_df=3, sublinear_tf=True)
        self.title_chars = TfidfVectorizer(analyzer='char_wb', ngram_range=(3, 5), min_df=5,
                                           sublinear_tf=True, max_features=30000)
        self.skill_vec = TfidfVectorizer(tokenizer=_skill_tokens, token_pattern=None, lowercase=False,
                                         min_df=5, sublinear_tf=True)
        self.place = OneHotEncoder(handle_unknown='infrequent_if_exist', min_frequency=20)
        self.exp_spline = SplineTransformer(n_knots=6, degree=3)
        self.blocks = {}
        self.metrics = {}
        self.cities = []
        self.titles = []

    # ----- features -----
    def _frame(self, rows):
        df = pd.DataFrame(rows)
        df['title_norm'] = df['title'].map(india_data.normalise_title)
        df['skills'] = df['skills'].map(_skills_field)
        df['exp_mid'] = df['experience'].astype(float).clip(0, MAX_EXPERIENCE)
        return df

    def _blocks(self, df, fit=False):
        step = (lambda m, x: m.fit_transform(x)) if fit else (lambda m, x: m.transform(x))
        parts = {
            'title': sp.hstack([step(self.title_words, df['title_norm']),
                                0.6 * step(self.title_chars, df['title_norm'])]),
            'skills': 0.7 * step(self.skill_vec, df['skills']),
            'place': step(self.place, df[['city', 'work_mode']]),
            'experience': sp.csr_matrix(step(self.exp_spline, df[['exp_mid']].values)),
        }
        if fit:
            start = 0
            for name, block in parts.items():
                self.blocks[name] = slice(start, start + block.shape[1])
                start += block.shape[1]
        return sp.hstack(list(parts.values())).tocsr()

    def _dense(self, X, df):
        return np.hstack([self.svd.transform(X), df[['exp_mid']].values])

    # ----- training -----
    def fit(self, data):
        df = self._frame({
            'title': data['title'], 'skills': data['skills'], 'experience': data['exp_mid'],
            'city': data['city'], 'work_mode': data['work_mode'],
        })
        y = np.log(data['salary_mid'].values)
        X = self._blocks(df, fit=True)
        self.ridge = Ridge(alpha=RIDGE_ALPHA, solver='lsqr').fit(X, y)
        self.baseline = float(self.ridge.predict(X).mean())

        self.svd = TruncatedSVD(80, random_state=0).fit(X)
        Z = self._dense(X, df)
        hgb = dict(max_iter=500, learning_rate=0.06, max_leaf_nodes=31, l2_regularization=1.0, random_state=0)
        self.trees = HistGradientBoostingRegressor(**hgb).fit(Z, y)
        self.quantiles = {q: HistGradientBoostingRegressor(loss='quantile', quantile=q, **{**hgb, 'max_iter': 300}).fit(Z, y)
                          for q in QUANTILES}
        # Contribution of each feature group, centred on the training mean so effects read as +/- vs. typical
        self.means = {name: np.asarray(X[:, cols].mean(axis=0)).ravel() for name, cols in self.blocks.items()}

        self.cities = data['city'].value_counts().loc[lambda s: s >= 20].index.tolist()
        self.titles = data['title_norm'].value_counts().head(400).index.tolist()
        return self

    # ----- prediction -----
    def predict(self, rows, quantiles=QUANTILES, trees=True):
        df = self._frame(rows)
        X = self._blocks(df)
        Z = self._dense(X, df)
        ridge = self.ridge.predict(X)
        blend = 0.5 * ridge + 0.5 * self.trees.predict(Z) if trees else ridge
        q = {k: self.quantiles[k].predict(Z) for k in quantiles}
        return df, X, ridge, blend, q

    def contributions(self, X_row):
        """Effect of each feature group on log salary for one row, relative to an average posting."""
        coef = self.ridge.coef_
        out = {}
        for name, cols in self.blocks.items():
            x = np.asarray(X_row[:, cols].todense()).ravel()
            out[name] = float(np.dot(coef[cols], x - self.means[name]))
        return out


def train(save=True):
    """Train on the cleaned dataset, measure accuracy on unseen companies, then refit on all rows."""
    data = india_data.salary_rows(india_data.load_jobs()).reset_index(drop=True)
    tr, te = next(GroupShuffleSplit(1, test_size=0.2, random_state=0).split(data, groups=data['company']))
    holdout = SalaryModel().fit(data.iloc[tr])
    test = data.iloc[te]
    _, _, ridge, blend, q = holdout.predict({
        'title': test['title'], 'skills': test['skills'], 'experience': test['exp_mid'],
        'city': test['city'], 'work_mode': test['work_mode']})
    actual = test['salary_mid'].values

    def score(pred_log):
        pred = np.exp(pred_log)
        err = np.abs(pred - actual) / actual
        resid = pred_log - np.log(actual)
        return {
            'r2_log': round(float(1 - (resid ** 2).sum() / ((np.log(actual) - np.log(actual).mean()) ** 2).sum()), 3),
            'mae_inr': int(np.abs(pred - actual).mean()),
            'median_error_pct': round(float(np.median(err) * 100), 1),
            'within_25_pct': round(float((err < 0.25).mean() * 100), 1),
        }

    log_actual = np.log(actual)
    metrics = {
        'quick': score(ridge),
        'advanced': score(blend),
        'range_coverage_pct': round(float(((log_actual >= q[RANGE_Q[0]]) & (log_actual <= q[RANGE_Q[1]])).mean() * 100), 1),
        'interval_coverage_pct': round(float(((log_actual >= q[INTERVAL_Q[0]]) & (log_actual <= q[INTERVAL_Q[1]])).mean() * 100), 1),
        'train_rows': int(len(tr)), 'test_rows': int(len(te)),
        'test_split': 'held-out companies (20%)',
    }
    logger.info('Hold-out metrics: %s', metrics)

    model = SalaryModel().fit(data)
    model.metrics = {**metrics, 'trained_on_rows': int(len(data)), 'source': india_data.SOURCE}
    if save:
        joblib.dump(model, MODEL_PATH, compress=3)
    return model


_FACTOR_LABELS = {'title': 'Job title', 'experience': 'Experience', 'place': 'City and work mode', 'skills': 'Skills'}


def _round_inr(value):
    """Round to the nearest Rs 1,000, the precision salary ranges are quoted in."""
    return int(round(float(value) / 1000.0) * 1000)


class IndiaSalaryPredictor:
    """Runtime wrapper used by the API. Loads the saved model, training it once if missing."""

    def __init__(self, model=None):
        if model is None:
            with _train_lock:
                model = joblib.load(MODEL_PATH) if os.path.exists(MODEL_PATH) else train()
        self.model = model

    @staticmethod
    def _row(data):
        return {
            'title': [data['job_title']],
            'experience': [data['years_of_experience']],
            'city': [data.get('city') or 'Unspecified'],
            'work_mode': [data.get('work_mode') or 'On-site'],
            'skills': [data.get('skills') or []],
        }

    def _factors(self, X, data):
        contrib = self.model.contributions(X[0])
        # Only explain inputs the user actually gave
        if not data.get('skills'):
            contrib.pop('skills')
        if not data.get('city'):
            contrib.pop('place')
        total = sum(abs(v) for v in contrib.values()) or 1.0
        factors = [{
            'factor': _FACTOR_LABELS[name],
            'importance': round(abs(value) / total, 3),
            'effect_pct': round((np.exp(value) - 1) * 100, 1),
        } for name, value in contrib.items()]
        return sorted(factors, key=lambda f: f['importance'], reverse=True)

    def predict_quick(self, data):
        _, X, ridge, _, q = self.model.predict(self._row(data), quantiles=RANGE_Q, trees=False)
        salary = np.exp(ridge[0])
        low, high = sorted((np.exp(q[RANGE_Q[0]][0]), np.exp(q[RANGE_Q[1]][0])))
        return {
            'predicted_salary': _round_inr(salary),
            'salary_range': {'min': _round_inr(min(low, salary)), 'max': _round_inr(max(high, salary))},
            'top_influential_factors': self._factors(X, data),
        }

    def predict_advanced(self, data):
        _, X, ridge, blend, q = self.model.predict(self._row(data))
        salary = np.exp(blend[0])
        low, high = sorted((np.exp(q[RANGE_Q[0]][0]), np.exp(q[RANGE_Q[1]][0])))
        lower, upper = sorted((np.exp(q[INTERVAL_Q[0]][0]), np.exp(q[INTERVAL_Q[1]][0])))
        spread = (upper - lower) / salary if salary else 1
        return {
            'predicted_salary': _round_inr(salary),
            'salary_range': {'min': _round_inr(min(low, salary)), 'max': _round_inr(max(high, salary))},
            'confidence_interval': {'lower': _round_inr(min(lower, salary)), 'upper': _round_inr(max(upper, salary))},
            # A narrower interval relative to the estimate means more confidence
            'prediction_confidence': round(float(np.clip(100 - spread * 30, 50, 95)), 1),
            'top_influential_factors': self._factors(X, data),
            'model_version': MODEL_VERSION,
        }

    def options(self):
        return {
            'cities': self.model.cities,
            'work_modes': ['On-site', 'Hybrid', 'Remote'],
            'popular_titles': [t.title() for t in self.model.titles[:60]],
        }

    def info(self):
        return {'model_version': MODEL_VERSION, 'metrics': self.model.metrics}
