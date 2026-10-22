"""SkillLens backend entry point.

    python app.py            run the development server
    flask --app app db ...   run database migrations

The application itself lives in the `skilllens` package (see skilllens/__init__.py).
"""
import os

from skilllens import create_app

app = create_app()


if __name__ == '__main__':
    if os.environ.get('PRELOAD_MODELS', 'true').lower() == 'true':
        from skilllens.services import ml
        ml.preload()
    app.run(
        host=os.environ.get('FLASK_HOST', '127.0.0.1'),
        port=int(os.environ.get('FLASK_PORT', '5000')),
        debug=os.environ.get('FLASK_DEBUG', 'false').lower() == 'true',
    )
