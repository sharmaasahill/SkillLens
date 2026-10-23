"""Salary estimates for India, in INR per year."""
from flask import Blueprint, jsonify

from ..errors import ApiError
from ..schemas import SalaryRequest
from ..security import candidate_required
from ..services import ml
from . import json_body

bp = Blueprint('salary', __name__)

QUICK = 'Quick estimate (Ridge regression)'
ADVANCED = 'Advanced estimate (Ridge + gradient boosting)'


def _predict(method, data):
    try:
        return method(data)
    except Exception as exc:  # the model raises on malformed input
        raise ApiError(f'Prediction failed: {exc}', 422)


def _input(data):
    return {**data, 'currency': 'INR', 'period': 'year'}


@bp.post('/predict')
@bp.post('/predict-salary')
@candidate_required(activity=True)
def predict_quick():
    data = json_body(SalaryRequest).model_dump()
    result = _predict(ml.salary_model().predict_quick, data)
    return jsonify({'success': True, 'model_type': QUICK, 'currency': 'INR', **result, 'input_data': _input(data)})


@bp.post('/predict-salary-advanced')
@candidate_required(activity=True)
def predict_advanced():
    data = json_body(SalaryRequest).model_dump()
    result = _predict(ml.salary_model().predict_advanced, data)
    return jsonify({'success': True, 'model_type': ADVANCED, 'currency': 'INR', **result, 'input_data': _input(data)})


@bp.post('/compare-predictions')
@candidate_required(activity=True)
def compare():
    data = json_body(SalaryRequest).model_dump()
    model = ml.salary_model()
    quick = _predict(model.predict_quick, data)
    advanced = _predict(model.predict_advanced, data)

    difference = advanced['predicted_salary'] - quick['predicted_salary']
    difference_pct = (difference / quick['predicted_salary']) * 100 if quick['predicted_salary'] > 0 else 0
    return jsonify({
        'success': True,
        'currency': 'INR',
        'input_data': _input(data),
        'basic_model': {'model_type': QUICK, **quick},
        'advanced_model': {'model_type': ADVANCED, **advanced},
        'comparison': {
            'difference': difference,
            'difference_percentage': round(difference_pct, 2),
            'higher_prediction': 'advanced' if difference > 0 else 'basic' if difference < 0 else 'equal',
        },
    })


@bp.get('/salary-options')
@candidate_required
def salary_options():
    """Cities, work modes and job titles (every title seen in 3+ Indian postings) for the salary form."""
    return jsonify({'success': True, **ml.salary_model().options(), 'job_titles': _job_titles()})


_TITLES = []


def _job_titles():
    if not _TITLES:
        counts = ml.job_recommender().jobs_df['title_norm'].value_counts()
        titles = [t for t, n in counts.items() if n >= 3 and 2 < len(t) <= 60 and not any(ch.isdigit() for ch in t)]
        _TITLES.extend(' '.join(w.upper() if w in ('qa', 'ui', 'ux', 'hr', 'it', 'sap', 'aws', 'ai', 'ml', 'bi', 'sde', 'sql', 'erp', 'crm', 'seo')
                                else w.capitalize() for w in t.split()) for t in titles)
    return _TITLES


@bp.get('/model-info')
@candidate_required
def model_info():
    """How the model was trained and how accurate it is on companies it never saw."""
    return jsonify({'success': True, **ml.salary_model().info()})
