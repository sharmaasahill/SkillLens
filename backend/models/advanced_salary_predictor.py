import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor, VotingRegressor
from sklearn.linear_model import Ridge
from sklearn.metrics import mean_squared_error, r2_score, mean_absolute_error
import joblib
import os
import warnings
warnings.filterwarnings('ignore')

class AdvancedSalaryPredictor:
    def __init__(self):
        self.models = {}
        self.ensemble_model = None
        self.label_encoders = {}
        self.scaler = StandardScaler()
        self.feature_names = []
        self.feature_importance = {}
        
        # Education level mapping with more granular levels
        self.education_mapping = {
            "High School": 0,
            "Associate": 1,
            "Bachelor": 2,
            "Bachelor's": 2,
            "Master": 3,
            "Master's": 3,
            "MBA": 4,
            "PhD": 5,
            "phD": 5
        }
        
        self.model_paths = {
            'ensemble': 'models/advanced_ensemble_model.pkl',
            'encoders': 'models/advanced_label_encoders.pkl',
            'scaler': 'models/advanced_scaler.pkl',
            'feature_names': 'models/advanced_feature_names.pkl',
            'feature_importance': 'models/advanced_feature_importance.pkl'
        }
        
        self._load_or_train_model()

    def _engineer_features(self, df):
        """Advanced feature engineering"""
        df_engineered = df.copy()
        
        # Experience level categories
        df_engineered['Experience_Level'] = pd.cut(
            df_engineered['Years of Experience'], 
            bins=[-1, 1, 3, 7, 15, float('inf')], 
            labels=['Entry', 'Junior', 'Mid', 'Senior', 'Executive']
        ).astype(str)
        
        # Age groups
        df_engineered['Age_Group'] = pd.cut(
            df_engineered['Age'], 
            bins=[0, 25, 30, 35, 45, float('inf')], 
            labels=['Young', 'Early Career', 'Mid Career', 'Experienced', 'Senior']
                ).astype(str)
        
        # Experience to age ratio (handle division by zero and NaN)
        df_engineered['Experience_Age_Ratio'] = np.where(
            df_engineered['Age'] > 0,
            df_engineered['Years of Experience'] / df_engineered['Age'],
            0
        )
        # Handle any remaining NaN values
        df_engineered['Experience_Age_Ratio'].fillna(0, inplace=True)
        
        # Job title categories
        tech_roles = ['Software Engineer', 'Data Scientist', 'Software Engineer Manager', 
                      'Data Analyst', 'Full Stack Engineer', 'Back end Developer', 
                      'Front end Developer', 'Senior Software Engineer']
        management_roles = ['Product Manager', 'Marketing Manager', 'Financial Manager', 
                           'Project Manager', 'Operations Manager']
        
        df_engineered['Job_Category'] = df_engineered['Job Title'].apply(
            lambda x: 'Tech' if x in tech_roles else 'Management' if x in management_roles else 'Other'
        )
        
        # Seniority indicator from job title
        df_engineered['Is_Senior'] = df_engineered['Job Title'].str.contains('Senior|Manager|Director|VP|Lead', case=False).astype(int)
        
        return df_engineered

    def _load_or_train_model(self):
        """Load existing model or train a new one"""
        try:
            if all(os.path.exists(path) for path in self.model_paths.values()):
                self.ensemble_model = joblib.load(self.model_paths['ensemble'])
                self.label_encoders = joblib.load(self.model_paths['encoders'])
                self.scaler = joblib.load(self.model_paths['scaler'])
                self.feature_names = joblib.load(self.model_paths['feature_names'])
                self.feature_importance = joblib.load(self.model_paths['feature_importance'])
                print("Advanced model loaded successfully!")
            else:
                print("Training new advanced model...")
                self._train_advanced_model()
        except Exception as e:
            print(f"Error loading model: {str(e)}")
            print("Training new advanced model...")
            self._train_advanced_model()

    def _train_advanced_model(self):
        """Train advanced ensemble model with multiple algorithms"""
        # Load and preprocess data
        df = pd.read_csv('models/Salary_Data.csv')
        df.dropna(inplace=True)
        
        # Apply feature engineering
        df_engineered = self._engineer_features(df)
        
        # Clean job titles (group rare titles)
        job_title_count = df_engineered['Job Title'].value_counts()
        job_title_rare = job_title_count[job_title_count <= 15]
        df_engineered['Job Title'] = df_engineered['Job Title'].apply(
            lambda x: 'Others' if x in job_title_rare else x
        )
        
        # Standardize education levels
        df_engineered['Education Level'] = df_engineered['Education Level'].str.replace("'s Degree", "")
        df_engineered['Education Level'] = df_engineered['Education Level'].str.replace("phD", "PhD")
        
        # Prepare features (excluding salary columns for X)
        feature_columns = ['Age', 'Gender', 'Education Level', 'Job Title', 'Years of Experience',
                          'Experience_Level', 'Age_Group', 'Experience_Age_Ratio', 
                          'Job_Category', 'Is_Senior']
        
        X = df_engineered[feature_columns].copy()
        y = df_engineered['Salary']
        
        # Encode categorical variables
        categorical_columns = ['Gender', 'Job Title', 'Experience_Level', 'Age_Group', 'Job_Category']
        
        for col in categorical_columns:
            le = LabelEncoder()
            X[col] = le.fit_transform(X[col].astype(str))
            self.label_encoders[col] = le
        
        # Map education level
        X['Education Level'] = X['Education Level'].map(self.education_mapping).fillna(2)
        
        # Store feature names
        self.feature_names = X.columns.tolist()
        
        # Scale features
        X_scaled = self.scaler.fit_transform(X)
        X_scaled = pd.DataFrame(X_scaled, columns=self.feature_names)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(X_scaled, y, test_size=0.2, random_state=42)
        
        # Define multiple models
        models = {
            'rf': RandomForestRegressor(n_estimators=100, random_state=42, max_depth=15),
            'gb': GradientBoostingRegressor(n_estimators=100, random_state=42, max_depth=6),
            'ridge': Ridge(alpha=1.0)
        }
        
        # Train individual models and evaluate
        print("\nTraining individual models...")
        for name, model in models.items():
            print(f"Training {name}...")
            model.fit(X_train, y_train)
            
            # Cross-validation score
            cv_scores = cross_val_score(model, X_train, y_train, cv=5, scoring='r2')
            print(f"{name} CV R² Score: {cv_scores.mean():.4f} (+/- {cv_scores.std() * 2:.4f})")
            
            self.models[name] = model
        
        # Create ensemble model
        ensemble_models = [
            ('rf', self.models['rf']),
            ('gb', self.models['gb']),
            ('ridge', self.models['ridge'])
        ]
        
        self.ensemble_model = VotingRegressor(
            estimators=ensemble_models,
            weights=[0.4, 0.4, 0.2]  # Give more weight to tree-based models
        )
        
        print("\nTraining ensemble model...")
        self.ensemble_model.fit(X_train, y_train)
        
        # Evaluate ensemble model
        y_pred = self.ensemble_model.predict(X_test)
        
        r2 = r2_score(y_test, y_pred)
        rmse = np.sqrt(mean_squared_error(y_test, y_pred))
        mae = mean_absolute_error(y_test, y_pred)
        
        print(f"\nEnsemble Model Performance:")
        print(f"R² Score: {r2:.4f}")
        print(f"RMSE: ${rmse:.2f}")
        print(f"MAE: ${mae:.2f}")
        
        # Feature importance (from Random Forest)
        rf_importance = self.models['rf'].feature_importances_
        self.feature_importance = dict(zip(self.feature_names, rf_importance))
        
        print(f"\nTop 5 Important Features:")
        sorted_features = sorted(self.feature_importance.items(), key=lambda x: x[1], reverse=True)
        for feature, importance in sorted_features[:5]:
            print(f"{feature}: {importance:.4f}")
        
        # Save all models and components
        os.makedirs('models', exist_ok=True)
        joblib.dump(self.ensemble_model, self.model_paths['ensemble'])
        joblib.dump(self.label_encoders, self.model_paths['encoders'])
        joblib.dump(self.scaler, self.model_paths['scaler'])
        joblib.dump(self.feature_names, self.model_paths['feature_names'])
        joblib.dump(self.feature_importance, self.model_paths['feature_importance'])
        
        print("Advanced model training completed and saved!")

    def predict(self, data):
        """Make prediction with confidence intervals"""
        try:
            # Prepare input data
            input_data = {
                'Age': float(data['age']),
                'Gender': str(data['gender']),
                'Education Level': str(data['education_level']),
                'Job Title': str(data['job_title']),
                'Years of Experience': float(data['years_of_experience'])
            }
            
            # Create DataFrame for feature engineering
            input_df = pd.DataFrame([input_data])
            
            # Apply feature engineering
            input_df = self._engineer_features(input_df)
            
            # Select and prepare features
            feature_columns = ['Age', 'Gender', 'Education Level', 'Job Title', 'Years of Experience',
                              'Experience_Level', 'Age_Group', 'Experience_Age_Ratio', 
                              'Job_Category', 'Is_Senior']
            
            X_input = input_df[feature_columns].copy()
            
            # Encode categorical variables
            categorical_columns = ['Gender', 'Job Title', 'Experience_Level', 'Age_Group', 'Job_Category']
            
            for col in categorical_columns:
                if col in self.label_encoders:
                    le = self.label_encoders[col]
                    
                    # Handle unseen categories
                    if str(X_input[col].iloc[0]) not in le.classes_:
                        # Use most common category for unseen values
                        X_input[col] = le.classes_[0]
                    
                    X_input[col] = le.transform([str(X_input[col].iloc[0])])[0]
            
            # Map education level
            education_mapped = self.education_mapping.get(input_data['Education Level'], 2)
            X_input['Education Level'] = education_mapped
            
            # Ensure correct feature order and types
            X_input = X_input.reindex(columns=self.feature_names, fill_value=0)
            X_input = X_input.astype(float)
            
            # Handle any remaining NaN values
            X_input = X_input.fillna(0)
            
            # Scale features
            X_scaled = self.scaler.transform(X_input)
            
            # Make ensemble prediction
            ensemble_pred = self.ensemble_model.predict(X_scaled)[0]
            
            # Check for NaN predictions
            if np.isnan(ensemble_pred):
                raise ValueError("Model produced NaN prediction - invalid input data")
            
            # Get individual model predictions for confidence estimation
            individual_preds = []
            for name, model in self.models.items():
                if name in ['rf', 'gb', 'ridge']:  # Only use models in ensemble
                    pred = model.predict(X_scaled)[0]
                    if not np.isnan(pred):
                        individual_preds.append(pred)
            
            # Ensure we have valid predictions
            if not individual_preds:
                # Fallback: use just the ensemble prediction if individual models fail
                individual_preds = [ensemble_pred]
            
            # Calculate prediction statistics
            pred_std = np.std(individual_preds)
            confidence_interval = {
                "lower": max(0, ensemble_pred - 1.96 * pred_std),
                "upper": ensemble_pred + 1.96 * pred_std
            }
            
            # Calculate salary range (±10% as before, but more intelligent)
            range_factor = min(0.15, max(0.05, pred_std / ensemble_pred if ensemble_pred > 0 else 0.1))
            salary_range = {
                "min": int(round(ensemble_pred * (1 - range_factor))),
                "max": int(round(ensemble_pred * (1 + range_factor)))
            }
            
            # Feature importance for this prediction
            top_features = sorted(self.feature_importance.items(), key=lambda x: x[1], reverse=True)[:3]
            
            return {
                "predicted_salary": int(round(ensemble_pred)),
                "salary_range": salary_range,
                "confidence_interval": {
                    "lower": int(round(confidence_interval["lower"])),
                    "upper": int(round(confidence_interval["upper"]))
                },
                "prediction_confidence": min(100, max(60, 100 - (pred_std / ensemble_pred * 100 if ensemble_pred > 0 else 40))),
                "top_influential_factors": [{"factor": f[0], "importance": round(f[1], 3)} for f in top_features],
                "model_version": "Advanced Ensemble v2.0"
            }
        
        except Exception as e:
            raise Exception(f"Advanced prediction error: {str(e)}")

    def get_model_info(self):
        """Get comprehensive model information"""
        return {
            "model_type": "Advanced Ensemble (Random Forest + Gradient Boosting + Ridge)",
            "features_count": len(self.feature_names),
            "feature_names": self.feature_names,
            "feature_importance": self.feature_importance,
            "models_in_ensemble": list(self.models.keys()),
            "preprocessing": ["Feature Engineering", "Label Encoding", "Standard Scaling"],
            "capabilities": [
                "Confidence Intervals",
                "Feature Importance Analysis", 
                "Adaptive Salary Ranges",
                "Cross-Validation Validated",
                "Advanced Feature Engineering"
            ]
        }

    def compare_with_basic_model(self, test_data_list):
        """Compare performance with basic model"""
        from models.salary_predictor import SalaryPredictor
        
        basic_model = SalaryPredictor()
        results = []
        
        for test_data in test_data_list:
            try:
                # Advanced prediction
                advanced_pred = self.predict(test_data)
                
                # Basic prediction
                basic_pred = basic_model.predict(test_data)
                
                results.append({
                    "input": test_data,
                    "advanced_prediction": advanced_pred["predicted_salary"],
                    "basic_prediction": basic_pred["predicted_salary"],
                    "advanced_confidence": advanced_pred["prediction_confidence"],
                    "difference": advanced_pred["predicted_salary"] - basic_pred["predicted_salary"]
                })
                
            except Exception as e:
                print(f"Error comparing models for {test_data}: {str(e)}")
        
        return results 