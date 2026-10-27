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


def salary_model():
    """Indian salary predictor (quick and advanced estimates share one trained model)."""
    from models.salary_model import IndiaSalaryPredictor
    return _get('salary', IndiaSalaryPredictor)


def job_market():
    """Skill demand from the 2025 Naukri.com postings (market fit, job title suggestions)."""
    from models.job_market import JobMarket
    return _get('job_market', JobMarket)


def preload():
    """Load every model up front so the first requests are fast."""
    salary_model()
    job_market()


def reset():
    """Drop cached models (used by tests)."""
    with _lock:
        _instances.clear()
