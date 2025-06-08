#!/usr/bin/env python3
"""
Database Migration Script - Add Professional Profile Fields
Adds new columns to User and ProfileHistory tables for enhanced profile features.
"""

import sqlite3
import logging
from datetime import datetime

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def migrate_database(db_path='instance/salary_predictor.db'):
    """
    Migrate the database by adding new professional fields to User and ProfileHistory tables.
    """
    try:
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        logger.info("Starting database migration...")
        
        # Check if migration has already been done
        cursor.execute("PRAGMA table_info(users)")
        columns = [column[1] for column in cursor.fetchall()]
        
        if 'current_work' in columns:
            logger.info("Migration already completed. Skipping...")
            return True
        
        # Add new columns to users table
        new_user_columns = [
            'current_work TEXT',
            'current_company TEXT', 
            'current_location TEXT',
            'total_experience REAL',
            'linkedin_url TEXT',
            'website_url TEXT',
            'bio TEXT'
        ]
        
        logger.info("Adding new columns to users table...")
        for column in new_user_columns:
            try:
                cursor.execute(f"ALTER TABLE users ADD COLUMN {column}")
                logger.info(f"Added column: {column}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e).lower():
                    logger.info(f"Column {column.split()[0]} already exists, skipping...")
                else:
                    raise e
        
        # Add new columns to profile_history table
        new_history_columns = [
            'current_work TEXT',
            'current_company TEXT',
            'current_location TEXT', 
            'total_experience REAL',
            'linkedin_url TEXT',
            'website_url TEXT',
            'bio TEXT'
        ]
        
        logger.info("Adding new columns to profile_history table...")
        for column in new_history_columns:
            try:
                cursor.execute(f"ALTER TABLE profile_history ADD COLUMN {column}")
                logger.info(f"Added column: {column}")
            except sqlite3.OperationalError as e:
                if "duplicate column name" in str(e).lower():
                    logger.info(f"Column {column.split()[0]} already exists, skipping...")
                else:
                    raise e
        
        # Commit changes
        conn.commit()
        logger.info("Database migration completed successfully!")
        
        # Verify migration
        cursor.execute("PRAGMA table_info(users)")
        user_columns = [column[1] for column in cursor.fetchall()]
        logger.info(f"Users table columns: {user_columns}")
        
        cursor.execute("PRAGMA table_info(profile_history)")
        history_columns = [column[1] for column in cursor.fetchall()]
        logger.info(f"Profile history table columns: {history_columns}")
        
        return True
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        if conn:
            conn.rollback()
        return False
        
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    success = migrate_database()
    if success:
        print("✅ Database migration completed successfully!")
    else:
        print("❌ Database migration failed!")
        exit(1) 