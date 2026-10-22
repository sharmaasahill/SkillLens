import heapq
import logging
import os
from collections import Counter
from typing import Any, Dict, List

import pandas as pd

logger = logging.getLogger(__name__)

class JobRecommender:
    def __init__(self):
        self.jobs_df = None
        self._index = None
        self._trending = None
        self._load_jobs_data()

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
            
            logger.info("Loaded %d jobs from dataset", len(self.jobs_df))
            
        except Exception as e:
            logger.error("Error loading jobs data: %s", e)
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
        clean_skills = sorted(set(skill for skill in skill_list if skill and len(skill) > 1))
        
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
            reasons.append(f"**Excellent skill match** ({int(skill_score * 100)}%) - You have {len(matched_skills)} key skills: {', '.join(matched_skills[:3])}{'...' if len(matched_skills) > 3 else ''}")
        elif skill_score >= 0.4:
            reasons.append(f"**Good skill match** ({int(skill_score * 100)}%) - Your skills align well with {len(matched_skills)} requirements: {', '.join(matched_skills[:2])}")
        elif skill_score >= 0.2:
            reasons.append(f"**Partial skill match** ({int(skill_score * 100)}%) - Some transferable skills, good growth opportunity")
        else:
            reasons.append(f"**Career growth opportunity** - While skill match is moderate, this role could expand your expertise")
        
        # Experience reasoning
        experience_mapping = {
            'Junior': (0, 3),
            'Mid-level': (2, 7), 
            'Senior': (5, 15),
            'Management': (7, 20)
        }
        
        job_exp_range = experience_mapping.get(job['Experience_Level'], (0, 0))
        if experience_score >= 0.9:
            reasons.append(f"**Perfect experience fit** - Your {user_experience} years aligns perfectly with {job['Experience_Level']} level")
        elif experience_score >= 0.7:
            reasons.append(f"**Strong experience match** - Your {user_experience} years suits this {job['Experience_Level']} position well")
        elif user_experience < job_exp_range[0]:
            reasons.append(f"**Growth opportunity** - Stretch role that could accelerate your career development")
        else:
            reasons.append(f"**Leadership potential** - Your experience could bring valuable insights to this role")
        
        # Location reasoning
        if location_score > 1.0:
            reasons.append(f"**Preferred location** - Located in your desired area: {job['Location']}")
        
        # Category reasoning  
        if category_score > 1.0:
            reasons.append(f"**Preferred field** - Matches your interest in {job['Job_Category']}")
        
        # Company and role specific insights
        if 'senior' in job['Position'].lower() and user_experience >= 5:
            reasons.append(f"**Senior role recognition** - Position acknowledges your expertise level")
        
        if any(skill in job['Cleaned_Skills'].lower() for skill in ['machine learning', 'ai', 'data science']):
            reasons.append(f"**Cutting-edge technology** - Role involves emerging tech and innovation")
        
        if any(skill in job['Cleaned_Skills'].lower() for skill in ['leadership', 'team', 'management']):
            reasons.append(f"**Leadership opportunity** - Role includes team collaboration and leadership aspects")
        
        return " • ".join(reasons[:4])  # Limit to top 4 reasons

    def _job_index(self):
        """Per-job values used for scoring, computed once instead of on every request."""
        if getattr(self, '_index', None) is None:
            df = self.jobs_df
            self._index = [
                (idx, cleaned.lower(), [part.strip() for part in cleaned.lower().split(',')], level,
                 category, (loc.lower() if pd.notna(loc) else ''))
                for idx, cleaned, level, category, loc in zip(
                    df.index, df['Cleaned_Skills'], df['Experience_Level'], df['Job_Category'], df['Location'])
            ]
        return self._index

    def recommend_jobs(self, user_skills: List[str], user_experience: int = 0,
                      preferred_locations: List[str] = None,
                      preferred_categories: List[str] = None,
                      top_k: int = 10) -> List[Dict[str, Any]]:
        """
        Recommend jobs based on user skills and preferences.

        Every job is scored, but the detailed fields (reasoning, highlights, description)
        are only built for the top_k results, which keeps a request to a few milliseconds.
        """
        if self.jobs_df.empty or not user_skills:
            return []

        skills_lower = [skill.lower().strip() for skill in user_skills]
        long_skills = [skill for skill in skills_lower if len(skill) > 3]
        locations = [loc.lower() for loc in (preferred_locations or [])]
        categories = set(preferred_categories or [])
        exp_cache = {}

        scored = []
        for order, (idx, skills_text, parts, level, category, location) in enumerate(self._job_index()):
            # Same formula as _calculate_skill_match_score, on precomputed lowercase text
            exact = sum(1 for skill in skills_lower if skill in skills_text)
            partial = 0.0
            for skill in long_skills:
                for part in parts:
                    if skill in part or part in skill:
                        partial += 0.5
                        break
            max_possible = max(len(skills_lower), len(parts))
            skill_score = min((exact + partial) / max_possible, 1.0) if max_possible else 0.0
            if skill_score <= 0.1:
                continue

            if level not in exp_cache:
                exp_cache[level] = self._calculate_experience_match(user_experience, level)
            experience_score = exp_cache[level]
            location_score = (1.2 if any(loc in location for loc in locations) else 0.8) if locations else 1.0
            category_score = (1.2 if category in categories else 0.8) if categories else 1.0
            overall = skill_score * 0.5 + experience_score * 0.3 + location_score * 0.1 + category_score * 0.1
            scored.append((round(overall, 3), order, idx, skill_score, experience_score, location_score, category_score))

        # Highest score first; ties keep dataset order, exactly as a stable sort would
        top = heapq.nsmallest(top_k, scored, key=lambda item: (-item[0], item[1]))

        recommendations = []
        for overall, _, idx, skill_score, experience_score, location_score, category_score in top:
            job = self.jobs_df.loc[idx]
            matched_skills = self._get_matched_skills(user_skills, job['Cleaned_Skills'])
            description = job['Job Description']
            recommendations.append({
                'job_id': int(idx),
                'position': job['Position'],
                'company': job['Company'],
                'location': job['Location'],
                'job_url': job.get('Job URL', ''),
                'job_description': description[:500] + '...' if len(description) > 500 else description,
                'required_skills': job['Skills'],
                'job_category': job['Job_Category'],
                'experience_level': job['Experience_Level'],
                'overall_score': overall,
                'skill_match_score': round(skill_score, 3),
                'experience_match_score': round(experience_score, 3),
                'matched_skills': matched_skills,
                'recommendation_reasoning': self._generate_recommendation_reasoning(
                    user_skills, user_experience, job, skill_score, experience_score,
                    location_score, category_score, matched_skills),
                'why_recommended': self._get_key_highlights(job, matched_skills, skill_score, experience_score),
            })
        return recommendations

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

    def _trending_skills(self):
        """Most frequent skills across all listings. The dataset is static, so compute once."""
        if getattr(self, '_trending', None) is None:
            counts = {}
            for skills_text in self.jobs_df['Cleaned_Skills']:
                if pd.notna(skills_text):
                    for skill in skills_text.split(','):
                        skill = skill.strip().lower()
                        if len(skill) > 2:
                            counts[skill] = counts.get(skill, 0) + 1
            self._trending = [skill for skill, _ in sorted(counts.items(), key=lambda x: x[1], reverse=True)[:20]]
        return self._trending

    def get_skills_analysis(self, user_skills: List[str]) -> Dict[str, Any]:
        """Analyze user skills against job market demand"""
        if self.jobs_df.empty or not user_skills:
            return {}

        total_jobs = len(self.jobs_df)
        index = self._job_index()
        skills_demand = {}
        for skill in user_skills:
            skill_lower = skill.lower()
            levels = [level for _, skills_text, _, level, _, _ in index if skill_lower in skills_text]
            skills_demand[skill] = {
                'demand_percentage': round(len(levels) / total_jobs * 100, 2),
                'job_count': len(levels),
                'avg_experience_level': Counter(levels).most_common(1)[0][0] if levels else 'Unknown',
            }

        trending_skills = self._trending_skills()
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