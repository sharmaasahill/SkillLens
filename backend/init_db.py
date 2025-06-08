from app import create_app
from models.database import db, User, ProfileHistory, Resume
from werkzeug.security import generate_password_hash
import json

def init_db():
    app = create_app()
    with app.app_context():
        # Drop all tables
        db.drop_all()
        print("Dropped all tables")

        # Create all tables
        db.create_all()
        print("Created all tables")

        # Create admin user
        admin = User(
            email='anupamharsh2002@gmail.com',
            password=generate_password_hash('admin123'),
            full_name='Admin User',
            is_admin=True
        )
        db.session.add(admin)
        
        try:
            db.session.commit()
            print("Admin user created successfully")
            print("Email: anupamharsh2002@gmail.com")
            print("Password: admin123")
        except Exception as e:
            print(f"Error creating admin user: {str(e)}")
            db.session.rollback()

if __name__ == '__main__':
    init_db() 