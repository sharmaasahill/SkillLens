
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.model_selection import train_test_split, RandomizedSearchCV
from sklearn.preprocessing import LabelEncoder, OrdinalEncoder
from sklearn.linear_model import LinearRegression, Ridge, Lasso
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.svm import SVR
from sklearn.neighbors import KNeighborsRegressor
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import StandardScaler
import plotly.express as px
import plotly.graph_objects as go
from scipy.stats import randint, uniform
from advanced_analytics import (
    create_3d_salary_visualization,
    create_salary_heatmap,
    create_salary_trend_analysis,
    create_salary_distribution_analysis,
    create_career_path_analysis,
    create_salary_insights,
    create_salary_prediction_confidence
)


# %%
from sklearn.tree import DecisionTreeRegressor
from sklearn.model_selection import GridSearchCV






# %%
df = pd.read_csv('Salary_Data.csv')
df.head()


# %%
df.info()


# %%
df.describe()


# %%
# Checking for null data


df.isnull().sum()


# %%
# Dropping null values from database


df.dropna(inplace=True)


# %%
# Checking unique value counts of Job Titles in the database


df['Job Title'].value_counts()


# %%
# Reducing Job titles by omitting titles with less than 25 counts


job_title_count = df['Job Title'].value_counts()
job_title_edited = job_title_count[job_title_count<=25]
job_title_edited.count()


# %%
# Omitting titles with less than 25 counts


df['Job Title'] = df['Job Title'].apply(lambda x: 'Others' if x in job_title_edited else x )
df['Job Title'].nunique()


# %%
#Checking unique value count of Education Level


df['Education Level'].value_counts()


# %%
# Combining repeating values of education level


df['Education Level'].replace(["Bachelor's Degree","Master's Degree","phD"],["Bachelor's","Master's","PhD"],inplace=True)
df['Education Level'].value_counts()


# %%
# Checking Unique Value count of Gender


df['Gender'].value_counts()


# %%
import seaborn as sns
import matplotlib.pyplot as plt


# Create a figure with two subplots
fig, ax = plt.subplots(1, 2, figsize=(15, 5))


# Plot the count of data points for each gender category in the first subplot
sns.countplot(x='Gender', data=df, ax=ax[0], palette='Set2')


# Plot the count of data points for each education level category in the second subplot
sns.countplot(x='Education Level', data=df, ax=ax[1], palette='husl')  
# Add labels and titles for the subplots
ax[0].set_xlabel('Gender')
ax[0].set_ylabel('Count')
ax[0].set_title('Distribution of Gender')


ax[1].set_xlabel('Education Level')
ax[1].set_ylabel('Count')
ax[1].set_title('Distribution of Education Level')


# Show the plots
plt.tight_layout()
plt.show()




# %% [markdown]
# Distribution of Gender and Education Level
#
# Distribution of Gender: The job market is mostly dominated by males with females being second largest group and extremely few people from the third gender. This shows that while women are slowly becoming a part of the workforce, people belonging to other genders do have very few opportunities.
#
# Distribution of Education Level: A majority of working professionals hold a bachelor's degree followed by master's and PhD holders with least hireable being just High school graduates. This means a bachelor's degree is sufficient to enter the workforce and highly in demand by employers.


# %%
# Get the top 10 job titles with the highest mean salary
top_10_highest_paying_jobs = df.groupby('Job Title')['Salary'].mean().nlargest(10)


# Create a single bar plot for the top 10 highest paying job titles and their mean salaries
plt.figure(figsize=(12, 8))
sns.barplot(x=top_10_highest_paying_jobs.index, y=top_10_highest_paying_jobs.values, palette='viridis', edgecolor='black', )  


# Customize the plot
plt.xlabel('Job Title')
plt.ylabel('Mean Salary')
plt.title('Top 10 Highest Paying Jobs')
plt.xticks(rotation=60)  # Rotate x-axis labels if needed


# Show the plot
plt.tight_layout()
plt.show()


