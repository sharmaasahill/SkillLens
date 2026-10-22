// Resume analysis rules used by the Resume Analyzer. Moved out of the page unchanged,
// so the scoring and advice stay exactly as before.

export const flattenSkills = (skills) => (Array.isArray(skills) ? skills : Object.values(skills || {}).flat());

export const wordCount = (text) => (text ? text.split(/\s+/).filter(Boolean).length : 0);

export function getScoreLabel(score) {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Needs Improvement';
}

export function calculateReadabilityScore(text) {
  if (!text) return 0;
  const sentences = text.split(/[.!?]+/).filter((s) => s.trim().length > 0);
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  const avgWordsPerSentence = words.length / sentences.length;
  if (avgWordsPerSentence <= 15) return 85;
  if (avgWordsPerSentence <= 20) return 70;
  if (avgWordsPerSentence <= 25) return 55;
  return 40;
}

const STRONG_VERBS = [
  'achieved', 'developed', 'created', 'implemented', 'improved', 'increased',
  'generated', 'managed', 'led', 'supervised', 'coordinated', 'optimized',
  'streamlined', 'enhanced', 'delivered', 'executed', 'established', 'built',
  'designed', 'launched', 'spearheaded', 'transformed', 'accelerated',
];

const WEAK_VERBS = [
  'responsible for', 'worked on', 'helped with', 'participated in',
  'involved in', 'assisted with', 'contributed to',
];

/** Verbs found by the backend scorer when available, so the page and the score always agree. */
export function verbsFor(analysis) {
  const fromServer = analysis?.ats_analysis?.action_verbs;
  if (fromServer) {
    const score = Math.max(0, Math.min(100, fromServer.strong.length * 10 - fromServer.weak.length * 5));
    return { strong: fromServer.strong, weak: fromServer.weak, score };
  }
  return analyzeActionVerbs(analysis?.text);
}

export function analyzeActionVerbs(text) {
  if (!text) return { strong: [], weak: [], score: 0 };
  const lower = text.toLowerCase();
  const strong = STRONG_VERBS.filter((verb) => lower.includes(verb));
  const weak = WEAK_VERBS.filter((verb) => lower.includes(verb));
  const score = Math.min(100, (strong.length * 10) - (weak.length * 5));
  return { strong, weak, score: Math.max(0, score) };
}

