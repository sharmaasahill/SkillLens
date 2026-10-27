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
    # The "I agree to the Privacy Policy" box. An account cannot be made without it.
    accept_privacy: bool = Field(False, validate_default=True)

    @field_validator('email')
    @classmethod
    def lower_email(cls, value):
        return value.lower()

    @field_validator('accept_privacy')
    @classmethod
    def must_accept(cls, value):
        if value is not True:
            raise ValueError('Agree to the Privacy Policy to create an account')
        return value


class TwoFactorLoginRequest(_Schema):
    challenge: str = Field(min_length=10, max_length=500)
    code: str = Field(min_length=6, max_length=20)


class TwoFactorCodeRequest(_Schema):
    code: str = Field(min_length=6, max_length=20)



class LoginRequest(_Schema):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)

    @field_validator('email')
    @classmethod
    def lower_email(cls, value):
        return value.lower()


class _Password(BaseModel):
    # Passwords are never trimmed: a space can be part of one
    model_config = ConfigDict(extra='ignore')


class ChangePasswordRequest(_Password):
    # Not needed by accounts made with Google, which have no password yet
    current_password: Optional[str] = Field(None, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class TwoFactorOffRequest(_Password):
    password: str = Field(min_length=1, max_length=128)
    code: str = Field(min_length=6, max_length=20)


class DeleteAccountRequest(_Password):
    password: Optional[str] = Field(None, max_length=128)
    # Accounts made with Google confirm by typing their email instead of a password
    confirm_email: Optional[str] = Field(None, max_length=120)


class ClientErrorReport(_Schema):
    """A JavaScript error from someone's browser, for the admin error log."""
    message: str = Field(min_length=1, max_length=500)
    stack: Optional[str] = Field(None, max_length=6000)
    url: Optional[str] = Field(None, max_length=300)
    kind: Literal['error', 'unhandledrejection', 'render'] = 'error'


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


class CityCompareRequest(SalaryRequest):
    """The same inputs as an estimate, plus up to 12 cities to compare (empty: the biggest job markets)."""
    cities: List[str] = Field(default_factory=list, max_length=12)

    @field_validator('cities')
    @classmethod
    def clean_cities(cls, value):
        return [c.strip()[:60] for c in value if isinstance(c, str) and c.strip()]


class OfferCheckRequest(SalaryRequest):
    """The same inputs as an estimate, plus the offer in lakhs per annum (12.5 means Rs 12.5 lakh a year)."""
    offer_lpa: float = Field(gt=0.5, le=500)


# ---------- Jobs ----------

class JobSearchRequest(_Schema):
    """A live job search. Only role, city, days and remote_only are sent to job sources."""
    role: str = Field(min_length=2, max_length=100)
    city: Optional[str] = Field(None, max_length=60)
    days: Literal[1, 3, 7, 14, 30] = 14
    remote_only: bool = False
    sources: List[str] = Field(default_factory=list, max_length=30)

    @field_validator('city', mode='before')
    @classmethod
    def blank_city(cls, value):
        value = _blank_to_none(value)
        return None if isinstance(value, str) and value.lower() in ('anywhere', 'india', 'anywhere in india') else value


class MarketFitRequest(_Schema):
    """Target role for market fit. Empty means: guess it from the profile or the resume."""
    role: Optional[str] = Field(None, max_length=100)

    @field_validator('role', mode='before')
    @classmethod
    def blank_role(cls, value):
        return _blank_to_none(value)


# ---------- Admin ----------

class AdminUserQuery(_Schema):
    job_role: Optional[str] = Field(None, max_length=100)
    location: Optional[str] = Field(None, max_length=100)
    company: Optional[str] = Field(None, max_length=100)
    skills: Optional[str] = Field(None, max_length=100)
    search: Optional[str] = Field(None, max_length=100)
    min_experience: Optional[float] = Field(None, ge=0, le=60)
    max_experience: Optional[float] = Field(None, ge=0, le=60)
    min_score: Optional[float] = Field(None, ge=0, le=100)
    has_resume: Optional[Literal['true', 'false']] = None
    sort: Literal['created_at', 'name', 'experience', 'score', 'activity'] = 'created_at'
    view: Literal['active', 'removed', 'blocked'] = 'active'
    status: Optional[Literal['verified', 'follow_up', 'flagged', 'none']] = None
    page: int = Field(1, ge=1)
    per_page: int = Field(12, ge=1, le=100)

    @model_validator(mode='before')
    @classmethod
    def drop_blank_params(cls, data):
        # Empty query parameters mean "no filter", so fall back to the defaults
        if isinstance(data, dict):
            return {key: value for key, value in data.items() if _blank_to_none(value) is not None}
        return data


REVIEW_STATUSES = Literal['verified', 'follow_up', 'flagged']


class UserReviewRequest(_Schema):
    """Change one user's status or admin note. Send only what changes; status null clears it."""
    model_config = ConfigDict(extra='forbid', str_strip_whitespace=True)
    status: Optional[REVIEW_STATUSES] = None
    note: Optional[str] = Field(None, max_length=2000)


class BulkReviewRequest(_Schema):
    user_ids: List[int] = Field(min_length=1, max_length=200)
    action: Literal['remove', 'restore', 'status']
    status: Optional[REVIEW_STATUSES] = None