# %% [markdown]
# Top 10 Highest Paying Jobs
#
# The plot shows the Top 10 highest paying jobs in the industry plotted against the mean salary offered for the role. We can see that Data Scientists and Engineers are paid the highest.


# %%
# Create a figure with three subplots
fig, ax = plt.subplots(3, 1, figsize=(12, 15))


# Create a histogram of Age in the first subplot
sns.histplot(df['Age'], ax=ax[0], color='blue', kde=True)
ax[0].set_title('Age Distribution')
ax[0].set_xlabel('Age')


# Create a histogram of Years of Experience in the second subplot
sns.histplot(df['Years of Experience'], ax=ax[1], color='orange', kde=True)
ax[1].set_title('Years of Experience Distribution')
ax[1].set_xlabel('Years of Experience')


# Create a histogram of Salary in the third subplot
sns.histplot(df['Salary'], ax=ax[2], color='green', kde=True)
ax[2].set_title('Salary Distribution')
ax[2].set_xlabel('Salary')


plt.tight_layout()
plt.show()


# %% [markdown]
# Distribution of continuous variables
#
# Age Distribution: It shows that majority of workforce lies in the 27-31 age range which suggests a highly youthful workforce.
#
# Years of Experience Distribution: The plot shows that maximum workforce has 1-4 years of experience which is in agreement with previous results. Younger workforce has less experience than older counterparts
#
# Salary Distribution: The salary majority of workers earn lies in 50,000-60,000 dollars range while similar count of people earn 1,80,000 as well. The plot reveals that there is a lot of different pay ranges within the community with majority of workers earning less than 1,25,000 dollars yearly.


# %%
# Create a figure with two subplots
fig, ax = plt.subplots(1, 2, figsize=(15, 5))


# Create a bar plot for the relationship between Gender and Salary in the first subplot
sns.barplot(x='Gender', y='Salary', data=df, ax=ax[0])
ax[0].set(title='Relationship between Gender and Salary', xlabel='Gender', ylabel='Mean Salary')


# Create a box plot for the relationship between Education Level and Salary in the second subplot
sns.boxplot(x='Education Level', y='Salary', data=df, ax=ax[1])
ax[1].set(title='Relationship between Education Level and Salary', xlabel='Education Level', ylabel='Salary')


# Rotate x-axis labels in the second subplot for better readability
ax[1].tick_params(axis='x', rotation=45)


# Adjust spacing between subplots
plt.tight_layout()


# Show the plots
plt.show()


# %% [markdown]
# Relationship between discreet variables
#
# Gender and Salary: Other genders earn more than men and women. Women earn the least out of all three genders.
#
# Education Level and Salary: The plot reveals that as your education level rises, the mean salary level also rises. High school graduates are paid the least and PhD's the highest. The box plot also reveals the range of salaries and it is highest for bacahelr's degree meaning the distribution of salaries is more diverse for bachelor's degree with some earning as much as somone with a Master's degree would.


# %%
sns.barplot(x='Education Level',y='Salary',data=df,hue='Gender').set(title='Education level vs Salary vs Gender')
plt.show()


# %% [markdown]
# Relationship between Education Level, Salary and Gender
#
# Following trends from previous charts, men on an average are paid more than women with same education level. Where the third gender is present, they are paid more than both the genders. Also, the more you are educated, the more you are paid.


# %%
# Create a figure with two subplots
fig, ax = plt.subplots(1, 2, figsize=(15, 5))


# Scatter plot for relationship between age and salary
sns.regplot(x='Age',y='Salary',data=df, scatter_kws={'color':'orange'}, line_kws={'color':'green'}, ax=ax[0])
ax[0].set(title='Relationship between Age and Salary')


# Scatter plot for relationship between experience and salary
sns.regplot(x='Years of Experience',y='Salary',data=df, scatter_kws={'color':'red'}, line_kws={'color':'blue'}, ax=ax[1])
ax[1].set(title='Relationship between Experience and salary')


plt.tight_layout()
plt.show()