const INDUSTRIES = [
  {
    pattern: /\b(python|javascript|java|react|angular|vue|node|express|django|flask|spring|git|github|api|database|sql|nosql|mongodb|postgresql|docker|kubernetes|microservices|agile|scrum|frontend|backend|fullstack|full-stack|software|programming|coding|development)\b/,
    industry: 'Software Development & Engineering', confidence: 'High',
    advice: 'Showcase your technical projects, include GitHub profile, mention specific frameworks and programming languages, highlight problem-solving abilities.',
    keywords: ['software development', 'programming', 'coding', 'git', 'api development', 'database design', 'full-stack', 'agile methodology', 'code review', 'debugging', 'testing', 'deployment'],
  },
  {
    pattern: /\b(data|analytics|machine learning|ml|ai|artificial intelligence|python|r|sql|tableau|power bi|pandas|numpy|tensorflow|pytorch|scikit|statistics|modeling|visualization|big data|hadoop|spark|etl)\b/,
    industry: 'Data Science & Analytics', confidence: 'High',
    advice: 'Emphasize quantifiable business impact of your analyses, highlight data visualization skills, mention statistical methods and machine learning techniques.',
    keywords: ['data analysis', 'machine learning', 'statistical modeling', 'data visualization', 'predictive analytics', 'business intelligence', 'data mining', 'big data', 'statistical analysis', 'data-driven insights'],
  },
  {
    pattern: /\b(aws|azure|gcp|google cloud|cloud|devops|docker|kubernetes|terraform|jenkins|ci\/cd|ansible|monitoring|infrastructure|serverless|microservices)\b/,
    industry: 'Cloud & DevOps Engineering', confidence: 'High',
    advice: 'Highlight cloud certifications, automation achievements, infrastructure optimization, and cost savings from cloud migrations.',
    keywords: ['cloud architecture', 'devops', 'automation', 'infrastructure as code', 'ci/cd', 'monitoring', 'scalability', 'cloud migration', 'containerization', 'orchestration'],
  },
  {
    pattern: /\b(security|cybersecurity|penetration testing|ethical hacking|firewall|encryption|vulnerability|compliance|risk assessment|incident response|siem|soc)\b/,
    industry: 'Cybersecurity', confidence: 'High',
    advice: 'Emphasize security certifications, incident response experience, compliance knowledge, and risk mitigation achievements.',
    keywords: ['information security', 'threat assessment', 'vulnerability management', 'incident response', 'security compliance', 'risk management', 'penetration testing', 'security audit'],
  },
  {
    pattern: /\b(marketing|seo|sem|social media|digital marketing|content marketing|email marketing|ppc|google ads|facebook ads|analytics|conversion|campaigns|brand)\b/,
    industry: 'Digital Marketing', confidence: 'High',
    advice: 'Include specific campaign results, ROI improvements, conversion rates, and digital platform expertise.',
    keywords: ['digital marketing', 'campaign management', 'roi optimization', 'conversion rate', 'brand awareness', 'lead generation', 'content strategy', 'social media marketing', 'email marketing'],
  },
  {
    pattern: /\b(product management|product manager|roadmap|user experience|ux|ui|product strategy|stakeholder|agile|scrum|user research|product development)\b/,
    industry: 'Product Management', confidence: 'High',
    advice: 'Highlight product launches, user adoption metrics, cross-functional collaboration, and strategic product decisions.',
    keywords: ['product strategy', 'product roadmap', 'user experience', 'stakeholder management', 'product development', 'market analysis', 'user research', 'product metrics'],
  },
  {
    pattern: /\b(finance|accounting|financial analysis|budgeting|forecasting|excel|financial modeling|investment|risk management|compliance|audit|cpa|cfa)\b/,
    industry: 'Finance & Accounting', confidence: 'High',
    advice: 'Emphasize financial certifications, cost savings achieved, budget management experience, and analytical skills.',
    keywords: ['financial analysis', 'budget management', 'financial modeling', 'risk assessment', 'investment analysis', 'cost reduction', 'financial reporting', 'compliance'],
  },
  {
    pattern: /\b(sales|business development|account management|relationship building|crm|salesforce|lead generation|negotiation|revenue|quota|targets)\b/,
    industry: 'Sales & Business Development', confidence: 'High',
    advice: 'Highlight revenue achievements, quota performance, client relationship building, and business growth contributions.',
    keywords: ['sales performance', 'revenue generation', 'client relationship', 'business development', 'account management', 'lead generation', 'negotiation', 'quota achievement'],
  },
  {
    pattern: /\b(healthcare|medical|nursing|clinical|patient care|healthcare administration|medical records|hipaa|electronic health records|ehr)\b/,
    industry: 'Healthcare & Medical', confidence: 'Medium',
    advice: 'Emphasize patient care experience, medical certifications, compliance knowledge, and healthcare technology proficiency.',
    keywords: ['patient care', 'clinical experience', 'medical knowledge', 'healthcare compliance', 'patient safety', 'medical documentation', 'healthcare technology'],
  },
  {
    pattern: /\b(education|teaching|training|curriculum|learning|instruction|classroom management|educational technology|assessment)\b/,
    industry: 'Education & Training', confidence: 'Medium',
    advice: 'Highlight student outcomes, curriculum development, educational technology integration, and professional development.',
    keywords: ['curriculum development', 'instructional design', 'student assessment', 'educational technology', 'classroom management', 'learning outcomes', 'professional development'],
  },
];

const GENERAL_INDUSTRY = {
  industry: 'General Professional', confidence: 'Low',
  advice: 'Focus on leadership experience, cross-functional collaboration, problem-solving abilities, and quantifiable achievements.',
  keywords: ['leadership', 'collaboration', 'problem-solving', 'communication', 'project management', 'teamwork', 'analytical thinking', 'strategic planning'],
};

export function getIndustrySpecificAdvice(skills) {
  const skillsText = flattenSkills(skills).join(' ').toLowerCase();
  const match = INDUSTRIES.find((entry) => skillsText.match(entry.pattern));
  if (!match) return GENERAL_INDUSTRY;
  const { pattern, ...rest } = match;
  return rest;
}

const hasContactIssue = (ats) => Boolean(ats?.issues?.some((issue) => issue.toLowerCase().includes('contact')));

