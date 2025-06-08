#!/usr/bin/env python3
"""
Script to create HR user in the database
"""
import sqlite3
import os
from werkzeug.security import generate_password_hash
from datetime import datetime

def create_hr_user():
    db_path = 'instance/salary_predictor.db'
    
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found!")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        # HR credentials
        hr_email = "hr.itcareer@gmail.com"
        hr_password = "hritcareer"
        hr_name = "HR Manager"
        
        # Check if HR user already exists
        cursor.execute("SELECT id FROM users WHERE email = ?", (hr_email,))
        existing_hr = cursor.fetchone()
        
        if existing_hr:
            print(f"HR user {hr_email} already exists!")
            return True
        
        # Hash the password
        hashed_password = generate_password_hash(hr_password, method='pbkdf2:sha256')
        
        # Insert HR user
        cursor.execute("""
            INSERT INTO users (
                email, password, full_name, is_admin, 
                created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        """, (
            hr_email,
            hashed_password,
            hr_name,
            True,  # HR is admin
            datetime.now(),
            datetime.now()
        ))
        
        conn.commit()
        print(f"✅ HR user created successfully!")
        print(f"Email: {hr_email}")
        print(f"Password: {hr_password}")
        
        return True
        
    except Exception as e:
        print(f"Error creating HR user: {str(e)}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    success = create_hr_user()
    if success:
        print("\n🎉 HR user setup completed!")
    else:
        print("\n❌ HR user setup failed!") 