# %% [markdown]
# Relationship between Age and Salary: The is strong positive correlation between age and salary meaning older employees get paid more than younger e,ployees.
#
# Relationship between Experience and Salary: There is strong positive correlation between Experience and salary meaning experienced candidates get paid more. The more experience a candidate gains, the more their salary will become.


# %%
df_encoded = df.copy()


# Loop through each column and label encode if it's of type object
le = LabelEncoder()
for col in df_encoded.columns:
    if df_encoded[col].dtype == 'object':
        df_encoded[col] = le.fit_transform(df_encoded[col])


# Now you can do correlation safely
plt.figure(figsize=(12, 8))
sns.heatmap(df_encoded.corr(), annot=True, cmap='coolwarm')
plt.title('Correlation Plot (Label Encoded)')
plt.xticks(rotation=60)
plt.yticks(rotation=60)
plt.show()


# %%




# %% [markdown]
# Heatmap
#
# The heatmap reveals the degree of correlation between the variables
#
# Highest correlation between age and years of experience
# High correlation between salary and years of experience
# High correlation between salary and age
# Moderately high correlation between salary and education level
# Low correlation between gender and all variables


# %% [markdown]
# Predicting Salary
#
# 3 Models will be used to predict the salary
#
# Linear Regression
# Deision Tree
# Random Forest


# %%
# detecting the outliers in salary column using IQR method
Q1 = df.Salary.quantile(0.25) # First Quartile
Q3 = df.Salary.quantile(0.75) # Third Quartile


# Caltulation Interquartile
IQR = Q3-Q1


# Deetecting outliers lying 1.5x of IQR above and below Q1 and Q3 resp
lower = Q1-1.5*IQR
upper = Q3+1.5*IQR


# %%
df[df.Salary>upper]


# %% [markdown]
# No Outliers in Q3


# %%
df[df.Salary<lower]


# %% [markdown]
# No outliers in Q1


# %% [markdown]
# Preparing the data for ML analysis by converting categorical job titles into a numerical format


# %%
df = pd.read_csv('Salary_Data.csv')




# %%
print(df.columns)




# %%
dummies = pd.get_dummies(df['Job Title'], drop_first=True).astype(int)
df = pd.concat([df, dummies], axis=1)
df.drop('Job Title', axis=1, inplace=True)
df.head()




# %%
# Separating the dataset into features and target


# Dataset conntaining all features from df
features = df.drop('Salary',axis=1)


# Series containing target variable to be predicted
target = df['Salary']


# %%
# Splitting data into 25% training and 75% test sets


x_train,x_test,y_train,y_test = train_test_split(features,target,test_size=0.25,random_state=42)
x_train.shape


# %%
# Create a dictionary for defining models and tuning hyperparameters


model_params = {
    'Linear_Regression':{
        'model':LinearRegression(),
        'params':{
           
        }
    },
    'Decision_Tree':{
        'model':DecisionTreeRegressor(),
        'params':{
            'max_depth':[2,4,6,8,10],
            'random_state':[0,42],
            'min_samples_split':[1,5,10,20]
        }
    },
    'Random_Forest':{
        'model':RandomForestRegressor(),
        'params':{
            'n_estimators':[10,30,20,50,80]
        }
    }
}


# %%
# Label Encode Gender if not already done
from sklearn.preprocessing import LabelEncoder


if df['Gender'].dtype == 'object':
    le = LabelEncoder()
    df['Gender'] = le.fit_transform(df['Gender'])  # Male=1, Female=0 (typically)


# Map Education Level (if needed)
education_mapping = {"High School": 0, "Bachelor's": 1, "Master's": 2, "PhD": 3}
if df['Education Level'].dtype == 'object':
    df['Education Level'] = df['Education Level'].map(education_mapping)


# One-Hot Encode Job Title (or any other categorical)
df = pd.get_dummies(df, drop_first=True)


# Now split the data
X = df.drop('Salary', axis=1)  # Replace with your actual target col
y = df['Salary']  # Replace with your actual target col
x_train, x_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)




