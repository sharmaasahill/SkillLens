import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score, mean_squared_error
import joblib

# Load dataset
df = pd.read_csv("models/ds_salaries.csv")

# Preprocessing: Drop unnecessary columns
df = df.drop(columns=["salary", "salary_currency", "employee_residence", "company_location"])

# Encode experience level
experience_mapping = {'EN': 0, 'MI': 1, 'SE': 2, 'EX': 3}
df['experience_level'] = df['experience_level'].map(experience_mapping)

# Encode employment type
employment_mapping = {'PT': 0, 'FT': 1, 'CT': 2, 'FL': 3}
df['employment_type'] = df['employment_type'].map(employment_mapping)

# Define features and target
X = df.drop(columns=['salary_in_usd'])
y = df['salary_in_usd']

# Identify categorical and numerical features
categorical_features = ['job_title', 'company_size']
numerical_features = ['experience_level', 'employment_type', 'remote_ratio']

# Preprocessing pipelines
categorical_transformer = OneHotEncoder(handle_unknown='ignore')
numerical_transformer = StandardScaler()

preprocessor = ColumnTransformer(
    transformers=[
        ('cat', categorical_transformer, categorical_features),
        ('num', numerical_transformer, numerical_features)
    ]
)

# Final model pipeline
model_pipeline = Pipeline(steps=[
    ('preprocessor', preprocessor),
    ('regressor', RandomForestRegressor())
])

# Split data
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Hyperparameter tuning
param_dist = {
    'regressor__n_estimators': [100, 200, 300],
    'regressor__max_depth': [None, 10, 20, 30],
    'regressor__min_samples_split': [2, 5, 10],
    'regressor__min_samples_leaf': [1, 2, 4],
}

search = RandomizedSearchCV(
    model_pipeline,
    param_distributions=param_dist,
    n_iter=10,
    scoring='r2',
    n_jobs=-1,
    cv=3,
    random_state=42
)

# Train model
search.fit(X_train, y_train)

# Evaluate
y_pred = search.predict(X_test)
print("R² Score:", r2_score(y_test, y_pred))
print("RMSE:", np.sqrt(mean_squared_error(y_test, y_pred)))

# Save trained model
joblib.dump(search.best_estimator_, 'models/salary_predictor.pkl')
print("✅ Model saved as models/salary_predictor.pkl")
