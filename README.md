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
- **JWT Auth** - Login/register with separate User and HR roles.
- **Job Recommender** - Matches skills from your latest resume against a Glassdoor job listings dataset using TF-IDF similarity, with experience fit, match reasoning and a skills-gap analysis.
- Dark mode (saved per browser) and responsive UI built with Tailwind CSS, Framer Motion and Heroicons.

---

## Tech Stack

**Frontend**
- React 19, React Router
- Tailwind CSS
- Framer Motion
- Axios

**Backend**
- Flask, Flask-JWT-Extended, Flask-SQLAlchemy, Flask-CORS
- SQLite
- PyPDF2 for PDF text extraction

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
pip install -r requirements.txt
cp .env.example .env           # then edit .env (JWT_SECRET_KEY, HR_EMAIL, HR_PASSWORD)
python create_hr_user.py       # one-time: creates tables and the HR account
python app.py
```

Run backend commands from inside the `backend` folder; model and data paths are relative to it.

### 2. Frontend (http://localhost:3000)

In a second terminal:

```bash
cd frontend
npm install
cp .env.example .env           # optional: change REACT_APP_API_URL
npm start
```

---

## Configuration

All settings come from environment files that are excluded from git. Copy the `.env.example` files and fill in your own values.

**backend/.env**

| Variable | Purpose |
| --- | --- |
| `JWT_SECRET_KEY` | Required. Signs login tokens. Generate with `python -c "import secrets; print(secrets.token_hex(32))"` |
| `DATABASE_URL` | SQLAlchemy URL, defaults to SQLite in `backend/instance/` |
| `CORS_ORIGINS` | Comma-separated frontend origins allowed to call the API |
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

## HR Account

`python create_hr_user.py` creates (or resets) the HR account using `HR_EMAIL` and `HR_PASSWORD` from `backend/.env`. Sign in with it via "Login as HR". Regular users can register from the login page.

---

## Directory Structure

```
SkillLens/
  backend/
    app.py                  Flask API and routes
    create_hr_user.py       Creates/updates the HR account
    requirements.txt
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
      config.js             Reads REACT_APP_API_URL
      components/           Shared UI (theme toggle)
      contexts/             Theme state
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
