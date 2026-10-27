# SkillLens

SkillLens is a career tool for people looking for jobs in India. You can check what your role pays (in lakhs per annum), score your resume the way hiring software reads it, get honest AI feedback on it, compare it with what companies are asking for, and search live jobs from 14 sources ranked against your own skills.

**Live site:** https://skilllens-ljqu.onrender.com
(It runs on a free server, so the first visit after a quiet spell can take about a minute to wake up.)

![React](https://img.shields.io/badge/frontend-React-blue?style=flat&logo=react)
![Flask](https://img.shields.io/badge/backend-Flask-green?style=flat&logo=flask)
![Python](https://img.shields.io/badge/ML-Python-yellow?style=flat&logo=python)
![PostgreSQL](https://img.shields.io/badge/database-PostgreSQL-336791?style=flat&logo=postgresql)
![Docker](https://img.shields.io/badge/deploy-Docker-2496ED?style=flat&logo=docker)
![License](https://img.shields.io/badge/license-MIT-blue)
![CI](https://github.com/sharmaasahill/SkillLens/actions/workflows/ci.yml/badge.svg)

---

## Why I built it

When you get an offer or apply for a job in India, it's hard to know if the pay is fair or why your resume isn't getting shortlisted. Most salary sites are built on US data, and most resume checkers just give you a score without saying why. I wanted something that uses real Indian job postings, explains every number it shows, and doesn't make things up.

---

## What it does

### Salary
- **Salary estimate.** Enter your job title, years of experience, city, work mode and skills, and get your expected yearly CTC. It also shows how much each input pushed the number up or down.
- **Two models side by side.** A quick one (Ridge regression) and an advanced one (Ridge mixed with gradient-boosted trees), plus a likely range and a wider range.
- **Compare cities.** The same profile across India's biggest job markets, best paid first. For example: "Bengaluru ₹7.6 LPA, +₹1.2 LPA vs Pune".
- **Check an offer.** Type an offer like ₹12 LPA and see where it sits among similar postings (as a percentile) and what you could ask for.

### Resume
- **ATS score out of 100,** with every lost point explained (see the table below). It knows 870 skills, including Indian ones like Tally, GST and SAP, and reads Indian degrees and CGPA.
- **Match against a job description.** Paste or upload a JD to see your match score, the must-have skills you're missing and the words to add.
- **Recruiter checks.** It catches things like the same opening verb repeated, skills you list but never show in a project, overlapping job dates and gaps. No AI is used for this.
- **Market fit.** For a target role, which skills Indian companies actually ask for and which of them your resume shows.
- **AI coach (Google Gemini).** What a recruiter takes away in 6 seconds, rewrites of your weakest bullet points, and likely interview questions.
- **Cover letter (Google Gemini).** A short draft for one resume and one job. You can copy it or download it.
- **Score over time.** A chart on the dashboard shows your scores improving with each version, for example 58 → 71 → 82.

I didn't want the AI to invent anything, so a few rules are built in:
- Your name, phone, email and links are removed before anything is sent to Gemini.
- A rewrite that adds a number your resume never had is thrown away. Missing numbers become [placeholders] for you to fill in.
- A cover letter sentence with a number that is in neither your resume nor the job description is removed.
- The ATS score itself never comes from AI, so the same resume always gets the same score.

### Jobs
- **Live job search across 14 sources:** Google for Jobs (through JSearch), Jooble, Adzuna, Careerjet, TheirStack, Naukri, LinkedIn and Wellfound (through Apify), the career pages of 45 companies (Greenhouse, Lever, Ashby), and the remote boards Remotive, Himalayas and Remote OK.
- Duplicates are removed, and every job is ranked against your resume, showing the skills you have and the ones it also asks for.
- **"Check my resume for this job"** opens the resume page with that job's description already filled in.

### Accounts and the admin side
- **One sign-in page** for everyone, with email and password or **Continue with Google**.
- **Date of birth at sign-up**, because SkillLens is for people aged 18 or older. Google doesn't share it, so Google sign-ups (and older accounts) are asked for it once before they go on.
- **Profile:** you can edit everything, change your password, or delete your account and all your data in one go.
- **Profile photo** in the top bar and on the Profile page. Upload one (it's cropped to a square in the browser first), or it's copied from your Google account the first time you sign in with Google.
- **Admin dashboard** (one admin account):
  - Search and filter users, mark them Verified, Follow up or Flagged, and keep private notes.
  - See analytics, export CSV and download resumes.
  - Block someone, give them a temporary password, or delete their account.
  - Watch API usage and cost: Gemini uses, Apify spend this month, calls per job source against its daily limit, and database size.
  - See an error log of crashes in the API or in users' browsers, plus failing outside services, grouped so repeats just raise a count.
  - Two-factor sign-in with Google Authenticator.

### Security and privacy
- Login tokens live in httpOnly cookies (page scripts can't read them), with CSRF protection and rate-limited sign-in.
- Easy passwords like "password123" or your name plus a number are refused.
- Security headers: a Content-Security-Policy, HSTS, no framing by other sites, and no caching of personal data.
- Uploads are limited to 5 MB.
- A plain-language [Privacy Policy](https://skilllens-ljqu.onrender.com/privacy) covers what is stored, who handles it, how long it's kept, and your rights under India's DPDP Act.
- A weekly encrypted backup of the database.

### Design
A clean white, Apple-inspired look made with Tailwind CSS and Framer Motion. The landing page animations follow your scroll: they move while you scroll, stop when you stop, and run backwards when you scroll up. It works on phones, tablets and laptops, and respects the "reduce motion" setting.

---

## How the ATS score works

Every resume is scored out of 100 on seven parts:

| Part | Points | What earns them |
| --- | --- | --- |
| Contact details | 10 | Email, phone number, LinkedIn/GitHub/portfolio |
| Standard sections | 20 | Experience, education, skills, summary, projects or certifications |
| Skills and keywords | 20 | Recognised skills and industry keywords, matched as whole words |
| Quantified impact | 15 | Results with numbers: percentages, money, users, time saved |
| Action verbs | 15 | Strong verbs like led, built or reduced; weak phrases cost points |
| Length | 10 | 300 to 1,000 words |
| ATS-safe formatting | 10 | No tables, image references, page-number footers or icon glyphs |

If I change the scoring rules, `flask --app app rescore-resumes` re-scores every saved resume (add `--dry-run` to preview).

---

## Data and accuracy

| | |
| --- | --- |
| Source | [Indian Job Market Dataset 2025](https://www.kaggle.com/datasets/shivamshrivastava21/indian-job-market-dataset-2025-2026) by Shivam Shrivastava (Kaggle): Naukri.com postings from September to October 2025 |
| Licence | CC BY-NC-SA 4.0: non-commercial use with credit, and anything made from it keeps the same licence |
| Postings | 97,316 after removing duplicates and non-INR salaries, from 18,595 companies and 196 cities |
| Salary training rows | 31,566 postings with a believable disclosed salary (₹60,000 to ₹1.5 Cr a year) |
| Accuracy | Tested on 20% of companies the model never saw: median error 22.5%, and 54% of estimates within 25% of the posted salary |

Posted salaries are what companies advertise, not what people actually get, and most postings (66%) don't show pay at all. So treat an estimate as a starting point for negotiation, not a promise.

To download the raw data (83 MB) and retrain the model, which takes about two minutes:

```bash
flask --app app build-india-data
```

---

## Live job search sources

Only the role, city and date range are sent to these sources, never your resume. Results are cached and shared for 1 to 24 hours, and every source has a daily cap so the free quotas last. `flask --app app check-job-sources` shows which ones are set up (add `--paid` to also test the ones with keys).

| Source | Key | Free plan | What it covers |
| --- | --- | --- | --- |
| [JSearch](https://www.openwebninja.com/api/jsearch) (Google for Jobs) | `JSEARCH_API_KEY` | 200 searches a month | LinkedIn, Indeed, Glassdoor and other sites Google indexes |
| [Apify](https://apify.com) scrapers | `APIFY_TOKEN` | $5 credit a month | Naukri, LinkedIn and Wellfound (about $0.01 to $0.08 a search) |
| [Jooble](https://in.jooble.org/api/about) | `JOOBLE_API_KEY` | 500 searches per key | Indian job sites |
| [TheirStack](https://theirstack.com) | `THEIRSTACK_API_KEY` | Signup credits, 1 per job | Tech jobs from boards and career sites |
| [Adzuna](https://developer.adzuna.com/) | `ADZUNA_APP_ID`, `ADZUNA_APP_KEY` | Small quota | Indian listings |
| [Careerjet](https://www.careerjet.com/partners/api/) | `CAREERJET_API_KEY` | Free | Indian listings. Needs your live website and your server's IP addresses declared in the Careerjet partner page |
| Greenhouse, Lever, Ashby | none | Free | Career pages of 45 companies hiring in India (`backend/data/company_boards.json`) |
| [Remotive](https://remotive.com), [Himalayas](https://himalayas.app), [Remote OK](https://remoteok.com) | none | Free | Remote jobs open to India |

Every job links back to where it came from. The Apify scrapers read LinkedIn, Naukri and Wellfound pages without those sites' permission, so I keep their daily caps low and use them only for personal search.

---

## Tech stack

**Frontend:** React 19, React Router, Tailwind CSS, Framer Motion, Axios, Jest and React Testing Library

**Backend:**
- Flask with blueprints, Flask-JWT-Extended, Flask-SQLAlchemy, Flask-Migrate (Alembic), Flask-Limiter and Flask-CORS
- Pydantic for checking every request
- pypdf to read PDFs
- pyotp and segno for two-factor sign-in
- Gunicorn and pytest

**Machine learning:**
- scikit-learn: Ridge, HistGradientBoostingRegressor with quantile loss, TF-IDF and TruncatedSVD
- pandas, numpy, scipy and joblib
- Google Gemini through its REST API, with answers checked against a JSON schema

**Hosting:**
- Database: SQLite on my laptop, PostgreSQL on Neon (free) for the live site
- The live site is one Docker container on Render (free)
- GitHub Actions runs tests and backups

---

## Running it on your computer

You need Python 3.11 (the pinned numpy and pandas versions don't have builds for 3.12 yet) and Node.js 18 or newer.

### Backend (http://127.0.0.1:5000)

```bash
cd backend
python -m venv venv
venv\Scripts\activate          # Windows (Git Bash: source venv/Scripts/activate)
# source venv/bin/activate     # macOS / Linux
pip install -r requirements-dev.txt
cp .env.example .env           # then fill in JWT_SECRET_KEY, ADMIN_EMAIL and ADMIN_PASSWORD
flask --app app db upgrade     # creates the database tables
python app.py
```

Run backend commands from inside the `backend` folder. Locally everything is saved in SQLite (`backend/instance/salary_predictor.db`). The live site has its own PostgreSQL database, so test accounts you make on your computer never show up there.

If you change a model in `models/database.py`, make a migration with `flask --app app db migrate -m "what changed"`, check the new file in `migrations/versions/`, then run `flask --app app db upgrade`.

### Frontend (http://localhost:3000)

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env           # optional
npm start
```

### Handy commands

Run these from the `backend` folder:

| Command | What it does |
| --- | --- |
| `flask --app app db upgrade` | Creates or updates the database tables |
| `flask --app app reset-data` | Deletes every account and all user data in the database `DATABASE_URL` points to (it asks first) |
| `flask --app app rescore-resumes` | Re-scores saved resumes after a scoring change |
| `flask --app app check-job-sources` | Shows which job sources are set up |
| `flask --app app build-india-data` | Rebuilds the dataset and retrains the salary model |
| `flask --app app cleanup` | Deletes cached job results older than a week. This also runs by itself every few hours |
| `flask --app app admin-2fa-off` | Turns off the admin's two-factor sign-in if the phone and recovery codes are both lost |

To run one of these against the live database, set `DATABASE_URL` just for that command, for example `DATABASE_URL="postgresql://..." flask --app app reset-data`.

---

## Tests

```bash
cd backend
pytest                         # 171 tests: API, sign-in, admin tools, security, salary, resumes, jobs

cd frontend
npm test -- --watchAll=false   # 35 tests: sign-in, route guards and the newer screens
```

On every push to `master`, GitHub Actions runs:
- the backend tests;
- the frontend lint, tests and production build;
- a Docker build.

Dependabot opens a pull request when a package has an update. New scikit-learn versions are skipped, because the salary model has to be retrained for them.

---

## Settings

All settings come from `.env` files, which are kept out of git. Copy the `.env.example` files and fill in your own values. On Render the same names go under **Environment**.

**backend/.env**

| Name | What it's for |
| --- | --- |
| `JWT_SECRET_KEY` | Required. Signs login tokens. Make one with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `ADMIN_EMAIL`, `ADMIN_PASSWORD` | The one admin account. Both are needed, otherwise admin sign-in is off |
| `CONTACT_EMAIL` | Shown on the Privacy Policy page |
| `DATABASE_URL` | Leave empty for SQLite. On the live site, the Neon `postgresql://` link |
| `JWT_COOKIE_SECURE` | `true` on the live site (HTTPS) |
| `PROXY_COUNT` | `1` on Render, so rate limits see each visitor's real IP |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in. The button stays hidden until both are set |
| `GOOGLE_REDIRECT_URI` | Live site only: `https://<your-site>/auth/google/callback` |
| `FRONTEND_URL` | Locally only: `http://localhost:3000`, where Google sign-in sends you back |
| `GEMINI_API_KEY`, `GEMINI_MODELS` | The AI coach and cover letters. A free key comes from [Google AI Studio](https://aistudio.google.com) |
| `AI_DAILY_LIMIT`, `AI_USER_DAILY_LIMIT` | AI uses per day for the whole site and per user (40 and 10) |
| `JSEARCH_API_KEY`, `APIFY_TOKEN`, `JOOBLE_API_KEY`, `THEIRSTACK_API_KEY`, `HIMALAYAS_API_KEY`, `ADZUNA_APP_ID`, `ADZUNA_APP_KEY`, `CAREERJET_API_KEY` | Job sources. Any you leave out are just skipped |
| `JOB_LIMIT_<SOURCE>`, `JOB_SOURCES_DISABLED`, `JOB_SEARCH_USER_DAILY_LIMIT` | Daily caps per source and per user, and free sources to turn off |
| `CACHE_KEEP_DAYS`, `DATABASE_LIMIT_MB` | How long cached jobs are kept (7 days), and the database limit shown to the admin (1024 MB) |
| `CORS_ORIGINS` | Only needed when the frontend runs on another address, like `npm start` |
| `JWT_ACCESS_MINUTES`, `JWT_REFRESH_DAYS`, `AUTH_RATE_LIMIT`, `CLIENT_ERROR_RATE_LIMIT`, `RATELIMIT_STORAGE_URI` | Session length and rate limits. The defaults are fine |
| `PRELOAD_MODELS`, `GUNICORN_THREADS`, `UPLOAD_FOLDER`, `FLASK_DEBUG`, `FLASK_HOST`, `FLASK_PORT` | Server details. The defaults are fine |

**frontend/.env**

| Name | What it's for |
| --- | --- |
| `REACT_APP_API_URL` | The backend address. With `npm start` it defaults to `http://localhost:5000`; the live build uses its own address |

Anything in the frontend `.env` ends up in public JavaScript, so never put secrets there.

---

## How the live site is set up

The live site is one Docker container on Render, with the database on Neon. Flask serves both the React pages and the API from the same address, which keeps the login cookies simple and safe.

- **`Dockerfile`:**
  - builds the React app, with no source maps and no inline scripts so the security policy can block them;
  - installs the Python backend;
  - updates the database tables;
  - starts Gunicorn.
- **`backend/gunicorn.conf.py`:** one worker with 8 threads, so the models fit in Render's free 512 MB. It allows 180 seconds for slow AI answers.
- **Resume PDFs** are stored in the database, because Render wipes its disk on every restart.

To set up your own copy:
1. Create a free PostgreSQL database on [Neon](https://neon.tech) and copy its connection link.
2. On [Render](https://render.com), create a **Web Service** from this repo, with **Docker** and the **Free** plan.
3. Under **Environment**, add:
   - `DATABASE_URL`, `JWT_SECRET_KEY`, `JWT_COOKIE_SECURE=true` and `PROXY_COUNT=1`;
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `CONTACT_EMAIL`;
   - any API keys you use.
4. Deploy. Every push to `master` redeploys, and database changes run automatically.
5. Optional: point a free uptime monitor at `/health` every 5 minutes so the site doesn't fall asleep.

### Google sign-in

The server talks to Google directly (OpenID Connect with PKCE), so no extra package is needed.

1. In [Google Cloud Console](https://console.cloud.google.com), create a project and open **Google Auth Platform**.
2. **Branding:** app name, support email, your home page and `/privacy` page. Skip the logo; a logo means Google has to review the app.
3. **Audience:** External, then **Publish app** so anyone can sign in.
4. **Clients → Create client → Web application.** Add these redirect URIs:
   - `https://<your-site>/auth/google/callback`
   - `http://localhost:5000/auth/google/callback`
5. Put the client ID and secret into `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`.

If a Google email matches an existing account, it signs into that account; otherwise a new account is made, and the person is asked for their date of birth once. The admin can't use Google, and always signs in with email, password and the authenticator code.

### Backups

`.github/workflows/backup.yml` backs up the live database every Sunday:
- It encrypts the dump with AES-256 and keeps it on GitHub for 30 days.
- It needs two repository secrets: `DATABASE_URL` and `BACKUP_PASSPHRASE` (a long random phrase).
- To check it works, run it once by hand from the Actions tab.

To restore one:

```bash
gpg --decrypt skilllens-YYYY-MM-DD.dump.gpg > skilllens.dump
pg_restore --clean --if-exists --no-owner --dbname "NEON_LINK" skilllens.dump
```

---

## The admin account

There is one sign-in page for everyone:
- Signing in with `ADMIN_EMAIL` and `ADMIN_PASSWORD` opens the admin dashboard. Every other email is a normal user, and nobody can sign up with the admin email.
- The admin account is created on its first sign-in, so it works on a fresh database with no setup script.
- Changing `ADMIN_PASSWORD` takes effect the next time the admin signs in.
- The server log shows one line saying whether admin sign-in is on, without showing the email or password.

From a user's details, the admin can:
- **Block sign-in.** The person is signed out everywhere straight away and can't sign in until unblocked. Their data stays.
- **Reset the password.** There's no email service, so this shows a temporary password once for the admin to send privately. Old sessions stop working.
- **Delete the account,** with all of that person's data.

---

## Project structure

```
SkillLens/
  Dockerfile                    Builds React, then serves it and the API with Gunicorn
  .github/workflows/ci.yml      Tests, lint, build and Docker build on every push
  .github/workflows/backup.yml  Weekly encrypted database backup
  .github/dependabot.yml        Pull requests for package updates
  LICENSE
  backend/
    app.py                      Entry point
    gunicorn.conf.py            Production server settings
    skilllens/
      config.py                 Settings from environment variables
      headers.py                Security headers
      security.py               Who can open what (users vs admin)
      schemas.py                Checks every request
      cli.py                    The commands listed above
      routes/                   The API endpoints
      services/                 The real work: resumes, AI, jobs, admin, accounts, two-factor,
                                Google sign-in, error log, usage, cleanup
    models/
      salary_model.py           The salary models (training and prediction)
      resume_analyzer.py        Resume reading and ATS scoring
      jd_matcher.py             Resume vs job description
      job_market.py             What postings for a role ask for
      skills_taxonomy.py        870 skills with their spellings
      resume_checks.py          Recruiter checks
      database.py               Database tables
    migrations/                 Database changes over time
    data/                       Cleaned postings and company career pages
    tests/                      Backend tests
  frontend/
    src/
      pages/                    Landing, sign-in, dashboard, salary, resume, jobs, profile, admin, privacy
      components/               Landing sections, resume tools, salary tools, admin panels, UI pieces
      api.js                    Talks to the backend (cookies, CSRF, token refresh)
```

---

## License

My code is under the MIT License. The bundled dataset (`backend/data/india_jobs.csv.gz`) and the model trained on it (`backend/models/india_salary_model.pkl`) come from data licensed CC BY-NC-SA 4.0, so they can only be used non-commercially, with credit, under the same licence.

---

## Thanks to

- [Indian Job Market Dataset 2025](https://www.kaggle.com/datasets/shivamshrivastava21/indian-job-market-dataset-2025-2026) by Shivam Shrivastava (CC BY-NC-SA 4.0), mirrored by [JasobantaParida/Indian-Job-Market-Intelligence](https://github.com/JasobantaParida/Indian-Job-Market-Intelligence)
- Google Gemini and all the job sources listed above
- React, Tailwind CSS, Framer Motion, Flask and scikit-learn
