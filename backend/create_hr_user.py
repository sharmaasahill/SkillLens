"""
Create (or update) the SkillLens HR account.

Run from the backend directory, after `flask --app app db upgrade`:
    python create_hr_user.py

Reads HR_EMAIL, HR_PASSWORD and HR_NAME from backend/.env (see .env.example).
"""
import os
import sys

from sqlalchemy import inspect
from werkzeug.security import generate_password_hash

from models.database import User
from skilllens import create_app
from skilllens.extensions import db


def create_hr_user():
    email = (os.environ.get("HR_EMAIL") or "").strip().lower()
    password = os.environ.get("HR_PASSWORD")
    name = os.environ.get("HR_NAME", "HR Manager")
    if not email or not password:
        sys.exit("HR_EMAIL and HR_PASSWORD must be set in backend/.env")
    if len(password) < 8:
        sys.exit("HR_PASSWORD must be at least 8 characters")

    app = create_app()
    with app.app_context():
        if not inspect(db.engine).has_table("users"):
            sys.exit("Database tables are missing. Run `flask --app app db upgrade` first.")

        user = User.query.filter_by(email=email).first()
        if user is not None and not user.is_admin:
            sys.exit(f"{email} is a candidate account. Candidate and HR accounts are kept separate; "
                     "use a different HR_EMAIL.")
        action = "updated" if user else "created"
        if user is None:
            user = User(email=email, full_name=name)
            db.session.add(user)

        user.password = generate_password_hash(password, method='pbkdf2:sha256')
        user.is_admin = True
        user.full_name = user.full_name or name
        db.session.commit()
        print(f"HR user {action}: {email}")


if __name__ == "__main__":
    create_hr_user()
