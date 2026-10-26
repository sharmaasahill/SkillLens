"""Salary estimates for India, in INR per year."""
from flask import Blueprint, jsonify

from ..errors import ApiError
from ..schemas import OfferCheckRequest, SalaryRequest
from ..security import user_required
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
@user_required(activity=True)
def predict_quick():
    data = json_body(SalaryRequest).model_dump()
    result = _predict(ml.salary_model().predict_quick, data)
    return jsonify({'success': True, 'model_type': QUICK, 'currency': 'INR', **result, 'input_data': _input(data)})


@bp.post('/predict-salary-advanced')
@user_required(activity=True)
def predict_advanced():
    data = json_body(SalaryRequest).model_dump()
    result = _predict(ml.salary_model().predict_advanced, data)
    return jsonify({'success': True, 'model_type': ADVANCED, 'currency': 'INR', **result, 'input_data': _input(data)})


@bp.post('/compare-predictions')
@user_required(activity=True)
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


VERDICTS = [  # (below this percentile, key, headline)
    (20, 'low', 'Below what similar roles usually pay.'),
    (40, 'fair_low', 'Fair, but on the low side.'),
    (60, 'fair', 'Right in the middle of the market.'),
    (80, 'good', 'A good offer.'),
    (101, 'strong', 'A strong offer.'),
]


def _lakh(value):
    """Rs value rounded to a quarter lakh, the way people ask in a negotiation."""
    return round(value / 25000) * 25000


@bp.post('/salary/offer-check')
@user_required(activity=True)
def offer_check():
    """Where an offer sits among similar 2025 postings, and what to ask for."""
    data = json_body(OfferCheckRequest).model_dump()
    offer = data.pop('offer_lpa') * 100000
    result = _predict(lambda d: ml.salary_model().offer_position(d, offer), data)
    pct = result['percentile']
    key, headline = next((k, h) for limit, k, h in VERDICTS if pct < limit)
    if pct < 50:
        ask = _lakh(result['median'])
        advice = 'Asking for about the middle of the market is reasonable for this profile.'
    elif pct < 80:
        ask = _lakh(result['likely_range']['max'])
        advice = 'There may be room to ask for the top of the likely range, if your skills match the role well.'
    else:
        ask = None
        advice = 'This is already above most similar postings. Negotiate on joining bonus, notice period or role instead.'
    return jsonify({'success': True, 'currency': 'INR', **result, 'verdict': key, 'headline': headline,
                    'ask_for': ask, 'advice': advice, 'input_data': _input(data)})


@bp.get('/salary-options')
@user_required
def salary_options():
    """Cities, work modes and job titles (every title seen in 3+ Indian postings) for the salary form."""
    return jsonify({'success': True, **ml.salary_model().options(), 'job_titles': _job_titles()})


_TITLES = []


def _job_titles():
    if not _TITLES:
        _TITLES.extend(ml.job_market().popular_titles())
    return _TITLES


@bp.get('/model-info')
@user_required
def model_info():
    """How the model was trained and how accurate it is on companies it never saw."""
    return jsonify({'success': True, **ml.salary_model().info()})