export function buildActionItems(analysis) {
  const words = analysis.ats_analysis?.word_count ?? wordCount(analysis.text);
  const skillCount = flattenSkills(analysis.skills).length;
  const atsScore = analysis.ats_analysis?.score || 0;
  const verbs = verbsFor(analysis);
  return [
    { task: 'Add contact information', completed: !hasContactIssue(analysis.ats_analysis), priority: 'High' },
    { task: 'Use strong action verbs', completed: verbs.strong.length >= 5, priority: 'Medium' },
    { task: 'Optimize for ATS (70+ score)', completed: atsScore >= 70, priority: 'High' },
    { task: 'Add more skills (10+ recommended)', completed: skillCount >= 10, priority: 'Medium' },
    { task: 'Ensure proper length (300-1000 words)', completed: words >= 300 && words <= 1000, priority: 'Medium' },
    { task: 'Quantify results (3+ numbers)', completed: (analysis.ats_analysis?.quantified_achievements || 0) >= 3, priority: 'High' },
    { task: 'Include standard sections', completed: (analysis.ats_analysis?.found_sections?.length || 0) >= 4, priority: 'High' },
    { task: 'Remove weak phrases', completed: verbs.weak.length === 0, priority: 'Low' },
  ];
}

export function buildRecommendations(analysis) {
  const skillCount = flattenSkills(analysis.skills).length;
  const words = analysis.ats_analysis?.word_count ?? wordCount(analysis.text);
  const atsScore = analysis.ats_analysis?.score || 0;
  const foundSections = analysis.ats_analysis?.found_sections?.length || 0;
  const keywordMatches = analysis.ats_analysis?.keyword_matches || 0;
  const recs = [];

  if (atsScore < 40) {
    recs.push({ type: 'critical', title: 'Critical ATS Issues', message: 'Your resume needs significant optimization for ATS systems. Focus on the issues listed above immediately.' });
  } else if (atsScore < 70) {
    recs.push({ type: 'warning', title: 'ATS Optimization Needed', message: 'Your resume could benefit from better ATS optimization. Address the specific issues mentioned above.' });
  }

  if (skillCount < 5) {
    recs.push({ type: 'warning', title: 'Limited Skills Detected', message: `Only ${skillCount} skills were detected. Consider adding more relevant technical and soft skills to strengthen your profile.` });
  } else if (skillCount > 30) {
    recs.push({ type: 'info', title: 'Skill Prioritization', message: `You have ${skillCount} skills listed. Consider prioritizing the most relevant skills for your target positions.` });
  }

  if (words < 150) {
    recs.push({ type: 'critical', title: 'Content Too Brief', message: `Your resume has only ${words} words. Add more details about your experience, achievements, and qualifications.` });
  } else if (words > 1000) {
    recs.push({ type: 'info', title: 'Consider Conciseness', message: `Your resume has ${words} words. Consider making it more concise while keeping key information.` });
  }

  if (foundSections < 3) {
    recs.push({ type: 'warning', title: 'Missing Key Sections', message: `Only ${foundSections} standard sections detected. Consider adding sections like Experience, Education, Skills, and Summary.` });
  }

  if (keywordMatches < 5) {
    recs.push({ type: 'warning', title: 'Low Industry Keywords', message: `Only ${keywordMatches} industry keywords found. Research job descriptions and include relevant keywords naturally.` });
  } else if (keywordMatches > 20) {
    recs.push({ type: 'success', title: 'Great Keyword Usage', message: `Excellent! ${keywordMatches} industry keywords detected. This should help with ATS systems.` });
  }

  if (hasContactIssue(analysis.ats_analysis)) {
    recs.push({ type: 'critical', title: 'Missing Contact Information', message: 'Ensure your resume includes email, phone number, and LinkedIn profile for better accessibility.' });
  }

  if (analysis.ats_analysis?.problematic_elements?.length > 0) {
    recs.push({ type: 'warning', title: 'Formatting Improvements', message: `Detected: ${analysis.ats_analysis.problematic_elements.join(', ')}. Use simple formatting for better ATS compatibility.` });
  }

  if (atsScore >= 80 && skillCount >= 10 && words >= 200 && foundSections >= 4) {
    recs.push({ type: 'success', title: 'Excellent Resume!', message: "Your resume is well-optimized with good structure, relevant skills, and ATS compatibility. You're ready to apply!" });
  } else if (atsScore >= 70 && skillCount >= 5) {
    recs.push({ type: 'success', title: 'Good Foundation', message: 'Your resume has a solid foundation. Address the minor issues above to make it even better.' });
  }

  if (recs.length === 0 || recs.every((r) => r.type === 'success')) {
    recs.push({ type: 'info', title: 'Additional Tips', message: 'Consider using stronger action verbs, adding quantified achievements, and tailoring your resume for specific job applications.' });
  }
  return recs;
}
