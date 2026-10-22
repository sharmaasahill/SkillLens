"""
Create (or update) the SkillLens HR account.

Run from the backend directory:
    python create_hr_user.py

Reads HR_EMAIL, HR_PASSWORD and HR_NAME from backend/.env (see .env.example).
Creates the database tables if they do not exist yet, then makes sure the
HR user exists with those credentials.
"""
import os
import sys

from werkzeug.security import generate_password_hash

from app import app
from models.database import db, User

HR_EMAIL = os.environ.get("HR_EMAIL")
HR_PASSWORD = os.environ.get("HR_PASSWORD")
HR_NAME = os.environ.get("HR_NAME", "HR Manager")


def create_hr_user():
    if not HR_EMAIL or not HR_PASSWORD:
        sys.exit("HR_EMAIL and HR_PASSWORD must be set in backend/.env")

    with app.app_context():
        db.create_all()

        user = User.query.filter_by(email=HR_EMAIL).first()
        if user is None:
            user = User(email=HR_EMAIL, full_name=HR_NAME)
            db.session.add(user)
            action = "created"
        else:
            action = "updated"

        user.password = generate_password_hash(HR_PASSWORD, method='pbkdf2:sha256')
        user.is_admin = True
        user.full_name = user.full_name or HR_NAME

        db.session.commit()
        print(f"HR user {action}: {HR_EMAIL}")


if __name__ == "__main__":
    create_hr_user()
