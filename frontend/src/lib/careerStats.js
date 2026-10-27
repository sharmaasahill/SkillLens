// Dashboard statistics derived from resume history. Logic carried over from the old Home page.

export function normalizeSkills(skills) {
  if (!skills) return [];
  if (typeof skills === 'string') return skills.split(',').map((s) => s.trim()).filter(Boolean);
  if (Array.isArray(skills)) return skills.map((s) => String(s).trim()).filter(Boolean);
  if (typeof skills === 'object') return Object.values(skills).flat().map((s) => String(s).trim()).filter(Boolean);
  return [];
}

const uploadedAt = (resume) => new Date(resume.timestamp || resume.uploaded_at);

export function calculateUserStats(resumes) {
  if (!resumes || resumes.length === 0) {
    return { totalResumes: 0, averageScore: 0, topSkills: [], lastUpload: null };
  }
  const totalResumes = resumes.length;
  const averageScore = Math.round(resumes.reduce((acc, r) => acc + (r.score || 0), 0) / totalResumes);

  const counts = {};
  resumes.forEach((r) => normalizeSkills(r.skills).forEach((skill) => { counts[skill] = (counts[skill] || 0) + 1; }));
  const topSkills = Object.entries(counts).sort(([, a], [, b]) => b - a).slice(0, 5).map(([skill]) => skill);

  const lastUpload = resumes[0] ? uploadedAt(resumes[0]).toLocaleDateString() : null;
  return { totalResumes, averageScore, topSkills, lastUpload };
}

export function calculateQuickStats(resumes) {
  const totalUploads = resumes.length;
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const thisWeekUploads = resumes.filter((r) => uploadedAt(r) > oneWeekAgo).length;

  let improvementTips = [];
  if (totalUploads > 0) {
    const averageScore = Math.round(resumes.reduce((acc, r) => acc + (r.score || 0), 0) / totalUploads);
    if (averageScore < 70) {
      improvementTips = ['Add more quantified achievements', 'Include industry-specific keywords', 'Improve resume structure'];
    } else if (averageScore < 85) {
      improvementTips = ['Enhance technical skills section', 'Add more action verbs', 'Optimize for ATS compatibility'];
    } else {
      improvementTips = ['Your resume is performing well!', 'Keep updating with new skills', 'Tailor for specific job applications'];
    }
  }

  const nextGoals = [
    'Upload updated resume monthly',
    'Achieve 90+ resume score',
    'Explore salary predictions',
    'Get personalized job recommendations',
  ];
  return { totalUploads, thisWeekUploads, improvementTips, nextGoals };
}

export const PROFILE_FIELDS = [
  'full_name', 'phone_number', 'address', 'date_of_birth', 'current_work', 'current_company', 'current_location',
  'total_experience', 'linkedin_url', 'website_url', 'bio', 'skills_summary', 'education',
  'certifications', 'languages', 'achievements',
];

/** Share of profile fields filled in, plus a profile resume, as 0-100. */
export function profileCompletion(profile) {
  if (!profile) return 0;
  const items = [...PROFILE_FIELDS.map((f) => profile[f]), profile.profile_resume_filename];
  const filled = items.filter((v) => v !== null && v !== undefined && String(v).trim() !== '').length;
  return Math.round((filled / items.length) * 100);
}

export function editFormFrom(profile) {
  return PROFILE_FIELDS.reduce((form, field) => ({ ...form, [field]: profile?.[field] ?? '' }), {});
}
