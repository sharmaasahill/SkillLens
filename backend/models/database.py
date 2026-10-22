from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

# Create the SQLAlchemy instance
db = SQLAlchemy()

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(120), unique=True, nullable=False)
    password = db.Column(db.String(200), nullable=False)
    full_name = db.Column(db.String(100))
    phone_number = db.Column(db.String(20))
    address = db.Column(db.String(200))
    age = db.Column(db.Integer)
    # New professional fields
    current_work = db.Column(db.String(150))  # Current job title/role
    current_company = db.Column(db.String(150))  # Current company name
    current_location = db.Column(db.String(150))  # Current work location
    total_experience = db.Column(db.Float)  # Total years of experience
    linkedin_url = db.Column(db.String(300))  # LinkedIn profile
    website_url = db.Column(db.String(300))  # Personal website
    bio = db.Column(db.Text)  # Professional bio/summary
    # Profile resume fields
    profile_resume_filename = db.Column(db.String(255))  # Current profile resume
    profile_resume_uploaded_at = db.Column(db.DateTime)  # When profile resume was uploaded
    skills_summary = db.Column(db.Text)  # Key skills from profile resume
    education = db.Column(db.String(300))  # Education background
    certifications = db.Column(db.Text)  # Professional certifications
    languages = db.Column(db.String(200))  # Languages spoken
    achievements = db.Column(db.Text)  # Key achievements
    is_admin = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Profile history
    profile_history = db.relationship('ProfileHistory', backref='user', lazy=True)
    # Resume history
    resumes = db.relationship('Resume', backref='user', lazy=True)

    def __repr__(self):
        return f'<User {self.email}>'

class ProfileHistory(db.Model):
    __tablename__ = 'profile_history'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    full_name = db.Column(db.String(100))
    phone_number = db.Column(db.String(20))
    address = db.Column(db.String(200))
    age = db.Column(db.Integer)
    # New professional fields for history tracking
    current_work = db.Column(db.String(150))
    current_company = db.Column(db.String(150))
    current_location = db.Column(db.String(150))
    total_experience = db.Column(db.Float)
    linkedin_url = db.Column(db.String(300))
    website_url = db.Column(db.String(300))
    bio = db.Column(db.Text)
    # Profile resume fields for history
    profile_resume_filename = db.Column(db.String(255))
    skills_summary = db.Column(db.Text)
    education = db.Column(db.String(300))
    certifications = db.Column(db.Text)
    languages = db.Column(db.String(200))
    achievements = db.Column(db.Text)
    changed_at = db.Column(db.DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f'<ProfileHistory {self.id} for User {self.user_id}>'

class Resume(db.Model):
    __tablename__ = 'resumes'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    filename = db.Column(db.String(255), nullable=False)
    skills = db.Column(db.Text)  # Store skills as JSON string
    score = db.Column(db.Float, nullable=True)
    raw_text = db.Column(db.Text)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

    def get_skills(self):
        """Convert JSON string to list of skills"""
        if self.skills:
            try:
                return json.loads(self.skills)
            except:
                return []
        return []

    def set_skills(self, skills_list):
        """Convert list of skills to JSON string"""
        self.skills = json.dumps(skills_list)

    def __repr__(self):
        return f'<Resume {self.filename} for User {self.user_id}>' 