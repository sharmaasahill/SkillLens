import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import LabelEncoder
from sklearn.ensemble import RandomForestRegressor
import joblib
import os

class SalaryPredictor:
    def __init__(self):
        self.model = None
        self.label_encoders = {}
        self.education_mapping = {
            "High School": 0,
            "Bachelor's": 1,
            "Master's": 2,
            "PhD": 3
        }
        self.model_path = 'models/salary_predictor.pkl'
        self.encoders_path = 'models/label_encoders.pkl'
        self._load_or_train_model()

    def _load_or_train_model(self):
        try:
            if os.path.exists(self.model_path) and os.path.exists(self.encoders_path):
                self.model = joblib.load(self.model_path)
                self.label_encoders = joblib.load(self.encoders_path)
            else:
                self._train_model()
        except Exception as e:
            print(f"Error loading model: {str(e)}")
            self._train_model()

    def _train_model(self):
        # Load and preprocess data
        df = pd.read_csv('models/Salary_Data.csv')
        
        # Drop null values
        df.dropna(inplace=True)
        
        # Reduce job titles with low counts
        job_title_count = df['Job Title'].value_counts()
        job_title_edited = job_title_count[job_title_count <= 25]
        df['Job Title'] = df['Job Title'].apply(lambda x: 'Others' if x in job_title_edited else x)
        
        # Standardize education levels
        df['Education Level'] = df['Education Level'].str.replace("'s Degree", "")
        df['Education Level'] = df['Education Level'].str.replace("phD", "PhD")
        
        # Prepare features
        X = df[['Age', 'Gender', 'Education Level', 'Job Title', 'Years of Experience']]
        y = df['Salary']
        
        # Encode categorical variables
        for col in ['Gender', 'Job Title']:
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col])
            self.label_encoders[col] = le
        
        # Map education level
        X['Education Level'] = X['Education Level'].map(self.education_mapping)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
        
        # Train model
        self.model = RandomForestRegressor(n_estimators=20, random_state=42)
        self.model.fit(X_train, y_train)
        
        # Save model and encoders separately
        os.makedirs('models', exist_ok=True)
        joblib.dump(self.model, self.model_path)
        joblib.dump(self.label_encoders, self.encoders_path)

    def predict(self, data):
        try:
            # Convert input data to DataFrame with proper column names
            input_data = {
                'Age': int(data['age']),
                'Gender': data['gender'],
                'Education Level': data['education_level'],
                'Job Title': data['job_title'],
                'Years of Experience': int(data['years_of_experience'])
            }
            
            # Create DataFrame
            input_df = pd.DataFrame([input_data])
            
            # Encode categorical variables
            for col in ['Gender', 'Job Title']:
                if col in self.label_encoders:
                    # Get the encoder for this column
                    le = self.label_encoders[col]
                    
                    # Handle unseen categories
                    if input_data[col] not in le.classes_:
                        # Add the new category to the encoder
                        le.classes_ = np.append(le.classes_, input_data[col])
                    
                    # Transform the value
                    input_df[col] = le.transform([input_data[col]])[0]
            
            # Map education level
            input_df['Education Level'] = input_df['Education Level'].map(self.education_mapping)
            
            # Ensure all columns are numeric
            for col in input_df.columns:
                input_df[col] = pd.to_numeric(input_df[col], errors='coerce')
            
            # Make prediction
            prediction = self.model.predict(input_df)[0]
            
            # Calculate salary range (±10%)
            salary_range = {
                "min": round(prediction * 0.9),
                "max": round(prediction * 1.1)
            }
            
            return {
                "predicted_salary": round(prediction),
                "salary_range": salary_range
            }
        except Exception as e:
            raise Exception(f"Prediction error: {str(e)}") 