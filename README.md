# SkillLens

> An AI-powered full-stack career platform that predicts salaries, analyzes resumes for ATS compatibility, and gives HR teams a searchable view of candidates.

![React](https://img.shields.io/badge/frontend-React-blue?style=flat&logo=react)
![Flask](https://img.shields.io/badge/backend-Flask-green?style=flat&logo=flask)
![Python](https://img.shields.io/badge/ML-Python-yellow?style=flat&logo=python)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

- **Salary Predictor** - Estimates salary from age, gender, education, job title and experience using a Random Forest model trained on `Salary_Data.csv`.
- **Advanced Salary Predictor** - Ensemble model (Random Forest + Gradient Boosting + Ridge) with feature engineering, confidence scores and a side-by-side comparison with the basic model.
- **Resume Analyzer** - Extracts skills from PDF resumes, calculates an ATS compatibility score, and gives section, keyword, action-verb and formatting feedback.
- **Professional Profile** - Users maintain a profile (work, education, skills, links) with a profile resume and change history.
- **HR Dashboard** - HR users can search and filter candidates by role, location, company, experience, skills and score, view analytics, and download resumes.
- **Secure auth** - httpOnly cookie sessions with short-lived access tokens, silent refresh, CSRF protection, rate-limited login and separate User and HR roles.
- **Job Recommender** - Matches skills from your latest resume against a Glassdoor job listings dataset using TF-IDF similarity, with experience fit, match reasoning and a skills-gap analysis.
- Dark mode (saved per browser) and responsive UI built with Tailwind CSS, Framer Motion and Heroicons.

---

## Tech Stack

**Frontend**
- React 19, React Router
- Tailwind CSS
- Framer Motion
- Axios
- Jest + React Testing Library

**Backend**
- Flask (app factory + blueprints), Flask-JWT-Extended, Flask-SQLAlchemy, Flask-Migrate (Alembic), Flask-Limiter, Flask-CORS
- Pydantic request validation
- SQLite
- PyPDF2 for PDF text extraction
- pytest

**ML**
- scikit-learn (RandomForestRegressor, GradientBoostingRegressor, Ridge, VotingRegressor, TfidfVectorizer)
- pandas, numpy, joblib

---

## Prerequisites

- Python 3.11 (the pinned numpy/pandas/scikit-learn versions do not ship wheels for 3.12+)
- Node.js 18+ and npm

---

## How to Run

### 1. Backend (http://127.0.0.1:5000)

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows (Git Bash: source venv/Scripts/activate)
# source venv/bin/activate     # macOS / Linux
pip install -r requirements-dev.txt
cp .env.example .env           # then edit .env (JWT_SECRET_KEY, HR_EMAIL, HR_PASSWORD)
flask --app app db upgrade     # create/upgrade the database tables
python create_hr_user.py       # one-time: creates the HR account
python app.py
```

Run backend commands from inside the `backend` folder.

**Upgrading a database created before migrations existed:** mark it as the baseline once, then upgrade:

```bash
flask --app app db stamp 0001_initial
flask --app app db upgrade
```

After changing a model in `models/database.py`, create a migration with `flask --app app db migrate -m "describe the change"`, review the file in `migrations/versions/`, then run `flask --app app db upgrade`.

### 2. Frontend (http://localhost:3000)

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env           # optional: change REACT_APP_API_URL
npm start
```

---

## Running Tests

```bash
cd backend
pytest                         # API, auth, storage, HR queries, ML wrappers

cd frontend
npm test -- --watchAll=false   # API client, auth flow, route guards
```

---

## Configuration

All settings come from environment files that are excluded from git. Copy the `.env.example` files and fill in your own values.

**backend/.env**

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET_KEY` | Required. Signs login tokens. Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS` | Session lifetime (defaults 15 minutes / 7 days) |
| `JWT_COOKIE_SECURE`, `JWT_COOKIE_SAMESITE` | Set `true` / `None` when serving over HTTPS on separate domains |
| `DATABASE_URL` | SQLAlchemy URL, defaults to SQLite in `backend/instance/` |
| `UPLOAD_FOLDER` | Resume storage folder, defaults to `backend/uploaded_resumes` |
| `CORS_ORIGINS` | Comma-separated frontend origins allowed to call the API |
| `RATELIMIT_STORAGE_URI` | `memory://` locally; a Redis URI when running several workers |
| `AUTH_RATE_LIMIT`, `PUBLIC_API_RATE_LIMIT` | Limits for login/register and the public skills endpoint |
| `PRELOAD_MODELS` | Load ML models at startup (`true`) or on first use |
| `FLASK_DEBUG` | `true` for local development only |
| `FLASK_HOST`, `FLASK_PORT` | Bind address, defaults to `127.0.0.1:5000` |
| `HR_EMAIL`, `HR_PASSWORD`, `HR_NAME` | HR account created by `create_hr_user.py` |

**frontend/.env**

| Variable | Purpose |
| --- | --- |
| `REACT_APP_API_URL` | Backend base URL, defaults to `http://localhost:5000` |

Frontend variables are bundled into the public JavaScript, so never put secrets there.

### Optional: production build served by Flask

```bash
cd frontend
npm run build
```

Flask serves `frontend/build`, so after building, the whole app is available at http://127.0.0.1:5000.

---

## Architecture

- **App factory:** `skilllens.create_app()` builds the app, so tests create isolated instances with their own database and upload folder.
- **Blueprints** in `skilllens/routes/` handle HTTP only: auth, profile, resumes, salary, jobs, hr, frontend.
- **Services** in `skilllens/services/` hold the business logic. `ml.py` loads each model once per process. `storage.py` saves uploads as `users/<id>/<uuid>.pdf`, so files from different users can never collide. `hr.py` aggregates in SQL, so a page of candidates costs a fixed number of queries.
- **Schemas** in `skilllens/schemas.py` validate every request body and HR query string. Invalid input returns `400` with per-field details.
- **Errors** always come back as JSON: `{"error": "...", "details": [...]}`.
- **Auth:** tokens live in httpOnly cookies that JavaScript cannot read. Write requests send an `X-CSRF-TOKEN` header. The frontend client (`src/api.js`) refreshes expired sessions automatically.

---

## HR Account

`python create_hr_user.py` creates (or resets) the HR account using `HR_EMAIL` and `HR_PASSWORD` from `backend/.env`. Sign in with it via "Login as HR". Regular users can register from the login page.

---

## Directory Structure

```
SkillLens/
  backend/
    app.py                  Entry point (creates the app, runs the dev server)
    create_hr_user.py       Creates/updates the HR account
    requirements.txt        Runtime dependencies (requirements-dev.txt adds pytest)
    skilllens/
      __init__.py           create_app() factory
      config.py             Settings from environment variables
      schemas.py            Request validation
      security.py           JWT user loading, HR-only decorator
      routes/               Blueprints
      services/             Business logic, model registry, file storage
    migrations/             Alembic database migrations
    tests/                  pytest suite
    .env.example            Backend settings template
    instance/               SQLite database (created at runtime, not in git)
    models/
      database.py           SQLAlchemy models
      salary_predictor.py   Basic salary model
      advanced_salary_predictor.py
      resume_analyzer.py    Resume parsing and ATS scoring
      job_recommender.py    Skill-based job matching
      Salary_Data.csv       Salary training data
      glassdoor_all_jobs.csv  Job listings for recommendations
      *.pkl                 Trained models and encoders
    uploaded_resumes/       Uploaded PDFs (created at runtime, not in git)
  frontend/
    .env.example            Frontend settings template
    public/
    src/
      App.js
      api.js                Axios client: cookies, CSRF, silent token refresh
      config.js             Reads REACT_APP_API_URL
      components/           Shared UI (theme toggle, protected routes)
      contexts/             Auth and theme state
      pages/
  README.md
```

---

## License

This project is licensed under the MIT License.

---

## Acknowledgements

- Salary dataset from Kaggle
- React, Tailwind CSS and Flask
