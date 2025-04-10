# IT Career Navigator

> An AI-powered full-stack career guidance platform that predicts salaries, recommends jobs, and analyzes resumes with advanced NLP models like spaCy.

![React](https://img.shields.io/badge/frontend-React-blue?style=flat&logo=react)
![Flask](https://img.shields.io/badge/backend-Flask-green?style=flat&logo=flask)
![Python](https://img.shields.io/badge/ML-Python-yellow?style=flat&logo=python)
![License](https://img.shields.io/badge/license-MIT-blue)

---

## 📌 Features

- 🧠 **Salary Predictor** — Predicts estimated salary using an ML model trained on the `ds_salaries.csv` Kaggle dataset.
- 💼 **Job Recommender** — Coming soon: AI-powered job matching based on resume skills.
- 📄 **Resume Analyzer** — Extracts skills from uploaded resumes using spaCy; calculates resume score based on industry keywords.
- 🛡️ **JWT Auth** — Login/Register functionality with role-based access for Admin and Users.
- 👨‍💻 **Admin Panel** — View/delete users and get real-time stats.
- 🌙 **Dark Mode** toggle and responsive UI built with Tailwind CSS and Framer Motion.

---


## 🛠️ Tech Stack

**Frontend**:
- React
- Tailwind CSS
- Framer Motion
- Axios

**Backend**:
- Flask + Flask-JWT-Extended + SQLAlchemy
- SQLite (development DB)
- Bcrypt for password hashing
- spaCy for NLP

**ML Models**:
- Trained Regression model using RandomForestRegressor
- Preprocessing with LabelEncoder & OneHotEncoder

---

## 🧠 Resume Scoring Logic

- Extract skills from PDF using spaCy
- Match against a predefined list of 40+ top tech skills
- Assign scores based on matches
- Store resume file, score, and extracted skills in database

---

## 🏁 How to Run

### 1. Clone the Repository
```bash
git clone https://github.com/yourusername/it-career-navigator.git
cd it-career-navigator
```

### 2. Backend Setup
```bash
cd backend
pip install -r requirements.txt
python app.py  # will run on http://127.0.0.1:5000
```

### 3. Frontend Setup
```bash
cd frontend
npm install
npm start  # will run on http://localhost:3000
```

---

## 🧪 Sample Admin Credentials

- Email: `your_admin_email_here`
- Password: `your_admin_password_here`

Only the admin can access `/admin` dashboard and delete users.

---

## 📂 Directory Structure

```
📦 it-career-navigator/
 ┣ 📁 backend/
 ┃ ┣ 📁 models/
 ┃ ┣ 📁 uploaded_resumes/
 ┃ ┣ 📜 app.py
 ┃ ┣ 📜 salary_model.pkl
 ┃ ┗ 📜 transformers.pkl
 ┣ 📁 frontend/
 ┃ ┣ 📁 src/pages/
 ┃ ┣ 📁 public/
 ┃ ┗ 📜 App.js
 ┗ 📜 README.md
```

---

## 📈 Project Stats

- 🔐 Auth-protected routes with JWT
- 📁 100% resume uploads stored with timestamp and score
- 📊 Trained on 6,000+ salary data points
- 📦 ~20MB PDF storage and NLP processing optimized

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

## 🙌 Acknowledgements

- Dataset from [Kaggle - DS Salaries](https://www.kaggle.com/datasets/ruchi798/data-science-job-salaries)
- spaCy for NLP
- React + Tailwind + Flask ❤️

---

## 💬 Feedback & Contributions

Pull requests and feedback welcome! Let’s grow this into a full-fledged career platform together 