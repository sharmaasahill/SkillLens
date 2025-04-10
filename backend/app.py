from flask import Flask, request, jsonify, send_from_directory
from PyPDF2 import PdfReader
import re
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import (
    create_access_token, JWTManager, jwt_required, get_jwt_identity
)
from werkzeug.utils import secure_filename
from models.resume_analyzer import extract_skills_from_resume
import os
import joblib
import pandas as pd
from datetime import datetime
import os
import numpy as np

# -------------------------------------
# 🔧 Configuration
# -------------------------------------
app = Flask(__name__, static_folder="build", static_url_path="")
CORS(app)

app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///users.db'
app.config['JWT_SECRET_KEY'] = 'super-secret-key'  # 🔐 Change in production

db = SQLAlchemy(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

ADMIN_EMAIL = "anupamharsh2002@gmail.com"

# -------------------------------------
# 👤 Database Model
# -------------------------------------
class User(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), unique=True, nullable=False)
    password = db.Column(db.String(256), nullable=False)
    
class Resume(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(150), nullable=False)
    filename = db.Column(db.String(200), nullable=False)
    skills = db.Column(db.Text, nullable=True)
    score = db.Column(db.Float, nullable=True)
    raw_text = db.Column(db.Text, nullable=True)
    uploaded_at = db.Column(db.DateTime, default=datetime.utcnow)

def create_tables():
    with app.app_context():
        db.create_all()

# -------------------------------------
# 🔐 Authentication Routes
# -------------------------------------
@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    email = data["email"]
    password = data["password"]

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "User already exists"}), 409

    hashed_pw = bcrypt.generate_password_hash(password).decode("utf-8")
    new_user = User(email=email, password=hashed_pw)
    db.session.add(new_user)
    db.session.commit()
    print("[DEBUG] Registered:", email)
    return jsonify({"message": "User registered successfully"})

@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    email = data["email"]
    password = data["password"]

    user = User.query.filter_by(email=email).first()
    if user and bcrypt.check_password_hash(user.password, password):
        token = create_access_token(identity=user.email)
        return jsonify({"token": token})

    return jsonify({"error": "Invalid credentials"}), 401

# -------------------------------------
# 🔒 Admin & Protected Routes
# -------------------------------------
@app.route("/profile", methods=["GET"])
@jwt_required()
def profile():
    user_email = get_jwt_identity()
    return jsonify({"message": f"Welcome, {user_email}!"})

@app.route("/users", methods=["GET"])
@jwt_required()
def get_all_users():
    current_user = get_jwt_identity()
    if current_user != ADMIN_EMAIL:
        return jsonify({"error": "Unauthorized"}), 403

    users = User.query.all()
    return jsonify([
        {"id": user.id, "email": user.email, "password": user.password}
        for user in users
    ])

@app.route("/delete-user/<int:user_id>", methods=["DELETE"])
@jwt_required()
def delete_user(user_id):
    current_user = get_jwt_identity()
    if current_user != ADMIN_EMAIL:
        return jsonify({"error": "Unauthorized"}), 403

    user = User.query.get(user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    db.session.delete(user)
    db.session.commit()
    return jsonify({"message": "User deleted"})

@app.route("/user-count", methods=["GET"])
def user_count():
    count = User.query.count()
    return jsonify({"count": count})

# -------------------------------------
# 📊 Advanced Salary Predictor
# -------------------------------------
model = joblib.load('models/salary_predictor.pkl')
expected_features = ['experience_level', 'employment_type', 'job_title', 'company_size', 'remote_ratio']

@app.route('/predict', methods=['POST'])
@jwt_required()
def predict():
    try:
        data = request.get_json()

        for key in expected_features:
            if key not in data:
                return jsonify({"error": f"Missing field: {key}"}), 400

        input_df = pd.DataFrame([data])
        prediction = model.predict(input_df)[0]

        salary_range = {
            "min": round(prediction * 0.9),
            "max": round(prediction * 1.1)
        }

        return jsonify({
            "predicted_salary": round(prediction),
            "salary_range": salary_range
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

# -------------------------------------
# Analyze PDF Resume
# -------------------------------------
# Allow only PDFs
ALLOWED_EXTENSIONS = {'pdf'}
UPLOAD_FOLDER = 'uploaded_resumes'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload-resume', methods=['POST'])
@jwt_required()
def upload_resume():
    user_email = get_jwt_identity()
    file = request.files.get('resume')

    if not file or not allowed_file(file.filename):
        return jsonify({"error": "Invalid file type"}), 400

    filename = secure_filename(file.filename)
    path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(path)

    # Skill & Text Extraction
    skills, full_text = extract_skills_from_resume(path)

    # === Advanced Scoring ===
    final_score = score_resume(skills, full_text)

    # Save to DB
    resume_entry = Resume(
        email=user_email,
        filename=filename,
        skills=",".join(skills),
        score=final_score
    )
    db.session.add(resume_entry)
    db.session.commit()

    return jsonify({
        "filename": filename,
        "skills": skills,
        "raw_text": full_text,
        "score": final_score
    })

    

    
# Resume history
@app.route('/resume-history', methods=['GET'])
@jwt_required()
def resume_history():
    user_email = get_jwt_identity()
    resumes = Resume.query.filter_by(email=user_email).order_by(Resume.uploaded_at.desc()).all()

    return jsonify([
        {
            "id": r.id,
            "filename": r.filename,
            "skills": r.skills,
            "score": r.score,
            "timestamp": r.uploaded_at.strftime("%Y-%m-%d %H:%M")
        } for r in resumes
    ])


# Score Resume
def score_resume(skills, text):
    # --- 1. Skill Relevance (40%) ---
    high_demand_skills = {
        'python', 'sql', 'machine learning', 'deep learning', 'docker', 'aws', 'data analysis',
        'nlp', 'pandas', 'numpy', 'tensorflow', 'spark', 'kubernetes', 'flask', 'react'
    }

    resume_skills = set([s.lower() for s in skills])
    matched = resume_skills & high_demand_skills
    skill_score = (len(matched) / len(high_demand_skills)) * 40

    # --- 2. Text Quality (20%) ---
    avg_sentence_len = np.mean([len(sent.split()) for sent in text.split('.') if sent.strip()])
    keyword_density = sum(word in text.lower() for word in high_demand_skills)

    text_score = 20 if avg_sentence_len > 8 and keyword_density > 3 else 10

    # --- 3. Structure Check (20%) ---
    sections = ['education', 'experience', 'skills', 'projects', 'summary']
    section_score = sum(1 for sec in sections if sec in text.lower())
    structure_score = (section_score / len(sections)) * 20

    # --- 4. Bonus for Good Length (20%) ---
    total_words = len(text.split())
    job_match_score = 20 if total_words > 250 else 10

    final = skill_score + text_score + structure_score + job_match_score
    return int(min(final, 100))


# -------------------------------------
# 🌐 Serve React Frontend
# -------------------------------------
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

# -------------------------------------
# ▶️ Run App
# -------------------------------------
if __name__ == "__main__":
    create_tables()
    app.run(debug=True)
