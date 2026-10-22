import os
import re
from datetime import datetime
import logging
import PyPDF2

# Try to import advanced libraries, but provide fallbacks
try:
    from pdfminer.high_level import extract_text
    PDFMINER_AVAILABLE = True
except ImportError:
    PDFMINER_AVAILABLE = False

try:
    from sentence_transformers import SentenceTransformer
    from sklearn.metrics.pairwise import cosine_similarity
    ADVANCED_ML_AVAILABLE = True
except ImportError:
    ADVANCED_ML_AVAILABLE = False

try:
    import pdfplumber
    PDFPLUMBER_AVAILABLE = True
except ImportError:
    PDFPLUMBER_AVAILABLE = False

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load model only if available
model = None
if ADVANCED_ML_AVAILABLE:
    try:
        model = SentenceTransformer('all-MiniLM-L6-v2')
        logger.info("Advanced ML model loaded successfully")
    except Exception as e:
        logger.warning(f"Could not load ML model: {str(e)}")
        ADVANCED_ML_AVAILABLE = False

# ATS-friendly formatting rules
ATS_RULES = {
    'file_format': ['.pdf', '.docx', '.doc'],
    'max_file_size_mb': 5,
    'required_sections': [
        'education', 'experience', 'skills', 'contact', 'summary',
        'work history', 'employment', 'professional experience', 'certifications'
    ],
    'avoid_elements': [
        'tables', 'images', 'headers', 'footers', 'columns',
        'text boxes', 'shapes', 'watermarks'
    ],
    'preferred_fonts': [
        'arial', 'calibri', 'times new roman', 'georgia', 'verdana', 'poppins', 
    ]
}

# Industry-specific keywords for better ATS matching
INDUSTRY_KEYWORDS = {
    'software_development': [
        'agile', 'scrum', 'sprint', 'version control', 'git', 'ci/cd',
        'code review', 'unit testing', 'integration testing', 'deployment',
        'microservices', 'api', 'rest', 'graphql', 'database', 'sql', 'nosql'
    ],
    'data_science': [
        'machine learning', 'deep learning', 'data analysis', 'statistics',
        'python', 'r', 'pandas', 'numpy', 'tensorflow', 'pytorch', 'scikit-learn',
        'data visualization', 'big data', 'hadoop', 'spark', 'sql'
    ],
    'cloud_devops': [
        'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'terraform',
        'jenkins', 'ci/cd', 'monitoring', 'logging', 'infrastructure as code',
        'cloud architecture', 'microservices', 'serverless'
    ]
}

SKILLS = [
    # Programming Languages
    "python", "java", "javascript", "typescript", "c++", "c#", "go", "ruby", "php", "swift", "kotlin", "r", "sql", "bash", "rust", "scala", "perl", "matlab", "julia",
    
    # Web Development
    "react", "angular", "vue", "next.js", "node.js", "express", "django", "flask", "spring", "fastapi", "laravel", "asp.net", "graphql", "rest api", "html", "css", "sass", "bootstrap", "tailwind", "jquery",
    
    # Data Science & ML
    "tensorflow", "pytorch", "scikit-learn", "keras", "xgboost", "pandas", "numpy", "matplotlib", "seaborn", "plotly", "jupyter", "spark", "hadoop", "hive", "pyspark", "scipy", "statsmodels",
    
    # Cloud & DevOps
    "aws", "azure", "gcp", "docker", "kubernetes", "terraform", "jenkins", "gitlab ci", "github actions", "git", "linux", "ansible", "puppet", "chef", "prometheus", "grafana", "elk stack",
    
    # Databases
    "mongodb", "mysql", "postgresql", "sqlite", "redis", "cassandra", "elasticsearch", "neo4j", "dynamodb", "oracle", "sql server",
    
    # AI & ML Specialized
    "nlp", "computer vision", "deep learning", "llm", "bert", "gpt", "huggingface", "mlops", "feature engineering", "reinforcement learning", "transfer learning", "gan", "cnn", "rnn", "lstm",
    
    # Business Intelligence
    "power bi", "tableau", "looker", "qlik", "excel", "bigquery", "snowflake", "redshift", "databricks", "alteryx", "sas",
    
    # Soft Skills
    "leadership", "communication", "problem solving", "teamwork", "critical thinking", "agile", "scrum", "collaboration", "project management", "time management", "adaptability", "creativity",
    
    # Security
    "cybersecurity", "penetration testing", "security analysis", "network security", "cryptography", "siem", "soc", "vulnerability assessment",
    
    # Mobile Development
    "android", "ios", "react native", "flutter", "xamarin", "mobile app development", "swift", "kotlin",
    
    # Testing
    "unit testing", "integration testing", "end-to-end testing", "selenium", "jest", "pytest", "junit", "cypress", "test automation",
    
    # Marketing
    "SEO", "SEM", "Analytics", "Data Analysis", "Data Visualization", "Data Reporting", "Data Modeling", "Data Warehousing", "Data Integration", "Data Cleansing", "Data Transformation", "Data Loading", "Data Archiving", "Data Security", "Data Governance"
]

