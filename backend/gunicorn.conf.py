"""Gunicorn settings for production (used by the Dockerfile).

One worker process with several threads: the app keeps its ML models, caches and job-search
threads in memory, and a second process would need twice the RAM (Render's free plan has 512 MB).
"""
import os
import threading

bind = f"0.0.0.0:{os.environ.get('PORT', '10000')}"
workers = 1
threads = int(os.environ.get('GUNICORN_THREADS', '8'))
timeout = 180  # an AI resume review can take over a minute
accesslog = '-'


def post_worker_init(worker):
    """Load the ML models in the background, so the site answers at once while they load."""
    if os.environ.get('PRELOAD_MODELS', 'true').lower() == 'true':
        from skilllens.services import ml
        threading.Thread(target=ml.preload, name='preload-models', daemon=True).start()
