import pandas as pd
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
import re
import json
from typing import List, Dict, Any
import os

class JobRecommender:
    def __init__(self):
        self.jobs_df = None
        self.skills_vectorizer = None
        self.jobs_skills_matrix = None
        self.all_skills = []
        self._load_jobs_data()
        self._preprocess_skills()

    def _load_jobs_data(self):
        """Load and preprocess the Glassdoor jobs dataset"""
        try:
            jobs_path = os.path.join(os.path.dirname(__file__), 'glassdoor_all_jobs.csv')
            self.jobs_df = pd.read_csv(jobs_path)
            
            # Clean and preprocess the data
            self.jobs_df = self.jobs_df.dropna(subset=['Position', 'Company', 'Skills'])
            self.jobs_df['Skills'] = self.jobs_df['Skills'].fillna('')
            self.jobs_df['Job Description'] = self.jobs_df['Job Description'].fillna('')
            
            # Clean skills column
            self.jobs_df['Cleaned_Skills'] = self.jobs_df['Skills'].apply(self._clean_skills_text)
            
            # Extract experience level from position
            self.jobs_df['Experience_Level'] = self.jobs_df['Position'].apply(self._extract_experience_level)
            
            # Extract job category
            self.jobs_df['Job_Category'] = self.jobs_df['Position'].apply(self._categorize_job)
            
            print(f"Loaded {len(self.jobs_df)} jobs from dataset")
            
        except Exception as e:
            print(f"Error loading jobs data: {str(e)}")
            self.jobs_df = pd.DataFrame()

    def _clean_skills_text(self, skills_text: str) -> str:
        """Clean and normalize skills text"""
        if pd.isna(skills_text) or skills_text == '':
            return ''
        
        # Remove extra whitespace and normalize
        skills = str(skills_text).lower().strip()
        
        # Split by comma and clean each skill
        skill_list = [skill.strip() for skill in skills.split(',')]
        
        # Remove empty skills and duplicates
        clean_skills = list(set([skill for skill in skill_list if skill and len(skill) > 1]))
        
        return ', '.join(clean_skills)

    def _extract_experience_level(self, position: str) -> str:
        """Extract experience level from job position"""
        position_lower = position.lower()
        
        if any(keyword in position_lower for keyword in ['senior', 'sr.', 'lead', 'principal', 'staff']):
            return 'Senior'
        elif any(keyword in position_lower for keyword in ['junior', 'jr.', 'associate', 'intern', 'trainee', 'fresher']):
            return 'Junior'
        elif any(keyword in position_lower for keyword in ['manager', 'director', 'head', 'vp', 'vice president']):
            return 'Management'
        else:
            return 'Mid-level'

    def _categorize_job(self, position: str) -> str:
        """Categorize job based on position title"""
        position_lower = position.lower()
        
        # Software Development
        if any(keyword in position_lower for keyword in ['software', 'developer', 'engineer', 'programmer', 'full stack', 'frontend', 'backend', 'mobile']):
            return 'Software Development'
        
        # Data Science & Analytics
        elif any(keyword in position_lower for keyword in ['data scientist', 'data analyst', 'analytics', 'machine learning', 'ml', 'ai', 'artificial intelligence']):
            return 'Data Science'
        
        # DevOps & Cloud
        elif any(keyword in position_lower for keyword in ['devops', 'cloud', 'infrastructure', 'platform', 'sre', 'reliability']):
            return 'DevOps/Cloud'
        
        # Architecture & Design
        elif any(keyword in position_lower for keyword in ['architect', 'architecture', 'solution', 'design']):
            return 'Architecture'
        
        # Testing & QA
        elif any(keyword in position_lower for keyword in ['test', 'qa', 'quality', 'automation']):
            return 'Testing/QA'
        
        # Management
        elif any(keyword in position_lower for keyword in ['manager', 'lead', 'director', 'head', 'vp']):
            return 'Management'
        
        else:
            return 'Other'

    def _preprocess_skills(self):
        """Preprocess skills for vectorization"""
        if self.jobs_df.empty:
            return
        
        try:
            # Create a corpus of all skills
            skills_corpus = self.jobs_df['Cleaned_Skills'].tolist()
            
            # Initialize TF-IDF vectorizer
            self.skills_vectorizer = TfidfVectorizer(
                max_features=1000,
                stop_words='english',
                ngram_range=(1, 2),
                min_df=1,
                max_df=0.8
            )
            
            # Fit and transform the skills corpus
            self.jobs_skills_matrix = self.skills_vectorizer.fit_transform(skills_corpus)
            
            # Get all unique skills
            feature_names = self.skills_vectorizer.get_feature_names_out()
            self.all_skills = list(feature_names)
            
            print(f"Processed {len(self.all_skills)} unique skill features")
            
        except Exception as e:
            print(f"Error preprocessing skills: {str(e)}")

    def _calculate_skill_match_score(self, user_skills: List[str], job_skills: str) -> float:
        """Calculate skill match score between user skills and job requirements"""
        if not user_skills or not job_skills:
            return 0.0
        
        user_skills_lower = [skill.lower().strip() for skill in user_skills]
        job_skills_lower = job_skills.lower()
        
        # Exact matches
        exact_matches = sum(1 for skill in user_skills_lower if skill in job_skills_lower)
        
        # Partial matches (for compound skills)
        partial_matches = 0
        for user_skill in user_skills_lower:
            if len(user_skill) > 3:  # Only check meaningful skills
                for job_skill_part in job_skills_lower.split(','):
                    if user_skill in job_skill_part.strip() or job_skill_part.strip() in user_skill:
                        partial_matches += 0.5
                        break
        
        total_matches = exact_matches + partial_matches
        max_possible_matches = max(len(user_skills_lower), len(job_skills_lower.split(',')))
        
        return min(total_matches / max_possible_matches, 1.0) if max_possible_matches > 0 else 0.0

    def _calculate_experience_match(self, user_experience: int, job_experience_level: str) -> float:
        """Calculate experience level match score"""
        experience_mapping = {
            'Junior': (0, 3),
            'Mid-level': (2, 7),
            'Senior': (5, 15),
            'Management': (7, 20)
        }
        
        if job_experience_level not in experience_mapping:
            return 0.5  # Neutral score for unknown levels
        
        min_exp, max_exp = experience_mapping[job_experience_level]
        
        if min_exp <= user_experience <= max_exp:
            return 1.0
        elif user_experience < min_exp:
            # User is underqualified
            return max(0.3, 1.0 - (min_exp - user_experience) * 0.2)
        else:
            # User is overqualified
            return max(0.5, 1.0 - (user_experience - max_exp) * 0.1)

    def _generate_recommendation_reasoning(self, user_skills: List[str], user_experience: int, 
                                         job: Dict, skill_score: float, experience_score: float,
                                         location_score: float, category_score: float,
                                         matched_skills: List[str]) -> str:
        """Generate detailed reasoning for why this job is recommended"""
        reasons = []
        
        # Skills reasoning
        if skill_score >= 0.7:
            reasons.append(f"🎯 **Excellent skill match** ({int(skill_score * 100)}%) - You have {len(matched_skills)} key skills: {', '.join(matched_skills[:3])}{'...' if len(matched_skills) > 3 else ''}")
        elif skill_score >= 0.4:
            reasons.append(f"✅ **Good skill match** ({int(skill_score * 100)}%) - Your skills align well with {len(matched_skills)} requirements: {', '.join(matched_skills[:2])}")
        elif skill_score >= 0.2:
            reasons.append(f"🔄 **Partial skill match** ({int(skill_score * 100)}%) - Some transferable skills, good growth opportunity")
        else:
            reasons.append(f"🌱 **Career growth opportunity** - While skill match is moderate, this role could expand your expertise")
        
        # Experience reasoning
        experience_mapping = {
            'Junior': (0, 3),
            'Mid-level': (2, 7), 
            'Senior': (5, 15),
            'Management': (7, 20)
        }
        
        job_exp_range = experience_mapping.get(job['Experience_Level'], (0, 0))
        if experience_score >= 0.9:
            reasons.append(f"👔 **Perfect experience fit** - Your {user_experience} years aligns perfectly with {job['Experience_Level']} level")
        elif experience_score >= 0.7:
            reasons.append(f"📈 **Strong experience match** - Your {user_experience} years suits this {job['Experience_Level']} position well")
        elif user_experience < job_exp_range[0]:
            reasons.append(f"🚀 **Growth opportunity** - Stretch role that could accelerate your career development")
        else:
            reasons.append(f"🎯 **Leadership potential** - Your experience could bring valuable insights to this role")
        
        # Location reasoning
        if location_score > 1.0:
            reasons.append(f"📍 **Preferred location** - Located in your desired area: {job['Location']}")
        
        # Category reasoning  
        if category_score > 1.0:
            reasons.append(f"🎨 **Preferred field** - Matches your interest in {job['Job_Category']}")
        
        # Company and role specific insights
        if 'senior' in job['Position'].lower() and user_experience >= 5:
            reasons.append(f"🏆 **Senior role recognition** - Position acknowledges your expertise level")
        
        if any(skill in job['Cleaned_Skills'].lower() for skill in ['machine learning', 'ai', 'data science']):
            reasons.append(f"🤖 **Cutting-edge technology** - Role involves emerging tech and innovation")
        
        if any(skill in job['Cleaned_Skills'].lower() for skill in ['leadership', 'team', 'management']):
            reasons.append(f"👥 **Leadership opportunity** - Role includes team collaboration and leadership aspects")
        
        return " • ".join(reasons[:4])  # Limit to top 4 reasons

    def recommend_jobs(self, user_skills: List[str], user_experience: int = 0, 
                      preferred_locations: List[str] = None, 
                      preferred_categories: List[str] = None,
                      top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Recommend jobs based on user skills and preferences
        
        Args:
            user_skills: List of user's skills
            user_experience: User's years of experience
            preferred_locations: Preferred job locations
            preferred_categories: Preferred job categories
            top_k: Number of recommendations to return
        
        Returns:
            List of recommended jobs with scores and detailed reasoning
        """
        
        if self.jobs_df.empty or not user_skills:
            return []
        
        recommendations = []
        
        for idx, job in self.jobs_df.iterrows():
            # Calculate skill match score
            skill_score = self._calculate_skill_match_score(user_skills, job['Cleaned_Skills'])
            
            # Calculate experience match score
            experience_score = self._calculate_experience_match(user_experience, job['Experience_Level'])
            
            # Location preference score
            location_score = 1.0
            if preferred_locations:
                location_lower = job['Location'].lower() if pd.notna(job['Location']) else ''
                location_score = 1.2 if any(loc.lower() in location_lower for loc in preferred_locations) else 0.8
            
            # Category preference score
            category_score = 1.0
            if preferred_categories:
                category_score = 1.2 if job['Job_Category'] in preferred_categories else 0.8
            
            # Calculate overall score (weighted combination)
            overall_score = (
                skill_score * 0.5 +           # 50% weight on skills
                experience_score * 0.3 +      # 30% weight on experience
                location_score * 0.1 +        # 10% weight on location
                category_score * 0.1          # 10% weight on category
            )
            
            # Only include jobs with reasonable skill match
            if skill_score > 0.1:
                matched_skills = self._get_matched_skills(user_skills, job['Cleaned_Skills'])
                
                # Generate detailed reasoning
                reasoning = self._generate_recommendation_reasoning(
                    user_skills, user_experience, job, skill_score, experience_score,
                    location_score, category_score, matched_skills
                )
                
                recommendation = {
                    'job_id': idx,
                    'position': job['Position'],
                    'company': job['Company'],
                    'location': job['Location'],
                    'job_url': job.get('Job URL', ''),
                    'job_description': job['Job Description'][:500] + '...' if len(job['Job Description']) > 500 else job['Job Description'],
                    'required_skills': job['Skills'],
                    'job_category': job['Job_Category'],
                    'experience_level': job['Experience_Level'],
                    'overall_score': round(overall_score, 3),
                    'skill_match_score': round(skill_score, 3),
                    'experience_match_score': round(experience_score, 3),
                    'matched_skills': matched_skills,
                    'recommendation_reasoning': reasoning,
                    'why_recommended': self._get_key_highlights(job, matched_skills, skill_score, experience_score)
                }
                
                recommendations.append(recommendation)
        
        # Sort by overall score (descending)
        recommendations.sort(key=lambda x: x['overall_score'], reverse=True)
        
        return recommendations[:top_k]

    def _get_key_highlights(self, job: Dict, matched_skills: List[str], skill_score: float, experience_score: float) -> List[str]:
        """Get key highlights for why this job is recommended"""
        highlights = []
        
        if skill_score >= 0.6:
            highlights.append(f"Strong skill alignment with {len(matched_skills)} matching competencies")
        
        if experience_score >= 0.8:
            highlights.append("Perfect experience level fit")
        
        if 'remote' in job.get('Location', '').lower():
            highlights.append("Remote work opportunity")
        
        if any(keyword in job['Position'].lower() for keyword in ['lead', 'senior', 'principal']):
            highlights.append("Leadership/Senior role opportunity")
        
        if any(keyword in job.get('Job Description', '').lower() for keyword in ['growth', 'learning', 'development']):
            highlights.append("Career growth and learning opportunities")
        
        return highlights[:3]  # Limit to top 3 highlights

    def _get_matched_skills(self, user_skills: List[str], job_skills: str) -> List[str]:
        """Get list of matched skills between user and job"""
        if not user_skills or not job_skills:
            return []
        
        user_skills_lower = [skill.lower().strip() for skill in user_skills]
        job_skills_lower = job_skills.lower()
        
        matched = []
        for skill in user_skills_lower:
            if skill in job_skills_lower:
                matched.append(skill)
        
        return matched

    def get_job_categories(self) -> List[str]:
        """Get all available job categories"""
        if self.jobs_df.empty:
            return []
        return self.jobs_df['Job_Category'].unique().tolist()

    def get_locations(self) -> List[str]:
        """Get all available job locations"""
        if self.jobs_df.empty:
            return []
        return self.jobs_df['Location'].unique().tolist()

    def get_skills_analysis(self, user_skills: List[str]) -> Dict[str, Any]:
        """Analyze user skills against job market demand"""
        if self.jobs_df.empty or not user_skills:
            return {}
        
        skills_demand = {}
        total_jobs = len(self.jobs_df)
        
        for skill in user_skills:
            skill_lower = skill.lower()
            matching_jobs = self.jobs_df[
                self.jobs_df['Cleaned_Skills'].str.contains(skill_lower, case=False, na=False)
            ]
            
            demand_percentage = (len(matching_jobs) / total_jobs) * 100
            skills_demand[skill] = {
                'demand_percentage': round(demand_percentage, 2),
                'job_count': len(matching_jobs),
                'avg_experience_level': matching_jobs['Experience_Level'].mode().iloc[0] if not matching_jobs.empty else 'Unknown'
            }
        
        # Get trending skills (most in-demand skills in the dataset)
        all_job_skills = ' '.join(self.jobs_df['Cleaned_Skills'].fillna(''))
        trending_skills = []
        
        # Count skill frequencies
        skill_counts = {}
        for skills_text in self.jobs_df['Cleaned_Skills']:
            if pd.notna(skills_text):
                for skill in skills_text.split(','):
                    skill = skill.strip().lower()
                    if len(skill) > 2:  # Ignore very short terms
                        skill_counts[skill] = skill_counts.get(skill, 0) + 1
        
        # Get top trending skills
        sorted_skills = sorted(skill_counts.items(), key=lambda x: x[1], reverse=True)
        trending_skills = [skill for skill, count in sorted_skills[:20]]
        
        return {
            'user_skills_demand': skills_demand,
            'trending_skills': trending_skills,
            'total_jobs_analyzed': total_jobs,
            'skill_gap_analysis': self._analyze_skill_gaps(user_skills, trending_skills)
        }

    def _analyze_skill_gaps(self, user_skills: List[str], trending_skills: List[str]) -> List[str]:
        """Identify skill gaps based on trending skills"""
        user_skills_lower = [skill.lower() for skill in user_skills]
        
        # Find trending skills that user doesn't have
        skill_gaps = []
        for trending_skill in trending_skills[:10]:  # Top 10 trending skills
            if not any(trending_skill in user_skill or user_skill in trending_skill 
                      for user_skill in user_skills_lower):
                skill_gaps.append(trending_skill)
        
        return skill_gaps[:5]  # Return top 5 skill gaps