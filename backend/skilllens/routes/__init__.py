"""Route blueprints. Each module owns one area of the API."""
from flask import request


def json_body(schema):
    """Validate the JSON request body against a pydantic schema."""
    return schema.model_validate(request.get_json(silent=True) or {})


def register_blueprints(app):
    from . import admin, auth, client_errors, frontend, jobs, profile, resumes, salary

    for module in (auth, profile, resumes, salary, jobs, admin, client_errors):
        app.register_blueprint(module.bp)
    # The SPA catch-all must be registered last
    app.register_blueprint(frontend.bp)
