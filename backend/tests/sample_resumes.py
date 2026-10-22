"""Sample resume texts used to calibrate and test the ATS scorer."""

STRONG = """Priya Sharma
Senior Data Scientist
priya.sharma@example.com | +91 98765 43210 | linkedin.com/in/priya-sharma | github.com/priyasharma

Professional Summary
Data scientist with 6 years of experience building machine learning products used by 2,000,000 customers.
I turn messy data into decisions and ship models to production on AWS.

Work Experience
Senior Data Scientist, Nimbus Analytics, Pune (2021 - Present)
- Led a team of 4 analysts and built a churn prediction model in Python that reduced churn by 18%.
- Designed and deployed a recommendation engine with PyTorch, increasing engagement by 23% for 1.2M users.
- Automated SQL and Spark ETL pipelines on AWS, cutting reporting time from 3 days to 4 hours.
- Migrated 40 dashboards from Excel to Tableau and Power BI, saving $120,000 a year in licence costs.
- Mentored 6 junior engineers and established code review and unit testing practices for the team.

Data Analyst, Orbit Retail, Mumbai (2018 - 2021)
- Implemented an A/B testing framework that improved conversion by 12% across 300 stores.
- Optimized pricing experiments with statistics and scikit-learn, generating Rs 2 crore in new revenue.
- Built Docker based microservices and a REST API used by 15 internal teams.
- Streamlined data visualization reporting with pandas and NumPy, delivering weekly insights to 25 stakeholders.

Projects
- Open source NLP toolkit for Hindi text classification with 1,500 GitHub stars, built with TensorFlow and Keras.
- Real time fraud detection on Kafka and Kubernetes processing 10,000 transactions per second.

Education
Master of Science in Data Science, University of Pune, 2018
Bachelor of Technology in Computer Science, VIT, 2016

Technical Skills
Python, R, SQL, Machine Learning, Deep Learning, TensorFlow, PyTorch, scikit-learn, Pandas, NumPy, Spark,
Hadoop, AWS, Azure, Docker, Kubernetes, Git, CI/CD, Tableau, Power BI, Statistics, Data Analysis, NLP

Certifications
AWS Certified Machine Learning Specialty; Google Professional Data Engineer
""" + "\n".join(
    f"- Delivered analysis {i} for product, marketing and finance stakeholders, improving decisions with clear metrics."
    for i in range(1, 8)
)

AVERAGE = """Rahul Verma
rahul.verma@example.com
9876543210

Experience
Software Developer, Acme Solutions (2020 - Present)
Responsible for building web pages using React and JavaScript.
Worked on backend APIs with Node.js and MongoDB.
Helped with testing and deployment of new features.
Developed a dashboard for the sales team.

Education
B.Tech in Computer Science, 2020

Skills
JavaScript, React, Node.js, MongoDB, HTML, CSS, Git
""" + "\n".join(f"Worked on feature {i} with the team and attended daily standups." for i in range(1, 12))

WEAK = """John
I am a hard working person looking for a good job in a reputed company.
I worked on many things and was responsible for different tasks.
I like to learn new things and work with people.
"""

# Ordinary words that the old matcher wrongly read as skills ("r", "go", "spring" and so on)
FALSE_POSITIVE_TEXT = """Experience
I worked hard every spring and summer to grow our market share, and was eager to go further.
Our team created a great career program. Excellent communication with every partner.
"""

INDIAN_ACCOUNTANT = """Neha Gupta
Accounts Executive | Noida | +91-98110-22334 | neha.gupta@example.com | linkedin.com/in/nehagupta

Professional Summary
Accounts executive with 4 years of experience in GST filing, TDS returns and bank reconciliation for SMEs.

Work Experience
Accounts Executive, Shree Balaji Traders Pvt Ltd, Noida (2021 - Present)
- Reduced month-end closing time by 30% by automating MIS reports in Excel with pivot tables and VLOOKUP.
- Filed GST returns for 45 clients every month and cut late-filing penalties to zero.
- Managed accounts payable of Rs 2 crore a year across 120 vendors in Tally Prime.

Education
B.Com (Hons), Delhi University, 2020, CGPA 8.2/10

Skills
Tally, GST, TDS, Income Tax, Bank Reconciliation, Accounts Payable, Excel, MIS

Personal Details
Date of Birth: 12/04/1998
Marital Status: Single
Father's Name: R. K. Gupta
"""
