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
    profile_resume_filename = db.Column(db.String(255))  # Original name of the current profile resume
    profile_resume_path = db.Column(db.String(255))  # Unique storage path (relative to the upload folder)
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
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
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
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, index=True)
    filename = db.Column(db.String(255), nullable=False)  # Original upload name, for display
    stored_filename = db.Column(db.String(255))  # Unique storage path (relative to the upload folder)
    skills = db.Column(db.Text)  # Store skills as JSON string
    score = db.Column(db.Float, nullable=True)
    raw_text = db.Column(db.Text)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)
    # The resume SkillLens uses for salary, job matching and HR (one per user)
    is_primary = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())

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


class ApiUsage(db.Model):
    """Outbound calls to paid or quota-limited APIs, counted per provider per day."""
    __tablename__ = 'api_usage'

    id = db.Column(db.Integer, primary_key=True)
    provider = db.Column(db.String(40), nullable=False)
    day = db.Column(db.Date, nullable=False)
    calls = db.Column(db.Integer, nullable=False, default=0)

    __table_args__ = (db.UniqueConstraint('provider', 'day', name='uq_api_usage_provider_day'),)
