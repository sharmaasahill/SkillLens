#!/usr/bin/env python3
"""
Database Creation Script
Creates the database with all tables including new profile fields.
"""

import sqlite3
import logging
import os
from datetime import datetime
from werkzeug.security import generate_password_hash

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def create_database(db_path='instance/salary_predictor.db'):
    """
    Create the database with all required tables including new profile fields.
    """
    try:
        # Create instance directory if it doesn't exist
        os.makedirs(os.path.dirname(db_path), exist_ok=True)
        
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        logger.info("Creating database tables...")
        
        # Create users table with all fields
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                email VARCHAR(120) UNIQUE NOT NULL,
                password VARCHAR(200) NOT NULL,
                full_name VARCHAR(100),
                phone_number VARCHAR(20),
                address VARCHAR(200),
                age INTEGER,
                current_work VARCHAR(150),
                current_company VARCHAR(150),
                current_location VARCHAR(150),
                total_experience REAL,
                linkedin_url VARCHAR(300),
                website_url VARCHAR(300),
                bio TEXT,
                is_admin BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        logger.info("Created users table")
        
        # Create profile_history table with all fields
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS profile_history (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                full_name VARCHAR(100),
                phone_number VARCHAR(20),
                address VARCHAR(200),
                age INTEGER,
                current_work VARCHAR(150),
                current_company VARCHAR(150),
                current_location VARCHAR(150),
                total_experience REAL,
                linkedin_url VARCHAR(300),
                website_url VARCHAR(300),
                bio TEXT,
                changed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        logger.info("Created profile_history table")
        
        # Create resumes table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS resumes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                filename VARCHAR(255) NOT NULL,
                skills TEXT,
                score REAL,
                raw_text TEXT,
                uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id)
            )
        ''')
        logger.info("Created resumes table")
        
        # Create admin user
        admin_email = 'anupamharsh2002@gmail.com'
        admin_password = generate_password_hash('admin123')
        
        cursor.execute('''
            INSERT OR REPLACE INTO users 
            (email, password, full_name, is_admin, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (admin_email, admin_password, 'Admin User', 1, datetime.now(), datetime.now()))
        
        logger.info("Created admin user")
        
        # Commit changes
        conn.commit()
        logger.info("Database created successfully!")
        
        # Verify tables
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = cursor.fetchall()
        logger.info(f"Created tables: {[table[0] for table in tables]}")
        
        # Verify user columns
        cursor.execute("PRAGMA table_info(users)")
        columns = cursor.fetchall()
        logger.info(f"Users table columns: {[col[1] for col in columns]}")
        
        print("✅ Database created successfully!")
        print(f"📍 Database location: {db_path}")
        print("👤 Admin user created:")
        print(f"   Email: {admin_email}")
        print("   Password: admin123")
        
        return True
        
    except Exception as e:
        logger.error(f"Database creation failed: {str(e)}")
        if conn:
            conn.rollback()
        return False
        
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    success = create_database()
    if not success:
        print("❌ Database creation failed!")
        exit(1) 