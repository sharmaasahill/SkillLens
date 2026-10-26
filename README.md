# SkillLens

> A full-stack career platform for India: salary estimates in lakhs per annum, ATS resume scoring with an AI coach (Google Gemini), market fit against 97,000+ Indian job postings from 2025, live job search across 14 sources, and a private admin dashboard.

**Live site:** https://skilllens-ljqu.onrender.com (free hosting: the first visit after 15 idle minutes takes about a minute to wake up)

![React](https://img.shields.io/badge/frontend-React-blue?style=flat&logo=react)
![Flask](https://img.shields.io/badge/backend-Flask-green?style=flat&logo=flask)
![Python](https://img.shields.io/badge/ML-Python-yellow?style=flat&logo=python)
![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-336791?style=flat&logo=postgresql)
![Docker](https://img.shields.io/badge/deploy-Docker-2496ED?style=flat&logo=docker)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## Features

- **Salary Predictor (India)** - Estimates annual CTC in INR from job title, years of experience, city, work mode and skills. Trained on 31,566 salaries disclosed in Naukri.com postings. Shows how much each input moved the estimate.
- **Advanced estimate** - Blends the linear model with gradient-boosted trees and adds a likely range and a wide range from quantile models, side by side with the quick estimate.
- **Resume Analyzer** - Extracts skills from PDF resumes with an 870-skill taxonomy (including Indian-market skills such as Tally, GST, SAP), reads Indian degrees and CGPA, calculates an ATS score, and flags personal details recruiters do not need. Paste or upload a job description to also get a match score, the must-have skills you are missing and the words to add.
- **AI coach (optional, Google Gemini)** - What a recruiter takes away in 6 seconds, rewrites of the weakest bullets with [placeholders] instead of invented numbers, likely interview questions, and requirement-by-requirement fit against a job description. Personal details are removed before sending, every answer is checked against the resume (made-up quotes and new numbers are dropped), results are saved so repeats are free, and daily limits protect the free quota. The ATS score never comes from AI.
- **Market fit** - For a target role, the skills Indian employers ask for (share of hiring companies, from the 2025 postings) and which of them the resume shows.
- **Recruiter checks** - Repeated opening verbs, skills listed but never shown in a job or project, overlapping roles and gaps, first-person writing. No AI needed.
- **Live job search** - Fresh openings from job boards (JSearch/Google for Jobs, Jooble, Adzuna, Careerjet, TheirStack), Apify scrapers (Naukri, LinkedIn, Wellfound), 45 company career pages (Greenhouse, Lever, Ashby) and remote boards (Remotive, Himalayas, Remote OK), de-duplicated and ranked against your resume with the skills you have and the ones each job also asks for.
- **Resume library** - Keep up to 5 resumes and pick a primary one, which drives salary suggestions and job ranking. PDFs are stored in the database, so they survive hosts that wipe the disk on restart.
- **Professional Profile** - Users maintain a profile (work, education, skills, links) with a profile resume and change history.
- **Admin Dashboard** - One admin account (set in settings) can search and filter users by role, location, company, experience, skills and score, track them through stages, keep private notes, view analytics, export CSV and download resumes. Regular users never see it, and its code is only downloaded after an admin sign-in.
- **Secure auth** - One sign-in page for everyone and two roles: users and a single admin. httpOnly cookie sessions with short-lived access tokens, silent refresh, CSRF protection and rate-limited login. Press and hold the eye to see a password; sign-up asks for the password twice and shows live whether they match.
- **Scroll-driven landing page** - Clean white, Apple-inspired UI built with Tailwind CSS and Framer Motion. Every landing animation follows the scroll: it moves while you scroll, stops when you stop and plays backwards when you scroll up, on laptops, tablets and phones. Fully responsive, and respects the "reduce motion" setting.

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

### Live job search

The Jobs page searches live openings from up to 14 sources at once and ranks them against your primary resume (skills 50, role 25, experience 15, freshness 10). Only the role, city and date range are sent to sources, never resume text. Results are cached and shared (1 to 24 hours per source), the same job from two sources is shown once, and each source has a daily cap that protects its free quota. Check your setup with `flask --app app check-job-sources` (add `--paid` to test keyed sources).

| Source | Key | Free plan | What it covers |
| --- | --- | --- | --- |
| [JSearch](https://www.openwebninja.com/api/jsearch) (Google for Jobs) | `JSEARCH_API_KEY` | 200 searches a month | LinkedIn, Indeed, Glassdoor and other sites Google for Jobs indexes |
| [Apify](https://apify.com) scrapers | `APIFY_TOKEN` | $5 of credit a month | Naukri, LinkedIn and Wellfound (about $0.01 to $0.08 a search) |
| [Jooble](https://in.jooble.org/api/about) | `JOOBLE_API_KEY` | 500 searches per key, in total | Indian job sites |
| [TheirStack](https://theirstack.com) | `THEIRSTACK_API_KEY` | Signup credits, 1 per job | Tech jobs across boards and career sites |
| [Adzuna](https://developer.adzuna.com/) | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Small quota | Indian listings; personal and academic use |
| [Careerjet](https://www.careerjet.com/partners/api/) | `CAREERJET_API_KEY` | Free publisher key | Indian listings; needs your live website |
| Greenhouse, Lever, Ashby | none | Free | Career pages of 45 companies hiring in India (edit `backend/data/company_boards.json`) |
| [Remotive](https://remotive.com), [Himalayas](https://himalayas.app), [Remote OK](https://remoteok.com) | none (Himalayas key optional) | Free | Remote jobs open to India |

Every job links back to its source, as Remotive, Himalayas and Remote OK require. Apify scrapers read LinkedIn, Naukri and Wellfound pages without those sites' permission; use them for your own search and keep the daily caps low.

---

## Tech Stack

**Frontend**
- React 19, React Router
- Tailwind CSS
- Framer Motion (scroll-linked animations)
- Axios
- Jest + React Testing Library

**Backend**
- Flask (app factory + blueprints), Flask-JWT-Extended, Flask-SQLAlchemy, Flask-Migrate (Alembic), Flask-Limiter, Flask-CORS
- Pydantic request validation
- SQLite locally, PostgreSQL in production (psycopg 3)
- PyPDF2 for PDF text extraction
- Gunicorn
- pytest

**ML**
- scikit-learn (Ridge, HistGradientBoostingRegressor with quantile loss, TfidfVectorizer, TruncatedSVD)
- scipy sparse matrices for market fit, pandas, numpy, joblib
- Google Gemini over its REST API with schema-checked JSON answers (optional)

**Hosting**
- Docker (one container serves the API and the React build from the same address)
- [Render](https://render.com) free web service
- [Neon](https://neon.tech) free PostgreSQL

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
cp .env.example .env           # then edit .env (JWT_SECRET_KEY, ADMIN_PASSWORD)
flask --app app db upgrade     # create/upgrade the database tables
python app.py
```

Run backend commands from inside the `backend` folder. Locally everything is saved in SQLite (`backend/instance/salary_predictor.db`); the live site uses its own PostgreSQL database, so local test accounts never reach it.

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

### Maintenance commands

Run from the `backend` folder:

| Command | What it does |
| --- | --- |
| `flask --app app db upgrade` | Create or update the database tables |
| `flask --app app reset-data` | Delete every account and all user data in the database `DATABASE_URL` points to (asks first; `--yes` skips the question). Paid-API usage counters are kept |
| `flask --app app rescore-resumes` | Re-score stored resumes after changing the scoring rules (`--dry-run` to preview) |
| `flask --app app check-job-sources` | Show which job sources are set up (`--paid` also tests keyed sources) |
| `flask --app app build-india-data` | Rebuild the dataset and retrain the salary model |

To run a command against the live database from your computer, set `DATABASE_URL` for that one command, for example `DATABASE_URL="postgresql://..." flask --app app reset-data`.

---

## Running Tests

```bash
cd backend
pytest                         # API, auth, admin, storage, salary, resume and job models

cd frontend
npm test -- --watchAll=false   # API client, sign-in, route guards, formatting
```

---

## Configuration

All settings come from environment files that are excluded from git. Copy the `.env.example` files and fill in your own values. On Render, the same variables are set under **Environment**.

**backend/.env**

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET_KEY` | Required. Signs login tokens. Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS` | Session lifetime (defaults 15 minutes / 7 days) |
| `JWT_COOKIE_SECURE`, `JWT_COOKIE_SAMESITE` | Set `JWT_COOKIE_SECURE=true` on HTTPS (the live site). Use `JWT_COOKIE_SAMESITE=None` only if the frontend and API are on different domains |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The one admin account (see Admin Account). Admin sign-in is off until `ADMIN_PASSWORD` is set |
| `DATABASE_URL` | SQLAlchemy URL, defaults to SQLite in `backend/instance/`. A Neon/PostgreSQL `postgresql://` link works as is |
| `UPLOAD_FOLDER` | Working copies of resume PDFs, defaults to `backend/uploaded_resumes` (the database keeps the real copy) |
| `CORS_ORIGINS` | Comma-separated frontend origins allowed to call the API (only needed when the frontend runs on another address, as with `npm start`) |
| `PROXY_COUNT` | Proxies in front of the app. `1` on Render, so rate limits see each visitor's real IP |
| `RATELIMIT_STORAGE_URI` | `memory://` locally; a Redis URI when running several workers |
| `AUTH_RATE_LIMIT` | Limit for login and register |
| `PRELOAD_MODELS` | Load ML models at startup (`true`) or on first use |
| `GUNICORN_THREADS` | Threads in the production server (default 8) |
| `FLASK_DEBUG` | `true` for local development only |
| `FLASK_HOST`, `FLASK_PORT` | Bind address, defaults to `127.0.0.1:5000` |
| `JSEARCH_API_KEY`, `APIFY_TOKEN`, `JOOBLE_API_KEY`, `THEIRSTACK_API_KEY`, `HIMALAYAS_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `CAREERJET_API_KEY` | Optional live job sources (see Live job search) |
| `JOB_LIMIT_<SOURCE>`, `JOB_SOURCES_DISABLED`, `JOB_SEARCH_USER_DAILY_LIMIT` | Daily caps per source and per user, and keyless sources to turn off |
| `GEMINI_API_KEY`, `GEMINI_MODELS` | Optional AI coach; free key from [Google AI Studio](https://aistudio.google.com). Models are tried in order |
| `AI_DAILY_LIMIT`, `AI_USER_DAILY_LIMIT` | AI reviews per day for the site and per user (default 40 and 10) |

**frontend/.env**

| Variable | Purpose |
| --- | --- |
| `REACT_APP_API_URL` | Backend base URL. Defaults to `http://localhost:5000` with `npm start`, and to the site's own address in a production build |

Frontend variables are bundled into the public JavaScript, so never put secrets there.

### Optional: production build served by Flask

```bash
cd frontend
npm run build
```

Flask serves `frontend/build`, so after building, the whole app is available at http://127.0.0.1:5000.

---

## Deployment

The live site runs as one Docker container on Render, with its database on Neon. Serving the React build and the API from the same address keeps the login cookies first-party, so no cross-site cookie setup is needed.

- **`Dockerfile`** builds the React app (Node 22, no source maps), installs the Python backend (3.11), runs `flask --app app db upgrade`, then starts Gunicorn.
- **`backend/gunicorn.conf.py`** uses one worker with 8 threads (the ML models, caches and job-search threads live in memory and fit Render's 512 MB free plan) and a 180-second timeout for AI reviews. Models load in the background, so the site answers immediately.
- **Resume PDFs** are saved in the `stored_files` table. Render's disk is wiped on every restart; a missing file is rewritten from the database when it is next needed.

Steps:

1. Create a free PostgreSQL database on [Neon](https://neon.tech) and copy its connection string (pooling off).
2. On [Render](https://render.com), create a **Web Service** from this GitHub repo with language **Docker** and the **Free** plan.
3. Under **Environment**, set `DATABASE_URL` (the Neon link), `JWT_SECRET_KEY`, `JWT_COOKIE_SECURE=true`, `PROXY_COUNT=1`, `ADMIN_PASSWORD`, and any API keys you use.
4. Deploy. Every push to `master` redeploys, and new migrations run automatically on start.
5. Optional: point a free uptime monitor at `/health` every 5 minutes, so the free service does not sleep.

---

## Architecture

- **App factory:** `skilllens.create_app()` builds the app, so tests create isolated instances with their own database and upload folder.
- **Blueprints** in `skilllens/routes/` handle HTTP only: auth, profile, resumes, salary, jobs, admin (`/api/admin/...`), frontend.
- **Services** in `skilllens/services/` hold the business logic. `ml.py` loads each model once per process. `storage.py` saves uploads as `users/<id>/<uuid>.pdf` (so files from different users can never collide) with a copy in the database. `admin.py` aggregates in SQL, so a page of users costs a fixed number of queries. `admin_account.py` keeps the single admin account in step with `ADMIN_EMAIL` and `ADMIN_PASSWORD`. `jobs/` holds the 14 job sources, ranking and background search. `quota.py` enforces daily limits for paid APIs.
- **Schemas** in `skilllens/schemas.py` validate every request body and admin query string. Invalid input returns `400` with per-field details.
- **Errors** always come back as JSON: `{"error": "...", "details": [...]}`.
- **Auth:** tokens live in httpOnly cookies that JavaScript cannot read. Write requests send an `X-CSRF-TOKEN` header. The frontend client (`src/api.js`) refreshes expired sessions automatically.

---

## Admin Account

There is one sign-in page for everyone. Signing in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` opens the admin dashboard; every other email is a regular user, and nobody can register the admin email. The admin account is created on its first sign-in, so it works on a fresh local or live database with no setup script. Only one account can be admin: any other account marked as admin becomes a regular user on the next admin sign-in. Changing `ADMIN_PASSWORD` takes effect on the next admin sign-in.

The admin cannot use the user tools (salary, resume, jobs), and users get "Access denied" from every admin page and API.

---

## Directory Structure

```
SkillLens/
  Dockerfile                One container: builds React, serves it and the API with Gunicorn
  .dockerignore             Keeps secrets and local data out of the image
  backend/
    app.py                  Entry point (creates the app, runs the dev server)
    gunicorn.conf.py        Production server settings
    requirements.txt        Runtime dependencies (requirements-dev.txt adds pytest)
    skilllens/
      __init__.py           create_app() factory
      config.py             Settings from environment variables
      schemas.py            Request validation
      security.py           JWT user loading, admin-only and user-only decorators
      cli.py                Maintenance commands (reset-data, rescore-resumes, ...)
      routes/               Blueprints (auth, profile, resumes, salary, jobs, admin, frontend)
      services/             Business logic, model registry, file storage, admin, job search
    migrations/             Alembic database migrations
    tests/                  pytest suite
    .env.example            Backend settings template
    instance/               SQLite database (created at runtime, not in git)
    data/
      india_jobs.csv.gz     Cleaned Naukri.com 2025 postings (CC BY-NC-SA 4.0)
      company_boards.json   Company career pages searched for live jobs
      raw/                  Raw download (not in git)
    models/
      database.py           SQLAlchemy models
      india_data.py         Download, clean and load the Indian dataset
      salary_model.py       Indian salary models (training and prediction)
      india_salary_model.pkl  Trained salary model
      resume_analyzer.py    Resume parsing and ATS scoring
      jd_matcher.py         Resume against job description matching
      job_market.py         Market fit: what postings for a role ask for
      skills_taxonomy.py    870 skills with display names, categories and spellings
      resume_checks.py      Recruiter checks (verbs, unproven skills, timeline)
    uploaded_resumes/       Working copies of uploaded PDFs (created at runtime, not in git)
  frontend/
    .env.example            Frontend settings template
    public/
    src/
      App.js                Routes (user pages, admin page)
      api.js                Axios client: cookies, CSRF, silent token refresh
      config.js             API address
      components/
        landing/            Scroll-driven landing page sections
        jobs/               Job results and source picker
        resume/             AI coach, market fit, recruiter checks
        ui/                 Design system: buttons, fields, password field, modals, toasts, app shell
      contexts/             Auth state
      lib/                  Formatting, dashboard stats and resume insight rules
      pages/                Landing, Auth, Dashboard, Salary, Resume, Jobs, Profile, Admin
  README.md
```

---

## License

The code is licensed under the MIT License. The bundled dataset (`backend/data/india_jobs.csv.gz`) and the model trained on it (`backend/models/india_salary_model.pkl`) are derived from data licensed CC BY-NC-SA 4.0, so they may only be used non-commercially, with attribution, under the same licence.

---

## Acknowledgements

- [Indian Job Market Dataset 2025](https://www.kaggle.com/datasets/shivamshrivastava21/indian-job-market-dataset-2025-2026) by Shivam Shrivastava, licensed CC BY-NC-SA 4.0. Mirrored for download by [JasobantaParida/Indian-Job-Market-Intelligence](https://github.com/JasobantaParida/Indian-Job-Market-Intelligence).
- Google Gemini, and the job sources listed under Live job search
- React, Tailwind CSS, Framer Motion, Flask and scikit-learn
