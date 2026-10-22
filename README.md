# SkillLens

> A full-stack career platform for India: salary estimates in lakhs per annum, ATS resume scoring and job matching, all built on 97,000+ Indian job postings from 2025, plus a searchable candidate view for HR teams.

![React](https://img.shields.io/badge/frontend-React-blue?style=flat&logo=react)
![Flask](https://img.shields.io/badge/backend-Flask-green?style=flat&logo=flask)
![Python](https://img.shields.io/badge/ML-Python-yellow?style=flat&logo=python)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

- **Salary Predictor (India)** - Estimates annual CTC in INR from job title, years of experience, city, work mode and skills. Trained on 31,566 salaries disclosed in Naukri.com postings. Shows how much each input moved the estimate.
- **Advanced estimate** - Blends the linear model with gradient-boosted trees and adds a likely range and a wide range from quantile models, side by side with the quick estimate.
- **Resume Analyzer** - Extracts skills from PDF resumes (including Indian-market skills such as Tally, GST, SAP), reads Indian degrees and CGPA, calculates an ATS score, and flags personal details recruiters do not need.

### How the ATS score works

Every resume is scored out of 100 on seven parts, and every lost point comes with an explanation:

| Part | Points | What earns them |
| --- | --- | --- |
| Contact details | 10 | Email, phone number, LinkedIn/GitHub/portfolio |
| Standard sections | 20 | Experience, education, skills, summary, projects or certifications |
| Skills and keywords | 20 | Recognised skills and industry keywords, matched as whole words |
| Quantified impact | 15 | Results with numbers: percentages, money, users, time saved |
| Action verbs | 15 | Strong verbs such as led, built, reduced; weak phrases cost points |
| Length | 10 | 300 to 1,000 words |
| ATS-safe formatting | 10 | No tables, image references, page-number footers or icon glyphs |

After changing the scoring rules, rescore stored resumes with `flask --app app rescore-resumes` (add `--dry-run` to preview).
- **Professional Profile** - Users maintain a profile (work, education, skills, links) with a profile resume and change history.
- **HR Dashboard** - HR users can search and filter candidates by role, location, company, experience, skills and score, view analytics, and download resumes.
- **Secure auth** - httpOnly cookie sessions with short-lived access tokens, silent refresh, CSRF protection, rate-limited login and separate User and HR roles.
- **Job Recommender** - Matches skills from your latest resume against 97,316 Indian postings. Skills match as whole tags, weighted by rarity, and each posting's own experience range is used. Filters by city and field, shows disclosed pay, and suggests skills that similar roles ask for. Optionally adds live openings from Adzuna or Careerjet.

### Data and accuracy

| | |
| --- | --- |
| Source | [Indian Job Market Dataset 2025](https://www.kaggle.com/datasets/shivamshrivastava21/indian-job-market-dataset-2025-2026) by Shivam Shrivastava (Kaggle), Naukri.com postings collected September to October 2025 |
| Licence | CC BY-NC-SA 4.0: non-commercial use only, with attribution; derived data carries the same licence |
| Postings | 97,316 after removing duplicates and non-INR salaries, 18,595 companies, 196 cities with 20+ postings |
| Salary training rows | 31,566 postings with a believable disclosed salary (Rs 60,000 to Rs 1.5 Cr a year, range no wider than 4x) |
| Accuracy | Tested on 20% of companies held out from training: median error 22.5%, 54% of estimates within 25% of the posted salary (R² 0.71 on log salary) |

Posted salaries are what employers advertise, not what people are paid, and most postings (66%) do not disclose pay. Treat estimates as a starting point for negotiation.

To rebuild the data and retrain (downloads the 83 MB raw file into `backend/data/raw`, about two minutes):

```bash
flask --app app build-india-data
```

### Optional live job listings

Add a free key to `backend/.env` and the Job Recommender also shows current openings. Only search keywords (your top three skills) and a city are sent, never resume text.

| Provider | Cost | Notes |
| --- | --- | --- |
| [Adzuna](https://developer.adzuna.com/) (`ADZUNA_APP_ID`, `ADZUNA_APP_KEY`) | Free key | Permitted for personal and academic use; commercial use needs a licence after a 14-day trial |
| [Careerjet](https://www.careerjet.com/partners/api/) (`CAREERJET_API_KEY`) | Free publisher key | Each listing links to the employer's page |
- Clean white, Apple-inspired UI with scroll animations, built with Tailwind CSS and Framer Motion. Fully responsive.

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
- scikit-learn (Ridge, HistGradientBoostingRegressor with quantile loss, TfidfVectorizer, TruncatedSVD)
- scipy sparse matrices for job matching, pandas, numpy, joblib

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
pytest                         # API, auth, storage, HR queries, salary and job models

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
| `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `CAREERJET_API_KEY` | Optional live job listings (see above) |

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
    data/
      india_jobs.csv.gz     Cleaned Naukri.com 2025 postings (CC BY-NC-SA 4.0)
      raw/                  Raw download (not in git)
    models/
      database.py           SQLAlchemy models
      india_data.py         Download, clean and load the Indian dataset
      salary_model.py       Indian salary models (training and prediction)
      india_salary_model.pkl  Trained salary model
      resume_analyzer.py    Resume parsing and ATS scoring
      job_recommender.py    Skill-based job matching
    uploaded_resumes/       Uploaded PDFs (created at runtime, not in git)
  frontend/
    .env.example            Frontend settings template
    public/
    src/
      App.js
      api.js                Axios client: cookies, CSRF, silent token refresh
      config.js             Reads REACT_APP_API_URL
      components/
        landing/            Animated landing page sections
        ui/                 Design system: buttons, cards, fields, modals, toasts, app shell
      contexts/             Auth state
      lib/                  Formatting, dashboard stats and resume insight rules
      pages/
  README.md
```

---

## License

The code is licensed under the MIT License. The bundled dataset (`backend/data/india_jobs.csv.gz`) and the model trained on it (`backend/models/india_salary_model.pkl`) are derived from data licensed CC BY-NC-SA 4.0, so they may only be used non-commercially, with attribution, under the same licence.

---

## Acknowledgements

- [Indian Job Market Dataset 2025](https://www.kaggle.com/datasets/shivamshrivastava21/indian-job-market-dataset-2025-2026) by Shivam Shrivastava, licensed CC BY-NC-SA 4.0. Mirrored for download by [JasobantaParida/Indian-Job-Market-Intelligence](https://github.com/JasobantaParida/Indian-Job-Market-Intelligence).
- React, Tailwind CSS and Flask
