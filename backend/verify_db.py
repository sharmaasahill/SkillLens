from app import app, db, User
from werkzeug.security import check_password_hash

def verify_db():
    with app.app_context():
        # Check if database exists
        try:
            # Try to query users table
            users = User.query.all()
            print(f"Found {len(users)} users in database")
            
            # Check specific user
            user = User.query.filter_by(email='anupamharsh2002@gmail.com').first()
            if user:
                print("\nUser found:")
                print(f"Email: {user.email}")
                print(f"Full Name: {user.full_name}")
                print(f"Password Hash: {user.password[:20]}...")
                
                # Test password
                test_password = 'admin123'
                if check_password_hash(user.password, test_password):
                    print("\n✅ Password verification successful!")
                else:
                    print("\n❌ Password verification failed!")
            else:
                print("\n❌ User not found in database!")
                
        except Exception as e:
            print(f"\n❌ Database error: {str(e)}")
            print("Database might not be properly initialized.")

if __name__ == '__main__':
    verify_db() 