"""Salary estimates for India, in INR per year."""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..errors import ApiError
from ..schemas import SalaryRequest
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
@jwt_required()
def predict_quick():
    data = json_body(SalaryRequest).model_dump()
    result = _predict(ml.salary_model().predict_quick, data)
    return jsonify({'success': True, 'model_type': QUICK, 'currency': 'INR', **result, 'input_data': _input(data)})


@bp.post('/predict-salary-advanced')
@jwt_required()
def predict_advanced():
    data = json_body(SalaryRequest).model_dump()
    result = _predict(ml.salary_model().predict_advanced, data)
    return jsonify({'success': True, 'model_type': ADVANCED, 'currency': 'INR', **result, 'input_data': _input(data)})


@bp.post('/compare-predictions')
@jwt_required()
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
@jwt_required()
def salary_options():
    """Cities, work modes and common job titles for the salary form."""
    return jsonify({'success': True, **ml.salary_model().options()})


@bp.get('/model-info')
@jwt_required()
def model_info():
    """How the model was trained and how accurate it is on companies it never saw."""
    return jsonify({'success': True, **ml.salary_model().info()})