# %%
# Drop rows with NaNs in either X or y
x_train = x_train.dropna()
y_train = y_train.loc[x_train.index]  # sync y with new x_train
x_test = x_test.dropna()
y_test = y_test.loc[x_test.index]




# %%
# Hyper parameter tuning through grid search cv
score=[]


for model_name,m in model_params.items():
    clf = GridSearchCV(m['model'],m['params'],cv=5,scoring='neg_mean_squared_error')
    clf.fit(x_train,y_train)
   
    score.append({
        'Model':model_name,
        'Params':clf.best_params_,
        'MSE(-ve)':clf.best_score_
    })
pd.DataFrame(score)    


# %%
# Order of the best models


s = pd.DataFrame(score)
sort = s.sort_values(by = 'MSE(-ve)',ascending=False)
sort


# %%
# Random Forest model


rfr = RandomForestRegressor(n_estimators=20)
rfr.fit(x_train,y_train)


# %%


rfr.score(x_test,y_test)


# %%
y_pred_rfr = rfr.predict(x_test)


print("Mean Squared Error :",mean_squared_error(y_test,y_pred_rfr))
print("Mean Absolute Error :",mean_absolute_error(y_test,y_pred_rfr))
print("Root Mean Squared Error :",mean_squared_error(y_test,y_pred_rfr,squared=False))


# %%
# Decision Tree model


dtr = DecisionTreeRegressor(max_depth=10,min_samples_split=2,random_state=0)
dtr.fit(x_train,y_train)


# %%
dtr.score(x_test,y_test)


# %%
y_pred_dtr = dtr.predict(x_test)


print("Mean Squared Error :",mean_squared_error(y_test,y_pred_dtr))
print("Mean Absolute Error :",mean_absolute_error(y_test,y_pred_dtr))
print("Root Mean Squared Error :",mean_squared_error(y_test,y_pred_dtr,squared=False))


# %%
# Linear regression model


lr = LinearRegression()
lr.fit(x_train,y_train)


# %%
lr.score(x_test,y_test)


# %%
y_pred_lr = lr.predict(x_test)


print("Mean Squared Error :",mean_squared_error(y_test,y_pred_lr))
print("Mean Absolute Error :",mean_absolute_error(y_test,y_pred_lr))
print("Root Mean Squared Error :",mean_squared_error(y_test,y_pred_lr,squared=False))


# %%
# Access the feature importances of Random Forest Regressor
feature_importances = rfr.feature_importances_


# Assuming you have a list of feature names that corresponds to the feature importances
feature_names = list(x_train.columns)


# Sort feature importances in descending order
sorted_indices = np.argsort(feature_importances)[::-1]
sorted_feature_importances = [feature_importances[i] for i in sorted_indices]
sorted_feature_names = [feature_names[i] for i in sorted_indices]


# Create a bar chart
plt.figure(figsize=(12, 8))
plt.barh(sorted_feature_names[:10], sorted_feature_importances[:10])
plt.xlabel('Feature Importance')
plt.title('Top 10 Feature Importance in Predicting Salary')
plt.gca().invert_yaxis()  # Invert the y-axis for better visualization
plt.show()


# %% [markdown]
# A bar chart depicting the importance of different features in predicting salary.
#
# Conclusion
# 1. The Random Forest model achieved the highest R-squared score (0.971) and the lowest MSE, MAE, and RMSE values, indicating the best predictive performance among the three models.
#
# 2. The Decision Tree model performed well with an R-squared score of 0.941 but had higher errors compared to the Random Forest.
#
# 3. The Linear Regression model had the lowest R-squared score (0.833) and the highest errors, suggesting it may not capture the underlying patterns in the data as effectively as the ensemble models.
#
# In conclusion, the Random Forest model appears to be the most suitable for predicting salaries in this dataset, as it offers the highest predictive accuracy and the lowest error metrics. Further optimization and fine-tuning of the Random Forest model could potentially lead to even better results.