# Precompute skill embeddings only if ML is available
skill_embeddings = None
if ADVANCED_ML_AVAILABLE and model:
    try:
        skill_embeddings = model.encode(SKILLS)
        logger.info("Skill embeddings computed successfully")
    except Exception as e:
        logger.warning(f"Error encoding skills: {str(e)}")
        skill_embeddings = None

def extract_text_from_pdf(file_path):
    """Extract text from PDF using available methods"""
    text = ""
    
    # Try pdfplumber first (most reliable)
    if PDFPLUMBER_AVAILABLE:
        try:
            import pdfplumber
            with pdfplumber.open(file_path) as pdf:
                for page in pdf.pages:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
            if text.strip():
                return text
        except Exception as e:
            logger.warning(f"pdfplumber failed: {str(e)}")
    
    # Fallback to PyPDF2
    try:
        with open(file_path, 'rb') as file:
            pdf_reader = PyPDF2.PdfReader(file)
            
            if pdf_reader.is_encrypted:
                raise ValueError("PDF is encrypted and cannot be read")
            
            for page in pdf_reader.pages:
                try:
                    page_text = page.extract_text()
                    if page_text:
                        text += page_text + "\n"
                except Exception as e:
                    logger.warning(f"Error extracting text from page: {str(e)}")
                    continue
            
            if not text.strip():
                raise ValueError("No text could be extracted from the PDF")
            
            return text
    except Exception as e:
        logger.error(f"Error in extract_text_from_pdf: {str(e)}")
        raise

