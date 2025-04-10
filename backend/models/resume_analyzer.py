import os
import re
from datetime import datetime
from pdfminer.high_level import extract_text
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity

# Load model once
model = SentenceTransformer('all-MiniLM-L6-v2')


SKILLS = [
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "ruby", "php", "swift", "kotlin", "r", "sql", "bash", "react", "angular", "vue", "next.js", "node.js", "express", "django", "flask", "spring", "fastapi", 
"tensorflow", "pytorch", "scikit-learn", "keras", "xgboost", "pandas", "numpy", "matplotlib", "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins", "gitlab ci", "github actions", "git", "linux", "jira", "firebase", "postman", "mongodb", "mysql", "postgresql", "sqlite", "redis", "power bi", "tableau", "excel", "hadoop", "spark", "hive", "airflow", "bigquery", "looker", "nlp", "computer vision", "deep learning", "llm", "bert", "gpt", "huggingface", "mlops", "feature engineering", "leadership", "communication", "problem solving", "teamwork", "critical thinking", "agile", "scrum", "collaboration"
]

# Precompute skill embeddings
skill_embeddings = model.encode(SKILLS)

def extract_skills_from_resume(file_path):
    text = extract_text(file_path)
    sentences = [s.strip() for s in re.split(r'\.|\n', text) if len(s.strip()) > 10]
    sentence_embeddings = model.encode(sentences)

    matched_skills = set()
    for idx, sentence_vec in enumerate(sentence_embeddings):
        sims = cosine_similarity([sentence_vec], skill_embeddings)[0]
        for i, score in enumerate(sims):
            if score > 0.65:  # similarity threshold
                matched_skills.add(SKILLS[i])

    return list(matched_skills), text
