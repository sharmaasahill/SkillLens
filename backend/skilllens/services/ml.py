"""Load ML models once per process and reuse them for every request."""
import logging
import threading

logger = logging.getLogger(__name__)

_lock = threading.Lock()
_instances = {}


def _get(name, factory):
    instance = _instances.get(name)
    if instance is None:
        with _lock:
            instance = _instances.get(name)
            if instance is None:
                logger.info('Loading %s model', name)
                instance = factory()
                _instances[name] = instance
    return instance


def basic_salary_model():
    from models.salary_predictor import SalaryPredictor
    return _get('basic_salary', SalaryPredictor)


def advanced_salary_model():
    from models.advanced_salary_predictor import AdvancedSalaryPredictor
    return _get('advanced_salary', AdvancedSalaryPredictor)


def job_recommender():
    from models.job_recommender import JobRecommender
    return _get('job_recommender', JobRecommender)


def resume_analyzer():
    from models.resume_analyzer import ResumeAnalyzer
    return _get('resume_analyzer', ResumeAnalyzer)


def preload():
    """Load every model up front so the first requests are fast."""
    basic_salary_model()
    advanced_salary_model()
    job_recommender()
    resume_analyzer()


def reset():
    """Drop cached models (used by tests)."""
    with _lock:
        _instances.clear()
