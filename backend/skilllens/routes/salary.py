"""Salary prediction with the basic and advanced models."""
from flask import Blueprint, jsonify
from flask_jwt_extended import jwt_required

from ..errors import ApiError
from ..schemas import SalaryRequest
from ..services import ml
from . import json_body

bp = Blueprint('salary', __name__)


def _predict(model, data):
    try:
        return model.predict(data)
    except Exception as exc:  # model wrappers raise generic exceptions for bad input
        raise ApiError(f'Prediction failed: {exc}', 422)


def _advanced_fields(result):
    keys = ['predicted_salary', 'salary_range', 'confidence_interval', 'prediction_confidence',
            'top_influential_factors', 'model_version']
    return {key: result[key] for key in keys}


@bp.post('/predict')
@bp.post('/predict-salary')
@jwt_required()
def predict_basic():
    data = json_body(SalaryRequest).model_dump()
    result = _predict(ml.basic_salary_model(), data)
    return jsonify({
        'success': True,
        'model_type': 'Basic Random Forest',
        'predicted_salary': result['predicted_salary'],
        'salary_range': result['salary_range'],
        'input_data': data,
    })


@bp.post('/predict-salary-advanced')
@jwt_required()
def predict_advanced():
    data = json_body(SalaryRequest).model_dump()
    result = _predict(ml.advanced_salary_model(), data)
    return jsonify({'success': True, 'model_type': 'Advanced Ensemble', **_advanced_fields(result),
                    'input_data': data})


@bp.post('/compare-predictions')
@jwt_required()
def compare():
    data = json_body(SalaryRequest).model_dump()
    basic = _predict(ml.basic_salary_model(), data)
    advanced = _predict(ml.advanced_salary_model(), data)

    difference = advanced['predicted_salary'] - basic['predicted_salary']
    difference_pct = (difference / basic['predicted_salary']) * 100 if basic['predicted_salary'] > 0 else 0
    return jsonify({
        'success': True,
        'input_data': data,
        'basic_model': {
            'model_type': 'Basic Random Forest',
            'predicted_salary': basic['predicted_salary'],
            'salary_range': basic['salary_range'],
        },
        'advanced_model': {'model_type': 'Advanced Ensemble', **_advanced_fields(advanced)},
        'comparison': {
            'difference': difference,
            'difference_percentage': round(difference_pct, 2),
            'higher_prediction': 'advanced' if difference > 0 else 'basic' if difference < 0 else 'equal',
        },
    })


@bp.get('/model-info')
@jwt_required()
def model_info():
    info = ml.advanced_salary_model().get_model_info()
    return jsonify({
        'success': True,
        'models': {
            'basic': {
                'name': 'Basic Random Forest',
                'description': 'Simple Random Forest model with basic preprocessing',
                'features': ['Age', 'Gender', 'Education Level', 'Job Title', 'Years of Experience'],
                'capabilities': ['Salary Prediction', 'Salary Range Estimation'],
            },
            'advanced': {
                'name': info['model_type'],
                'description': 'Ensemble model with advanced feature engineering and multiple algorithms',
                'features': info['feature_names'],
                'feature_importance': info['feature_importance'],
                'capabilities': info['capabilities'],
                'models_in_ensemble': info['models_in_ensemble'],
            },
        },
    })