def check_ats_compatibility(text):
    """Check resume for ATS compatibility"""
    ats_score = 0
    issues = []
    found_elements = []
    
    # Check for required sections
    found_sections = []
    for section in ATS_RULES['required_sections']:
        if section.lower() in text.lower():
            found_sections.append(section)
            ats_score += 20 / len(ATS_RULES['required_sections'])
    
    if len(found_sections) < 3:
        issues.append(f"Missing important sections. Found: {', '.join(found_sections)}")
    
    # Check for industry keywords
    keyword_matches = 0
    for industry, keywords in INDUSTRY_KEYWORDS.items():
        for keyword in keywords:
            if keyword.lower() in text.lower():
                keyword_matches += 1
    
    ats_score += min(keyword_matches * 2, 30)  # Max 30 points for keywords
    
    # Check for formatting issues with more specific detection
    text_lower = text.lower()
    problematic_elements = []
    
    # Check for problematic tables (only flag complex table structures)
    table_indicators = [
        r'\|\s*[-=]+\s*\|',  # Complex table borders
        r'\+[-=]+\+',        # ASCII table borders
        r'┌[─┬┐]+',         # Unicode table borders
        r'├[─┼┤]+',         # Unicode table borders
        r'└[─┴┘]+'          # Unicode table borders
    ]
    
    has_complex_tables = any(re.search(pattern, text) for pattern in table_indicators)
    if has_complex_tables:
        problematic_elements.append('complex table structures')
    
    # Check for images (look for image file extensions)
    if any(ext in text_lower for ext in ['.jpg', '.jpeg', '.png', '.gif', '.bmp']):
        problematic_elements.append('images')
    
    # Check for problematic headers/footers
    header_footer_patterns = [
        r'page\s+\d+\s+of\s+\d+',  # Page numbers
        r'confidential',            # Confidentiality notices
        r'draft\s+copy',           # Draft notices
        r'do\s+not\s+copy',        # Copyright notices
        r'©\s+\d{4}',             # Copyright symbols
        r'page\s+\d+',             # Simple page numbers
        r'continued\s+on\s+next\s+page'  # Continuation notices
    ]
    
    has_problematic_headers = any(re.search(pattern, text_lower) for pattern in header_footer_patterns)
    if has_problematic_headers:
        problematic_elements.append('headers/footers with page numbers or notices')
    
    # Check for columns (look for column indicators)
    if any(indicator in text_lower for indicator in ['column', 'col.', 'col ']):
        problematic_elements.append('columns')
    
    # Check for text boxes (look for box indicators)
    if any(indicator in text_lower for indicator in ['box', 'textbox', 'text box']):
        problematic_elements.append('text boxes')
    
    # Check for shapes (look for shape indicators)
    if any(indicator in text_lower for indicator in ['shape', 'rectangle', 'circle', 'square']):
        problematic_elements.append('shapes')
    
    # Check for watermarks (look for watermark indicators)
    if any(indicator in text_lower for indicator in ['watermark', 'draft', 'confidential']):
        problematic_elements.append('watermarks')
    
    if problematic_elements:
        issues.append(f"Contains elements that might not parse well in ATS: {', '.join(problematic_elements)}")
        ats_score -= min(len(problematic_elements) * 5, 20)  # Deduct up to 20 points for problematic elements
    
    # Check for contact information
    contact_patterns = [
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b',  # email
        r'\b\d{3}[-.]?\d{3}[-.]?\d{4}\b',  # phone
        r'\b(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+\b'  # LinkedIn
    ]
    
    contact_info_found = any(re.search(pattern, text) for pattern in contact_patterns)
    if contact_info_found:
        ats_score += 20
    else:
        issues.append("Missing contact information")
    
    # Check for proper formatting
    if len(text.split()) < 100:
        issues.append("Resume is too short (less than 100 words)")
        ats_score -= 10
    
    # Check for proper spacing and structure
    # Count the number of section headers (common section titles)
    section_headers = ['education', 'experience', 'skills', 'work history', 'employment', 
                      'professional experience', 'summary', 'certifications']
    section_count = sum(1 for header in section_headers if header in text_lower)
    
    # Count different types of spacing
    double_breaks = text.count('\n\n')
    single_breaks = text.count('\n')
    total_breaks = double_breaks + single_breaks
    
    # Calculate average spacing between sections
    avg_spacing = total_breaks / (section_count + 1) if section_count > 0 else 0
    
    # Only flag spacing issues if there are multiple sections and very little spacing
    if section_count >= 3 and avg_spacing < 1.5:
        issues.append("Tip: Add a blank line between sections for better readability")
        ats_score -= 1  # Minimal penalty for spacing issues
    
    return {
        'score': min(max(ats_score, 0), 100),
        'issues': issues,
        'found_sections': found_sections,
        'keyword_matches': keyword_matches,
        'problematic_elements': problematic_elements if problematic_elements else []
    }

def extract_skills_simple(text):
    """Simple skill extraction using text matching"""
    found_skills = []
    text_lower = text.lower()
    
    for skill in SKILLS:
        # Check for exact match
        if skill.lower() in text_lower:
            found_skills.append(skill)
        # Check for common variations
        skill_variations = [
            skill.lower(),
            skill.lower().replace('-', ' '),
            skill.lower().replace(' ', '-'),
            skill.lower().replace(' ', '')
        ]
        if any(variation in text_lower for variation in skill_variations):
            if skill not in found_skills:
                found_skills.append(skill)
    
    return found_skills

