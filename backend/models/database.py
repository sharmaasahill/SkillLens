from flask_sqlalchemy import SQLAlchemy
from datetime import datetime
import json

from .skills_taxonomy import display_name

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
    profile_resume_uploaded_at = db.Column(db.DateTime)
    # Last time the candidate uploaded/analyzed a resume, matched jobs or checked a salary
    last_active_at = db.Column(db.DateTime)  # When profile resume was uploaded
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
    # The resume SkillLens uses for salary, market fit and HR (one per user)
    is_primary = db.Column(db.Boolean, nullable=False, default=False, server_default=db.false())

    def get_skills(self):
        """Stored skills under their display names. Older rows hold lower-case names ("postgresql")."""
        if not self.skills:
            return []
        try:
            stored = json.loads(self.skills)
        except (TypeError, ValueError):
            return []
        return list(dict.fromkeys(display_name(s) for s in stored if isinstance(s, str)))

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


class CandidateReview(db.Model):
    """What the HR team has decided about a candidate. One row per candidate, shared by the team."""
    __tablename__ = 'candidate_reviews'

    STATUSES = ('shortlisted', 'contacted', 'interviewing', 'hired', 'rejected')

    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), primary_key=True)
    status = db.Column(db.String(20))
    note = db.Column(db.Text)
    # Removed from the HR portal at this time. The candidate returns once they are active again after it.
    hidden_at = db.Column(db.DateTime)
    updated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class AiResult(db.Model):
    """A saved AI answer, so asking again about the same resume and job description costs nothing."""
    __tablename__ = 'ai_results'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    resume_id = db.Column(db.Integer, db.ForeignKey('resumes.id', ondelete='CASCADE'), index=True)
    kind = db.Column(db.String(30), nullable=False)
    # sha256 of everything that was sent, so any change to the resume, JD or prompt asks again
    cache_key = db.Column(db.String(64), nullable=False)
    model = db.Column(db.String(60))
    result = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    __table_args__ = (db.UniqueConstraint('user_id', 'cache_key', name='uq_ai_results_user_key'),)


class JobSearch(db.Model):
    """One live job search a user started. Results come from JobSourceResult rows, one per source."""
    __tablename__ = 'job_searches'

    id = db.Column(db.String(32), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True)
    query = db.Column(db.Text, nullable=False)  # JSON: role, city, days, remote_only
    results = db.Column(db.Text, nullable=False)  # JSON: source -> JobSourceResult id, or a status such as "limit"
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


class JobSourceResult(db.Model):
    """Jobs one source returned for one search query. Shared by everyone who searches the same thing, until it expires."""
    __tablename__ = 'job_source_results'

    id = db.Column(db.Integer, primary_key=True)
    source = db.Column(db.String(30), nullable=False)
    query_key = db.Column(db.String(64), nullable=False)
    status = db.Column(db.String(12), nullable=False, default='running')  # running, done, error
    jobs = db.Column(db.Text)
    error = db.Column(db.String(300))
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    finished_at = db.Column(db.DateTime)

    __table_args__ = (db.Index('ix_job_source_results_lookup', 'source', 'query_key'),)


class StoredFile(db.Model):
    """The bytes of an uploaded resume PDF.

    Free hosts (like Render) wipe the server disk on every restart, so the database keeps the real
    copy. The disk copy under UPLOAD_FOLDER is only a working copy, rebuilt from here when missing.
    """
    __tablename__ = 'stored_files'

    path = db.Column(db.String(255), primary_key=True)  # same relative path as the disk copy
    data = db.Column(db.LargeBinary, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
