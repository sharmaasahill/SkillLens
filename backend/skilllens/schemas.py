"""Request validation schemas (pydantic). Routes call `Schema.model_validate(data)`."""
from typing import List, Literal, Optional

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator, model_validator

class _Schema(BaseModel):
    model_config = ConfigDict(extra='ignore', str_strip_whitespace=True)


def _blank_to_none(value):
    if isinstance(value, str) and value.strip() == '':
        return None
    return value


# ---------- Auth ----------

class RegisterRequest(_Schema):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(min_length=1, max_length=100)

    @field_validator('email')
    @classmethod
    def lower_email(cls, value):
        return value.lower()


class LoginRequest(_Schema):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)
    # Which sign-in the user chose. Candidates and HR accounts can only use their own.
    account_type: Literal['candidate', 'hr'] = 'candidate'

    @field_validator('email')
    @classmethod
    def lower_email(cls, value):
        return value.lower()


# ---------- Profile ----------

class ProfileUpdateRequest(_Schema):
    """Every field is optional. A provided empty value clears the field."""
    full_name: Optional[str] = Field(None, max_length=100)
    phone_number: Optional[str] = Field(None, max_length=20, pattern=r'^[0-9+()\-.\s]*$')
    address: Optional[str] = Field(None, max_length=200)
    age: Optional[int] = Field(None, ge=14, le=100)
    current_work: Optional[str] = Field(None, max_length=150)
    current_company: Optional[str] = Field(None, max_length=150)
    current_location: Optional[str] = Field(None, max_length=150)
    total_experience: Optional[float] = Field(None, ge=0, le=60)
    linkedin_url: Optional[str] = Field(None, max_length=300)
    website_url: Optional[str] = Field(None, max_length=300)
    bio: Optional[str] = Field(None, max_length=2000)
    skills_summary: Optional[str] = Field(None, max_length=2000)
    education: Optional[str] = Field(None, max_length=300)
    certifications: Optional[str] = Field(None, max_length=2000)
    languages: Optional[str] = Field(None, max_length=200)
    achievements: Optional[str] = Field(None, max_length=2000)

    @field_validator('*', mode='before')
    @classmethod
    def blanks_to_none(cls, value):
        return _blank_to_none(value)

    @field_validator('linkedin_url', 'website_url')
    @classmethod
    def http_url(cls, value):
        if value and not value.lower().startswith(('http://', 'https://')):
            raise ValueError('must start with http:// or https://')
        return value


# ---------- Salary ----------

class SalaryRequest(_Schema):
    """Inputs for the Indian salary model. City, work mode and skills are optional."""
    job_title: str = Field(min_length=2, max_length=100)
    years_of_experience: float = Field(ge=0, le=40)
    city: Optional[str] = Field(None, max_length=60)
    work_mode: Optional[Literal['On-site', 'Hybrid', 'Remote']] = None
    skills: List[str] = Field(default_factory=list, max_length=40)

    @field_validator('city', mode='before')
    @classmethod
    def blank_city(cls, value):
        return _blank_to_none(value)

    @field_validator('skills')
    @classmethod
    def clean_skills(cls, value):
        return [s.strip()[:40] for s in value if isinstance(s, str) and s.strip()]


# ---------- Jobs ----------

_Skill = Field(min_length=1, max_length=60)


class RecommendJobsRequest(_Schema):
    experience_years: float = Field(0, ge=0, le=60)
    preferred_locations: List[str] = Field(default_factory=list, max_length=20)
    preferred_categories: List[str] = Field(default_factory=list, max_length=20)
    top_k: int = Field(10, ge=1, le=50)


class LiveJobsRequest(_Schema):
    skills: List[str] = Field(default_factory=list, max_length=40)
    city: Optional[str] = Field(None, max_length=60)

    @field_validator('city', mode='before')
    @classmethod
    def blank_city(cls, value):
        return _blank_to_none(value)


class JobsBySkillsRequest(_Schema):
    skills: List[str] = Field(min_length=1, max_length=100)
    experience: int = Field(0, ge=0, le=60)
    preferred_locations: List[str] = Field(default_factory=list, max_length=20)
    preferred_categories: List[str] = Field(default_factory=list, max_length=20)
    top_k: int = Field(10, ge=1, le=50)


class MarketAnalysisRequest(_Schema):
    skills: List[str] = Field(default_factory=list, max_length=100)


# ---------- HR ----------

class HRUserQuery(_Schema):
    job_role: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=100)
    company: Optional[str] = Field(None, max_length=100)
    skills: Optional[str] = Field(None, max_length=100)
    search: Optional[str] = Field(None, max_length=100)
    min_experience: Optional[float] = Field(None, ge=0, le=60)
    max_experience: Optional[float] = Field(None, ge=0, le=60)
    min_score: Optional[float] = Field(None, ge=0, le=100)
    has_resume: Optional[Literal['true', 'false']] = None
    sort: Literal['created_at', 'name', 'experience', 'score'] = 'created_at'
    page: int = Field(1, ge=1)
    per_page: int = Field(12, ge=1, le=100)

    @model_validator(mode='before')
    @classmethod
    def drop_blank_params(cls, data):
        # Empty query parameters mean "no filter", so fall back to the defaults
        if isinstance(data, dict):
            return {key: value for key, value in data.items() if _blank_to_none(value) is not None}
        return data