def extract_skills_advanced(text):
    """Advanced skill extraction using ML if available"""
    if not ADVANCED_ML_AVAILABLE or not model or skill_embeddings is None:
        return extract_skills_simple(text)
    
    try:
        # Get all skills and industry keywords
        all_skills = SKILLS + [keyword for keywords in INDUSTRY_KEYWORDS.values() for keyword in keywords]
        
        # Encode skills and resume text
        resume_sentences = [s.strip() for s in text.split('.') if len(s.strip()) > 0]
        resume_embeddings = model.encode(resume_sentences)

        # Find matching skills using cosine similarity
        matched_skills = set()
        for i, skill in enumerate(all_skills):
            if i < len(skill_embeddings):
                skill_embedding = skill_embeddings[i]
                for resume_embedding in resume_embeddings:
                    similarity = cosine_similarity([skill_embedding], [resume_embedding])[0][0]
                    if similarity > 0.60:  # Lowered threshold to catch more potential skills
                        matched_skills.add(skill)
        
        # Additional check for direct text matching
        text_lower = text.lower()
        for skill in all_skills:
            # Check for exact match
            if skill.lower() in text_lower:
                matched_skills.add(skill)
            # Check for common variations
            skill_variations = [
                skill.lower(),
                skill.lower().replace('-', ' '),
                skill.lower().replace(' ', '-'),
                skill.lower().replace(' ', '')
            ]
            if any(variation in text_lower for variation in skill_variations):
                matched_skills.add(skill)
        
        return list(matched_skills)
        
    except Exception as e:
        logger.warning(f"Advanced skill extraction failed, falling back to simple: {str(e)}")
        return extract_skills_simple(text)

def extract_skills_from_resume(file_path):
    """Extract skills from resume using semantic similarity"""
    try:
        # Extract text from PDF
        text = extract_text_from_pdf(file_path)
        
        if not text.strip():
            raise ValueError("No text could be extracted from the resume")
        
        # Extract skills (use advanced if available, otherwise simple)
        if ADVANCED_ML_AVAILABLE:
            skills = extract_skills_advanced(text)
            logger.info("Used advanced skill extraction")
        else:
            skills = extract_skills_simple(text)
            logger.info("Used simple skill extraction")
        
        # Get ATS compatibility score
        ats_analysis = check_ats_compatibility(text)
        
        return {
            'skills': skills,
            'text': text,
            'ats_analysis': ats_analysis
        }
        
    except Exception as e:
        logger.error(f"Error in extract_skills_from_resume: {str(e)}")
        raise ValueError(f"Failed to analyze resume: {str(e)}")

