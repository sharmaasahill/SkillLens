import os
import logging
import json
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_bcrypt import Bcrypt
from flask_jwt_extended import JWTManager, create_access_token, jwt_required, get_jwt_identity
from werkzeug.security import generate_password_hash, check_password_hash
from werkzeug.utils import secure_filename
import PyPDF2
import re

# Import models
from models.database import db, User, Resume, ProfileHistory

# Resume Analysis Import
from models.resume_analyzer import extract_skills_from_resume

# -------------------------------------
# 🔧 Configuration
# -------------------------------------
app = Flask(__name__, static_folder="build", static_url_path="")
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure upload folder
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'uploaded_resumes')
if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)
    logging.info(f"Created upload directory at: {UPLOAD_FOLDER}")

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size
app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///salary_predictor.db'
app.config['JWT_SECRET_KEY'] = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-here')
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(days=1)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize extensions
db.init_app(app)
bcrypt = Bcrypt(app)
jwt = JWTManager(app)

ADMIN_EMAIL = "anupamharsh2002@gmail.com"

# -------------------------------------
# 🔐 Authentication Routes
# -------------------------------------
@app.route("/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
        email = data.get("email")
        password = data.get("password")
        full_name = data.get("full_name")

        if not all([email, password, full_name]):
            return jsonify({'message': 'Missing required fields'}), 400

        # Check if user already exists
        if User.query.filter_by(email=email).first():
            return jsonify({'message': 'Email already registered'}), 400

        # Create new user
        hashed_password = generate_password_hash(password, method='pbkdf2:sha256')
        new_user = User(
            email=email,
            password=hashed_password,
            full_name=full_name,
            is_admin=False  # Regular users are not admin by default
        )

        db.session.add(new_user)
        db.session.commit()

        # Create token for immediate login
        access_token = create_access_token(identity=email)
        return jsonify({
            'message': 'Registration successful',
            'token': access_token,
            'email': email,
            'is_admin': False
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'message': str(e)}), 500

@app.route('/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({'message': 'Missing email or password'}), 400

        user = User.query.filter_by(email=email).first()
        
        if not user or not check_password_hash(user.password, password):
            return jsonify({'message': 'Invalid email or password'}), 401

        access_token = create_access_token(identity=email)
        return jsonify({
            'token': access_token,
            'email': email,
            'is_admin': user.is_admin
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/profile', methods=['GET'])
@jwt_required()
def profile():
    try:
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()
        
        if not user:
            return jsonify({'message': 'User not found'}), 404

        return jsonify({
            'email': user.email,
            'full_name': user.full_name,
            'phone_number': user.phone_number,
            'address': user.address,
            'age': user.age,
            'current_work': user.current_work,
            'current_company': user.current_company,
            'current_location': user.current_location,
            'total_experience': user.total_experience,
            'linkedin_url': user.linkedin_url,
            'website_url': user.website_url,
            'bio': user.bio,
            'profile_resume_filename': user.profile_resume_filename,
            'profile_resume_uploaded_at': user.profile_resume_uploaded_at.isoformat() if user.profile_resume_uploaded_at else None,
            'skills_summary': user.skills_summary,
            'education': user.education,
            'certifications': user.certifications,
            'languages': user.languages,
            'achievements': user.achievements,
            'is_admin': user.is_admin
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/profile/history', methods=['GET'])
@jwt_required()
def profile_history():
    try:
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()

        if not user:
            return jsonify({'message': 'User not found'}), 404

        history = ProfileHistory.query.filter_by(user_id=user.id).order_by(ProfileHistory.changed_at.desc()).all()
        
        return jsonify({
            'history': [{
                'full_name': h.full_name,
                'phone_number': h.phone_number,
                'address': h.address,
                'age': h.age,
                'current_work': h.current_work,
                'current_company': h.current_company,
                'current_location': h.current_location,
                'total_experience': h.total_experience,
                'linkedin_url': h.linkedin_url,
                'website_url': h.website_url,
                'bio': h.bio,
                'changed_at': h.changed_at.isoformat()
            } for h in history]
        }), 200

    except Exception as e:
        return jsonify({'message': str(e)}), 500

@app.route('/update-profile', methods=['PUT', 'POST'])
@jwt_required()
def update_profile():
    try:
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404

        data = request.get_json()
        
        # Create profile history entry before updating
        history = ProfileHistory(
            user_id=user.id,
            full_name=user.full_name,
            phone_number=user.phone_number,
            address=user.address,
            age=user.age,
            current_work=user.current_work,
            current_company=user.current_company,
            current_location=user.current_location,
            total_experience=user.total_experience,
            linkedin_url=user.linkedin_url,
            website_url=user.website_url,
            bio=user.bio,
            profile_resume_filename=user.profile_resume_filename,
            skills_summary=user.skills_summary,
            education=user.education,
            certifications=user.certifications,
            languages=user.languages,
            achievements=user.achievements
        )
        db.session.add(history)

        # Update user profile with all fields
        if 'full_name' in data and data['full_name'] is not None:
            user.full_name = data['full_name'].strip() if data['full_name'] else None
        if 'phone_number' in data and data['phone_number'] is not None:
            user.phone_number = data['phone_number'].strip() if data['phone_number'] else None
        if 'address' in data and data['address'] is not None:
            user.address = data['address'].strip() if data['address'] else None
        if 'age' in data and data['age'] is not None:
            user.age = int(data['age']) if str(data['age']).isdigit() else None
        if 'current_work' in data and data['current_work'] is not None:
            user.current_work = data['current_work'].strip() if data['current_work'] else None
        if 'current_company' in data and data['current_company'] is not None:
            user.current_company = data['current_company'].strip() if data['current_company'] else None
        if 'current_location' in data and data['current_location'] is not None:
            user.current_location = data['current_location'].strip() if data['current_location'] else None
        if 'total_experience' in data and data['total_experience'] is not None:
            user.total_experience = float(data['total_experience']) if str(data['total_experience']).replace('.', '').isdigit() else None
        if 'linkedin_url' in data and data['linkedin_url'] is not None:
            user.linkedin_url = data['linkedin_url'].strip() if data['linkedin_url'] else None
        if 'website_url' in data and data['website_url'] is not None:
            user.website_url = data['website_url'].strip() if data['website_url'] else None
        if 'bio' in data and data['bio'] is not None:
            user.bio = data['bio'].strip() if data['bio'] else None
        # Update new profile fields
        if 'skills_summary' in data and data['skills_summary'] is not None:
            user.skills_summary = data['skills_summary'].strip() if data['skills_summary'] else None
        if 'education' in data and data['education'] is not None:
            user.education = data['education'].strip() if data['education'] else None
        if 'certifications' in data and data['certifications'] is not None:
            user.certifications = data['certifications'].strip() if data['certifications'] else None
        if 'languages' in data and data['languages'] is not None:
            user.languages = data['languages'].strip() if data['languages'] else None
        if 'achievements' in data and data['achievements'] is not None:
            user.achievements = data['achievements'].strip() if data['achievements'] else None

        db.session.commit()

        return jsonify({
            'message': 'Profile updated successfully',
            'user': {
                'email': user.email,
                'full_name': user.full_name,
                'phone_number': user.phone_number,
                'address': user.address,
                'age': user.age,
                'current_work': user.current_work,
                'current_company': user.current_company,
                'current_location': user.current_location,
                'total_experience': user.total_experience,
                'linkedin_url': user.linkedin_url,
                'website_url': user.website_url,
                'bio': user.bio,
                'is_admin': user.is_admin
            }
        }), 200

    except ValueError as ve:
        return jsonify({'error': 'Invalid data format'}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error updating profile: {str(e)}")
        return jsonify({'error': 'Failed to update profile'}), 500

@app.route('/profile/upload-resume', methods=['POST'])
@jwt_required()
def upload_profile_resume():
    try:
        logger.info("Received profile resume upload request")
        
        if 'file' not in request.files:
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No selected file'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            return jsonify({'error': 'Only PDF files are allowed'}), 400

        # Get current user
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()
        
        if not user:
            return jsonify({'error': 'User not found'}), 404

        try:
            # Create profile resumes directory
            profile_resume_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'profile_resumes')
            if not os.path.exists(profile_resume_folder):
                os.makedirs(profile_resume_folder)

            # Generate unique filename for profile resume
            timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
            filename = f"profile_{user.id}_{timestamp}_{secure_filename(file.filename)}"
            file_path = os.path.join(profile_resume_folder, filename)
            
            # Remove old profile resume file if exists
            if user.profile_resume_filename:
                old_file_path = os.path.join(profile_resume_folder, user.profile_resume_filename)
                if os.path.exists(old_file_path):
                    try:
                        os.remove(old_file_path)
                        logger.info(f"Removed old profile resume: {old_file_path}")
                    except Exception as e:
                        logger.warning(f"Could not remove old profile resume: {str(e)}")

            # Save new file
            file.seek(0)
            file.save(file_path)
            logger.info(f"Saved profile resume to: {file_path}")

            # Analyze the resume for skills extraction
            try:
                analysis_result = extract_skills_from_resume(file_path)
                skills_list = analysis_result.get('skills', [])
                if isinstance(skills_list, list) and skills_list:
                    skills_summary = ', '.join(skills_list[:10])  # Top 10 skills
                else:
                    skills_summary = "Skills analysis in progress"
            except Exception as e:
                logger.warning(f"Resume analysis failed: {str(e)}")
                skills_summary = "Skills analysis failed"

            # Update user profile with resume info
            user.profile_resume_filename = filename
            user.profile_resume_uploaded_at = datetime.now()
            if not user.skills_summary:  # Only update if not manually set
                user.skills_summary = skills_summary
            
            db.session.commit()
            logger.info("Successfully updated user profile with resume info")

            return jsonify({
                'message': 'Profile resume uploaded successfully',
                'filename': filename,
                'skills_summary': skills_summary,
                'uploaded_at': user.profile_resume_uploaded_at.isoformat()
            }), 200

        except Exception as e:
            logger.error(f"Error processing profile resume: {str(e)}")
            # Clean up the file if it was saved
            if 'file_path' in locals() and os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({'error': 'Failed to process the resume file'}), 500

    except Exception as e:
        logger.error(f"Error in upload_profile_resume: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/profile/download-resume', methods=['GET'])
@jwt_required()
def download_profile_resume():
    try:
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if not user.profile_resume_filename:
            return jsonify({'error': 'No profile resume found'}), 404
        
        profile_resume_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'profile_resumes')
        file_path = os.path.join(profile_resume_folder, user.profile_resume_filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'Resume file not found'}), 404
        
        return send_from_directory(profile_resume_folder, user.profile_resume_filename, as_attachment=True)
        
    except Exception as e:
        logger.error(f"Error in download_profile_resume: {str(e)}")
        return jsonify({'error': 'Failed to download resume'}), 500

# -------------------------------------
# 👔 HR Routes
# -------------------------------------
@app.route('/hr/all-users', methods=['GET'])
@jwt_required()
def hr_get_all_users():
    try:
        current_user_email = get_jwt_identity()
        current_user = User.query.filter_by(email=current_user_email).first()
        
        if not current_user or not current_user.is_admin:
            return jsonify({'error': 'Access denied. HR privileges required.'}), 403
        
        # Get query parameters for filtering
        job_role = request.args.get('job_role', '').strip()
        location = request.args.get('location', '').strip()
        min_experience = request.args.get('min_experience', type=float)
        max_experience = request.args.get('max_experience', type=float)
        skills = request.args.get('skills', '').strip()
        min_score = request.args.get('min_score', type=float)
        has_resume = request.args.get('has_resume', '').lower()
        company = request.args.get('company', '').strip()
        
        # Start with base query
        query = User.query.filter(User.is_admin == False)
        
        # Apply filters
        if job_role:
            query = query.filter(User.current_work.ilike(f'%{job_role}%'))
        
        if location:
            query = query.filter(User.current_location.ilike(f'%{location}%'))
        
        if company:
            query = query.filter(User.current_company.ilike(f'%{company}%'))
        
        if min_experience is not None:
            query = query.filter(User.total_experience >= min_experience)
        
        if max_experience is not None:
            query = query.filter(User.total_experience <= max_experience)
        
        if skills:
            query = query.filter(User.skills_summary.ilike(f'%{skills}%'))
        
        if has_resume == 'true':
            query = query.filter(User.profile_resume_filename != None)
        elif has_resume == 'false':
            query = query.filter(User.profile_resume_filename == None)
        
        users = query.all()
        
        # Apply score filter after getting users (since score is in Resume table)
        if min_score is not None:
            filtered_users = []
            for user in users:
                latest_resume = Resume.query.filter_by(user_id=user.id).order_by(Resume.uploaded_at.desc()).first()
                if latest_resume and latest_resume.score and latest_resume.score >= min_score:
                    filtered_users.append(user)
            users = filtered_users
        
        users_data = []
        for user in users:
            # Get resume count for each user
            resume_count = Resume.query.filter_by(user_id=user.id).count()
            
            # Get latest resume score
            latest_resume = Resume.query.filter_by(user_id=user.id).order_by(Resume.uploaded_at.desc()).first()
            latest_score = latest_resume.score if latest_resume else None
            
            # Get all skills from user's resumes
            all_skills = []
            user_resumes = Resume.query.filter_by(user_id=user.id).all()
            for resume in user_resumes:
                skills = resume.get_skills()
                all_skills.extend(skills)
            unique_skills = list(set(all_skills))
            
            user_data = {
                'id': user.id,
                'email': user.email,
                'full_name': user.full_name,
                'phone_number': user.phone_number,
                'address': user.address,
                'age': user.age,
                'current_work': user.current_work,
                'current_company': user.current_company,
                'current_location': user.current_location,
                'total_experience': user.total_experience,
                'linkedin_url': user.linkedin_url,
                'website_url': user.website_url,
                'bio': user.bio,
                'skills_summary': user.skills_summary,
                'education': user.education,
                'certifications': user.certifications,
                'languages': user.languages,
                'achievements': user.achievements,
                'profile_resume_filename': user.profile_resume_filename,
                'profile_resume_uploaded_at': user.profile_resume_uploaded_at.isoformat() if user.profile_resume_uploaded_at else None,
                'created_at': user.created_at.isoformat() if user.created_at else None,
                'resume_count': resume_count,
                'latest_score': latest_score,
                'all_skills': unique_skills[:10],  # Top 10 unique skills
                'updated_at': user.updated_at.isoformat() if user.updated_at else None
            }
            users_data.append(user_data)
        
        return jsonify({
            'users': users_data,
            'total_users': len(users_data)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in hr_get_all_users: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/hr/user/<int:user_id>', methods=['GET'])
@jwt_required()
def hr_get_user_details(user_id):
    try:
        current_user_email = get_jwt_identity()
        current_user = User.query.filter_by(email=current_user_email).first()
        
        if not current_user or not current_user.is_admin:
            return jsonify({'error': 'Access denied. HR privileges required.'}), 403
        
        # Get the specific user
        user = User.query.filter_by(id=user_id, is_admin=False).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Get user's resume history
        resumes = Resume.query.filter_by(user_id=user.id).order_by(Resume.uploaded_at.desc()).all()
        resume_history = []
        for resume in resumes:
            resume_data = {
                'id': resume.id,
                'filename': resume.filename,
                'skills': resume.get_skills(),
                'score': resume.score,
                'uploaded_at': resume.uploaded_at.isoformat() if resume.uploaded_at else None
            }
            resume_history.append(resume_data)
        
        # Get profile history
        profile_changes = ProfileHistory.query.filter_by(user_id=user.id).order_by(ProfileHistory.changed_at.desc()).limit(10).all()
        profile_history = []
        for change in profile_changes:
            profile_history.append({
                'changed_at': change.changed_at.isoformat(),
                'full_name': change.full_name,
                'current_work': change.current_work,
                'current_company': change.current_company
            })
        
        user_details = {
            'id': user.id,
            'email': user.email,
            'full_name': user.full_name,
            'phone_number': user.phone_number,
            'address': user.address,
            'age': user.age,
            'current_work': user.current_work,
            'current_company': user.current_company,
            'current_location': user.current_location,
            'total_experience': user.total_experience,
            'linkedin_url': user.linkedin_url,
            'website_url': user.website_url,
            'bio': user.bio,
            'skills_summary': user.skills_summary,
            'education': user.education,
            'certifications': user.certifications,
            'languages': user.languages,
            'achievements': user.achievements,
            'profile_resume_filename': user.profile_resume_filename,
            'profile_resume_uploaded_at': user.profile_resume_uploaded_at.isoformat() if user.profile_resume_uploaded_at else None,
            'created_at': user.created_at.isoformat() if user.created_at else None,
            'resume_history': resume_history,
            'profile_history': profile_history
        }
        
        return jsonify(user_details), 200
        
    except Exception as e:
        logger.error(f"Error in hr_get_user_details: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/hr/download-profile-resume/<int:user_id>', methods=['GET'])
@jwt_required()
def hr_download_profile_resume(user_id):
    try:
        current_user_email = get_jwt_identity()
        current_user = User.query.filter_by(email=current_user_email).first()
        
        if not current_user or not current_user.is_admin:
            return jsonify({'error': 'Access denied. HR privileges required.'}), 403
        
        # Get the specific user
        user = User.query.filter_by(id=user_id, is_admin=False).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        if not user.profile_resume_filename:
            return jsonify({'error': 'No profile resume found for this user'}), 404
        
        profile_resume_folder = os.path.join(app.config['UPLOAD_FOLDER'], 'profile_resumes')
        file_path = os.path.join(profile_resume_folder, user.profile_resume_filename)
        
        if not os.path.exists(file_path):
            return jsonify({'error': 'Resume file not found'}), 404
        
        return send_from_directory(profile_resume_folder, user.profile_resume_filename, as_attachment=True)
        
    except Exception as e:
        logger.error(f"Error in hr_download_profile_resume: {str(e)}")
        return jsonify({'error': 'Failed to download resume'}), 500

@app.route('/hr/stats', methods=['GET'])
@jwt_required()
def hr_get_stats():
    try:
        current_user_email = get_jwt_identity()
        current_user = User.query.filter_by(email=current_user_email).first()
        
        if not current_user or not current_user.is_admin:
            return jsonify({'error': 'Access denied. HR privileges required.'}), 403
        
        # Calculate statistics
        total_users = User.query.filter(User.is_admin == False).count()
        total_resumes = Resume.query.count()
        users_with_profiles = User.query.filter(
            User.is_admin == False, 
            User.full_name != None
        ).count()
        users_with_resume = User.query.filter(
            User.is_admin == False,
            User.profile_resume_filename != None
        ).count()
        
        # Get average score
        resumes_with_scores = Resume.query.filter(Resume.score != None).all()
        avg_score = sum(r.score for r in resumes_with_scores) / len(resumes_with_scores) if resumes_with_scores else 0

        return jsonify({
            'total_users': total_users,
            'total_resumes': total_resumes,
            'users_with_profiles': users_with_profiles,
            'users_with_resume': users_with_resume,
            'average_score': round(avg_score, 1)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in hr_get_stats: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/hr/job-roles', methods=['GET'])
@jwt_required()
def hr_get_job_roles():
    try:
        current_user_email = get_jwt_identity()
        current_user = User.query.filter_by(email=current_user_email).first()
        
        if not current_user or not current_user.is_admin:
            return jsonify({'error': 'Access denied. HR privileges required.'}), 403
        
        # Get unique job roles
        users = User.query.filter(User.is_admin == False, User.current_work != None).all()
        job_roles = list(set([user.current_work for user in users if user.current_work]))
        job_roles.sort()
        
        return jsonify({'job_roles': job_roles}), 200
        
    except Exception as e:
        logger.error(f"Error in hr_get_job_roles: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/hr/locations', methods=['GET'])
@jwt_required()
def hr_get_locations():
    try:
        current_user_email = get_jwt_identity()
        current_user = User.query.filter_by(email=current_user_email).first()
        
        if not current_user or not current_user.is_admin:
            return jsonify({'error': 'Access denied. HR privileges required.'}), 403
        
        # Get unique locations
        users = User.query.filter(User.is_admin == False, User.current_location != None).all()
        locations = list(set([user.current_location for user in users if user.current_location]))
        locations.sort()
        
        return jsonify({'locations': locations}), 200
        
    except Exception as e:
        logger.error(f"Error in hr_get_locations: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/hr/companies', methods=['GET'])
@jwt_required()
def hr_get_companies():
    try:
        current_user_email = get_jwt_identity()
        current_user = User.query.filter_by(email=current_user_email).first()
        
        if not current_user or not current_user.is_admin:
            return jsonify({'error': 'Access denied. HR privileges required.'}), 403
        
        # Get unique companies
        users = User.query.filter(User.is_admin == False, User.current_company != None).all()
        companies = list(set([user.current_company for user in users if user.current_company]))
        companies.sort()
        
        return jsonify({'companies': companies}), 200
        
    except Exception as e:
        logger.error(f"Error in hr_get_companies: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/hr/skills', methods=['GET'])
@jwt_required()
def hr_get_skills():
    try:
        current_user_email = get_jwt_identity()
        current_user = User.query.filter_by(email=current_user_email).first()
        
        if not current_user or not current_user.is_admin:
            return jsonify({'error': 'Access denied. HR privileges required.'}), 403
        
        # Get all skills from resumes
        resumes = Resume.query.all()
        skill_counts = {}
        
        for resume in resumes:
            skills = resume.get_skills()
            for skill in skills:
                skill_counts[skill] = skill_counts.get(skill, 0) + 1
        
        # Sort skills by frequency
        sorted_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)
        top_skills = [skill[0] for skill in sorted_skills[:50]]  # Top 50 skills
        
        return jsonify({'skills': top_skills}), 200

    except Exception as e:
        logger.error(f"Error in hr_get_skills: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/hr/analytics', methods=['GET'])
@jwt_required()
def hr_get_analytics():
    try:
        current_user_email = get_jwt_identity()
        current_user = User.query.filter_by(email=current_user_email).first()
        
        if not current_user or not current_user.is_admin:
            return jsonify({'error': 'Access denied. HR privileges required.'}), 403
        
        # Job role distribution
        users = User.query.filter(User.is_admin == False).all()
        job_role_counts = {}
        location_counts = {}
        experience_ranges = {'0-2': 0, '3-5': 0, '6-10': 0, '10+': 0}
        
        for user in users:
            # Job roles
            if user.current_work:
                job_role_counts[user.current_work] = job_role_counts.get(user.current_work, 0) + 1
            
            # Locations
            if user.current_location:
                location_counts[user.current_location] = location_counts.get(user.current_location, 0) + 1
            
            # Experience ranges
            if user.total_experience:
                exp = user.total_experience
                if exp <= 2:
                    experience_ranges['0-2'] += 1
                elif exp <= 5:
                    experience_ranges['3-5'] += 1
                elif exp <= 10:
                    experience_ranges['6-10'] += 1
                else:
                    experience_ranges['10+'] += 1
        
        # Top job roles and locations
        top_job_roles = sorted(job_role_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        top_locations = sorted(location_counts.items(), key=lambda x: x[1], reverse=True)[:10]
        
        # Score distribution
        resumes = Resume.query.filter(Resume.score != None).all()
        score_ranges = {'0-40': 0, '41-60': 0, '61-80': 0, '81-100': 0}
        total_scores = []
        
        for resume in resumes:
            score = resume.score
            total_scores.append(score)
            if score <= 40:
                score_ranges['0-40'] += 1
            elif score <= 60:
                score_ranges['41-60'] += 1
            elif score <= 80:
                score_ranges['61-80'] += 1
            else:
                score_ranges['81-100'] += 1
        
        return jsonify({
            'job_role_distribution': dict(top_job_roles),
            'location_distribution': dict(top_locations),
            'experience_distribution': experience_ranges,
            'score_distribution': score_ranges,
            'average_score': sum(total_scores) / len(total_scores) if total_scores else 0,
            'total_candidates': len(users)
        }), 200
        
    except Exception as e:
        logger.error(f"Error in hr_get_analytics: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

# -------------------------------------
# 💰 Salary Prediction Routes
# -------------------------------------
from models.salary_predictor import SalaryPredictor
from models.advanced_salary_predictor import AdvancedSalaryPredictor

@app.route('/predict', methods=['POST'])
@app.route('/predict-salary', methods=['POST'])
def predict_salary():
    """Basic salary prediction using original model"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['age', 'gender', 'education_level', 'job_title', 'years_of_experience']
        missing_fields = [field for field in required_fields if field not in data or data[field] is None]
        
        if missing_fields:
            return jsonify({
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Initialize the basic predictor
        predictor = SalaryPredictor()
        
        # Make prediction
        result = predictor.predict(data)
        
        return jsonify({
            'success': True,
            'model_type': 'Basic Random Forest',
            'predicted_salary': result['predicted_salary'],
            'salary_range': result['salary_range'],
            'input_data': data
        }), 200
        
    except Exception as e:
        logger.error(f"Error in basic salary prediction: {str(e)}")
        return jsonify({
            'error': f'Prediction failed: {str(e)}'
        }), 500

@app.route('/predict-salary-advanced', methods=['POST'])
def predict_salary_advanced():
    """Advanced salary prediction using ensemble model with enhanced features"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['age', 'gender', 'education_level', 'job_title', 'years_of_experience']
        missing_fields = [field for field in required_fields if field not in data or data[field] is None]
        
        if missing_fields:
            return jsonify({
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Initialize the advanced predictor
        predictor = AdvancedSalaryPredictor()
        
        # Make prediction
        result = predictor.predict(data)
        
        return jsonify({
            'success': True,
            'model_type': 'Advanced Ensemble',
            'predicted_salary': result['predicted_salary'],
            'salary_range': result['salary_range'],
            'confidence_interval': result['confidence_interval'],
            'prediction_confidence': result['prediction_confidence'],
            'top_influential_factors': result['top_influential_factors'],
            'model_version': result['model_version'],
            'input_data': data
        }), 200
        
    except Exception as e:
        logger.error(f"Error in advanced salary prediction: {str(e)}")
        return jsonify({
            'error': f'Advanced prediction failed: {str(e)}'
        }), 500

@app.route('/compare-predictions', methods=['POST'])
def compare_predictions():
    """Compare basic and advanced salary predictions side by side"""
    try:
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['age', 'gender', 'education_level', 'job_title', 'years_of_experience']
        missing_fields = [field for field in required_fields if field not in data or data[field] is None]
        
        if missing_fields:
            return jsonify({
                'error': f'Missing required fields: {", ".join(missing_fields)}'
            }), 400
        
        # Initialize both predictors
        basic_predictor = SalaryPredictor()
        advanced_predictor = AdvancedSalaryPredictor()
        
        # Make predictions
        basic_result = basic_predictor.predict(data)
        advanced_result = advanced_predictor.predict(data)
        
        # Calculate difference
        difference = advanced_result['predicted_salary'] - basic_result['predicted_salary']
        difference_pct = (difference / basic_result['predicted_salary']) * 100 if basic_result['predicted_salary'] > 0 else 0
        
        return jsonify({
            'success': True,
            'input_data': data,
            'basic_model': {
                'model_type': 'Basic Random Forest',
                'predicted_salary': basic_result['predicted_salary'],
                'salary_range': basic_result['salary_range']
            },
            'advanced_model': {
                'model_type': 'Advanced Ensemble',
                'predicted_salary': advanced_result['predicted_salary'],
                'salary_range': advanced_result['salary_range'],
                'confidence_interval': advanced_result['confidence_interval'],
                'prediction_confidence': advanced_result['prediction_confidence'],
                'top_influential_factors': advanced_result['top_influential_factors'],
                'model_version': advanced_result['model_version']
            },
            'comparison': {
                'difference': difference,
                'difference_percentage': round(difference_pct, 2),
                'higher_prediction': 'advanced' if difference > 0 else 'basic' if difference < 0 else 'equal'
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error in prediction comparison: {str(e)}")
        return jsonify({
            'error': f'Comparison failed: {str(e)}'
        }), 500

@app.route('/model-info', methods=['GET'])
def get_model_info():
    """Get information about available prediction models"""
    try:
        # Get advanced model info
        advanced_predictor = AdvancedSalaryPredictor()
        advanced_info = advanced_predictor.get_model_info()
        
        return jsonify({
            'success': True,
            'models': {
                'basic': {
                    'name': 'Basic Random Forest',
                    'description': 'Simple Random Forest model with basic preprocessing',
                    'features': ['Age', 'Gender', 'Education Level', 'Job Title', 'Years of Experience'],
                    'capabilities': ['Salary Prediction', 'Salary Range Estimation']
                },
                'advanced': {
                    'name': advanced_info['model_type'],
                    'description': 'Ensemble model with advanced feature engineering and multiple algorithms',
                    'features': advanced_info['feature_names'],
                    'feature_importance': advanced_info['feature_importance'],
                    'capabilities': advanced_info['capabilities'],
                    'models_in_ensemble': advanced_info['models_in_ensemble']
                }
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error getting model info: {str(e)}")
        return jsonify({
            'error': f'Failed to get model information: {str(e)}'
        }), 500

# -------------------------------------
# 📁 Resume Upload Routes
# -------------------------------------
def extract_text_from_pdf(file):
    try:
        # Create a PDF reader object
        pdf_reader = PyPDF2.PdfReader(file)
        
        # Check if the PDF is encrypted
        if pdf_reader.is_encrypted:
            raise ValueError("PDF is encrypted and cannot be read")
        
        # Extract text from each page
        text = ""
        for page in pdf_reader.pages:
            try:
                page_text = page.extract_text()
                if page_text:
                    text += page_text + "\n"
            except Exception as e:
                logging.warning(f"Error extracting text from page: {str(e)}")
                continue
        
        if not text.strip():
            raise ValueError("No text could be extracted from the PDF")
        
        return text
    except Exception as e:
        logging.error(f"Error in extract_text_from_pdf: {str(e)}")
        raise

@app.route('/upload-resume', methods=['POST'])
@jwt_required()
def upload_resume():
    try:
        logger.info("Received resume upload request")
        
        if 'file' not in request.files:
            logger.error("No file part in request")
            return jsonify({'error': 'No file part'}), 400
        
        file = request.files['file']
        if file.filename == '':
            logger.error("No selected file")
            return jsonify({'error': 'No selected file'}), 400
        
        if not file.filename.lower().endswith('.pdf'):
            logger.error(f"Invalid file type: {file.filename}")
            return jsonify({'error': 'Only PDF files are allowed'}), 400

        # Get current user
        current_user_email = get_jwt_identity()
        logger.info(f"Processing upload for user: {current_user_email}")
        
        user = User.query.filter_by(email=current_user_email).first()
        if not user:
            logger.error(f"User not found for email: {current_user_email}")
            return jsonify({'error': 'User not found'}), 404

        try:
            # Save file first to use with the advanced analyzer
            filename = secure_filename(file.filename)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
            
            # Reset file pointer and save file
            file.seek(0)
            file.save(file_path)
            logger.info(f"Saved file to: {file_path}")

            # Use the advanced resume analyzer
            analysis_result = extract_skills_from_resume(file_path)
            logger.info("Successfully completed advanced resume analysis")
            
            # Extract the skills from the analysis result
            if isinstance(analysis_result['skills'], dict):
                # New categorized format - flatten for database storage
                all_skills = []
                for category_skills in analysis_result['skills'].values():
                    all_skills.extend(category_skills)
            else:
                # Old format - already a list
                all_skills = analysis_result['skills']
            
            logger.info(f"Extracted skills: {all_skills}")

            # Create resume record with ATS score
            resume = Resume(
                user_id=user.id,
                filename=filename,
                raw_text=analysis_result.get('text', ''),
                score=analysis_result.get('ats_analysis', {}).get('score', 0),
                uploaded_at=datetime.now(timezone.utc)
            )
            resume.set_skills(all_skills)  # Store flattened skills list
            
            db.session.add(resume)
            db.session.commit()
            logger.info("Successfully created resume record in database")

            # Return the complete analysis result
            return jsonify({
                'message': 'Resume uploaded successfully',
                'skills': analysis_result['skills'],  # Return original format (categorized or list)
                'text': analysis_result.get('text', ''),
                'ats_analysis': analysis_result.get('ats_analysis', {}),
                'filename': filename
            }), 200

        except ValueError as ve:
            logger.error(f"Error processing PDF: {str(ve)}")
            # Clean up the file if it was saved
            if 'file_path' in locals() and os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({'error': str(ve)}), 400
        except Exception as e:
            logger.error(f"Error processing resume: {str(e)}")
            # Clean up the file if it was saved
            if 'file_path' in locals() and os.path.exists(file_path):
                os.remove(file_path)
            return jsonify({'error': 'Failed to process the PDF file'}), 500

    except Exception as e:
        logger.error(f"Error in upload_resume: {str(e)}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/resume-history', methods=['GET'])
@jwt_required()
def resume_history():
    try:
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        resumes = Resume.query.filter_by(user_id=user.id).order_by(Resume.uploaded_at.desc()).all()
        
        return jsonify({
            'resumes': [{
                'id': resume.id,
                'filename': resume.filename,
                'skills': resume.get_skills(),  # Use the new method to get skills
                'score': resume.score or 0,  # Include score field
                'timestamp': resume.uploaded_at.isoformat(),  # Use timestamp for consistency
                'uploaded_at': resume.uploaded_at.isoformat()  # Keep both for compatibility
            } for resume in resumes]
        }), 200
    except Exception as e:
        logger.error(f"Error in resume_history: {str(e)}")
        return jsonify({'error': 'Failed to fetch resume history'}), 500

@app.route('/resume-history/<int:resume_id>', methods=['DELETE'])
@jwt_required()
def delete_resume(resume_id):
    try:
        current_user_email = get_jwt_identity()
        user = User.query.filter_by(email=current_user_email).first()
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Find the resume and ensure it belongs to the current user
        resume = Resume.query.filter_by(id=resume_id, user_id=user.id).first()
        if not resume:
            return jsonify({'error': 'Resume not found or access denied'}), 404
        
        # Delete the file from filesystem if it exists
        filename = resume.filename
        file_path = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        if os.path.exists(file_path):
            try:
                os.remove(file_path)
                logger.info(f"Deleted file: {file_path}")
            except Exception as e:
                logger.warning(f"Failed to delete file {file_path}: {str(e)}")
        
        # Delete the resume record from database
        db.session.delete(resume)
        db.session.commit()
        logger.info(f"Successfully deleted resume {resume_id} for user {user.email}")
        
        return jsonify({'message': 'Resume deleted successfully'}), 200
        
    except Exception as e:
        logger.error(f"Error in delete_resume: {str(e)}")
        return jsonify({'error': 'Failed to delete resume'}), 500

# -------------------------------------
# 🌐 Serve React Frontend
# -------------------------------------
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True)
