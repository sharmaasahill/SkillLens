#!/usr/bin/env python3
"""
Database migration script to add new profile fields
"""
import sqlite3
import os

def migrate_database():
    db_path = 'instance/salary_predictor.db'
    
    # Check if database exists
    if not os.path.exists(db_path):
        print(f"Database {db_path} not found. Please create the database first.")
        return False
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    try:
        print("Starting migration to add new profile fields...")
        
        # List of new columns to add to users table
        user_columns = [
            ('profile_resume_filename', 'VARCHAR(255)'),
            ('profile_resume_uploaded_at', 'DATETIME'),
            ('skills_summary', 'TEXT'),
            ('education', 'VARCHAR(300)'),
            ('certifications', 'TEXT'),
            ('languages', 'VARCHAR(200)'),
            ('achievements', 'TEXT')
        ]
        
        # List of new columns to add to profile_history table
        history_columns = [
            ('profile_resume_filename', 'VARCHAR(255)'),
            ('skills_summary', 'TEXT'),
            ('education', 'VARCHAR(300)'),
            ('certifications', 'TEXT'),
            ('languages', 'VARCHAR(200)'),
            ('achievements', 'TEXT')
        ]
        
        # Check existing columns in users table
        cursor.execute("PRAGMA table_info(users)")
        existing_user_columns = [column[1] for column in cursor.fetchall()]
        
        # Add new columns to users table
        for column_name, column_type in user_columns:
            if column_name not in existing_user_columns:
                query = f"ALTER TABLE users ADD COLUMN {column_name} {column_type}"
                cursor.execute(query)
                print(f"Added column '{column_name}' to users table")
            else:
                print(f"Column '{column_name}' already exists in users table")
        
        # Check existing columns in profile_history table
        cursor.execute("PRAGMA table_info(profile_history)")
        existing_history_columns = [column[1] for column in cursor.fetchall()]
        
        # Add new columns to profile_history table
        for column_name, column_type in history_columns:
            if column_name not in existing_history_columns:
                query = f"ALTER TABLE profile_history ADD COLUMN {column_name} {column_type}"
                cursor.execute(query)
                print(f"Added column '{column_name}' to profile_history table")
            else:
                print(f"Column '{column_name}' already exists in profile_history table")
        
        conn.commit()
        print("Migration completed successfully!")
        
        # Verify the migration
        cursor.execute("PRAGMA table_info(users)")
        user_columns = cursor.fetchall()
        print(f"\nUsers table now has {len(user_columns)} columns:")
        for col in user_columns:
            print(f"  - {col[1]} ({col[2]})")
        
        cursor.execute("PRAGMA table_info(profile_history)")
        history_columns = cursor.fetchall()
        print(f"\nProfile_history table now has {len(history_columns)} columns:")
        for col in history_columns:
            print(f"  - {col[1]} ({col[2]})")
        
        return True
        
    except Exception as e:
        print(f"Migration failed: {str(e)}")
        conn.rollback()
        return False
    finally:
        conn.close()

if __name__ == "__main__":
    success = migrate_database()
    if success:
        print("\n✅ Database migration completed successfully!")
    else:
        print("\n❌ Database migration failed!") 