class ResumeAnalyzer:
    """Resume analysis class for extracting skills and performing ATS analysis"""
    
    def __init__(self):
        """Initialize the resume analyzer"""
        self.logger = logging.getLogger(__name__)
        
    def analyze_resume(self, file_path):
        """
        Analyze a resume file and extract comprehensive information
        
        Args:
            file_path (str): Path to the resume file
            
        Returns:
            dict: Analysis results containing skills, experience, and other data
        """
        try:
            # Extract text from PDF
            text = extract_text_from_pdf(file_path)
            
            if not text.strip():
                raise ValueError("No text could be extracted from the resume")
            
            # Extract skills using the existing function
            skills_data = extract_skills_from_resume(file_path)
            
            # Extract experience information
            experience_summary = self._extract_experience_info(text)
            
            # Extract education information
            education_info = self._extract_education_info(text)
            
            # Extract contact information
            contact_info = self._extract_contact_info(text)
            
            # Create comprehensive analysis
            analysis_result = {
                'extracted_skills': skills_data.get('skills', []),
                'experience_summary': experience_summary,
                'education_info': education_info,
                'contact_info': contact_info,
                'ats_analysis': skills_data.get('ats_analysis', {}),
                'raw_text': text,
                'analysis_summary': {
                    'total_skills_found': len(skills_data.get('skills', [])),
                    'text_length': len(text),
                    'ats_score': skills_data.get('ats_analysis', {}).get('score', 0),
                    'has_contact_info': bool(contact_info.get('email') or contact_info.get('phone')),
                    'estimated_experience': experience_summary.get('total_years', 0)
                }
            }
            
            return analysis_result
            
        except Exception as e:
            self.logger.error(f"Error analyzing resume: {str(e)}")
            raise ValueError(f"Failed to analyze resume: {str(e)}")
    
    def _extract_experience_info(self, text):
        """Extract experience information from resume text"""
        experience_info = {
            'total_years': 0,
            'companies': [],
            'positions': [],
            'experience_level': 'Entry'
        }
        
        try:
            # Look for years of experience patterns
            experience_patterns = [
                r'(\d+)\+?\s*years?\s*(?:of\s*)?experience',
                r'experience[:\s]*(\d+)\+?\s*years?',
                r'(\d+)\+?\s*years?\s*(?:in|of)',
                r'over\s*(\d+)\s*years?',
                r'more\s*than\s*(\d+)\s*years?'
            ]
            
            for pattern in experience_patterns:
                matches = re.findall(pattern, text.lower())
                if matches:
                    years = max([int(match) for match in matches])
                    experience_info['total_years'] = years
                    break
            
            # Determine experience level based on years
            years = experience_info['total_years']
            if years == 0:
                experience_info['experience_level'] = 'Entry'
            elif years <= 2:
                experience_info['experience_level'] = 'Junior'
            elif years <= 5:
                experience_info['experience_level'] = 'Mid-level'
            elif years <= 10:
                experience_info['experience_level'] = 'Senior'
            else:
                experience_info['experience_level'] = 'Executive'
            
            # Extract company names (basic pattern matching)
            company_patterns = [
                r'(?:worked?\s*(?:at|for)|employed\s*(?:at|by))\s+([A-Z][A-Za-z\s&]+(?:Inc|LLC|Corp|Company|Ltd)?)',
                r'([A-Z][A-Za-z\s&]+(?:Inc|LLC|Corp|Company|Ltd))\s*[-–—]\s*\d{4}',
                r'\b([A-Z][A-Za-z\s&]+(?:Inc|LLC|Corp|Company|Ltd))\b'
            ]
            
            companies = set()
            for pattern in company_patterns:
                matches = re.findall(pattern, text)
                companies.update([match.strip() for match in matches if len(match.strip()) > 2])
            
            experience_info['companies'] = list(companies)[:5]  # Limit to 5 companies
            
        except Exception as e:
            self.logger.warning(f"Error extracting experience info: {str(e)}")
        
        return experience_info
    
    def _extract_education_info(self, text):
        """Extract education information from resume text"""
        education_info = {
            'degrees': [],
            'institutions': [],
            'graduation_years': []
        }
        
        try:
            # Common degree patterns
            degree_patterns = [
                r'\b(?:bachelor|master|phd|doctorate|diploma|certificate|associate)s?\s*(?:of\s*)?(?:science|arts|engineering|business|technology)?\b',
                r'\b(?:bs|ba|ms|ma|mba|phd|btech|mtech)\b',
                r'\b(?:b\.s\.|b\.a\.|m\.s\.|m\.a\.|ph\.d\.)\b'
            ]
            
            degrees = set()
            for pattern in degree_patterns:
                matches = re.findall(pattern, text.lower())
                degrees.update(matches)
            
            education_info['degrees'] = list(degrees)
            
            # Extract graduation years
            year_patterns = [
                r'(?:graduated|graduation|class\s*of)\s*(\d{4})',
                r'(\d{4})\s*[-–—]\s*(?:present|current|\d{4})',
                r'\b(19\d{2}|20\d{2})\b'
            ]
            
            years = set()
            for pattern in year_patterns:
                matches = re.findall(pattern, text)
                for year in matches:
                    year_int = int(year)
                    if 1950 <= year_int <= datetime.now().year:
                        years.add(year_int)
            
            education_info['graduation_years'] = sorted(list(years))
            
        except Exception as e:
            self.logger.warning(f"Error extracting education info: {str(e)}")
        
        return education_info
    
    def _extract_contact_info(self, text):
        """Extract contact information from resume text"""
        contact_info = {
            'email': None,
            'phone': None,
            'linkedin': None,
            'location': None
        }
        
        try:
            # Email pattern
            email_pattern = r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
            email_matches = re.findall(email_pattern, text)
            if email_matches:
                contact_info['email'] = email_matches[0]
            
            # Phone pattern
            phone_pattern = r'(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})'
            phone_matches = re.findall(phone_pattern, text)
            if phone_matches:
                contact_info['phone'] = f"({phone_matches[0][0]}) {phone_matches[0][1]}-{phone_matches[0][2]}"
            
            # LinkedIn pattern
            linkedin_pattern = r'(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[\w-]+'
            linkedin_matches = re.findall(linkedin_pattern, text.lower())
            if linkedin_matches:
                contact_info['linkedin'] = linkedin_matches[0]
            
            # Basic location pattern (city, state)
            location_pattern = r'\b([A-Z][a-z]+),\s*([A-Z]{2})\b'
            location_matches = re.findall(location_pattern, text)
            if location_matches:
                contact_info['location'] = f"{location_matches[0][0]}, {location_matches[0][1]}"
                
        except Exception as e:
            self.logger.warning(f"Error extracting contact info: {str(e)}")
        
        return contact_info
