import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Appear, Badge, Button, Card, Chip, EmptyState, Notice, ScoreRing, SectionTitle, Skeleton, StatTile, EASE, cx } from '../components/ui/primitives';
import { useFeedback } from '../components/ui/overlays';
import Dropzone, { pdfError } from '../components/ui/Dropzone';
import { scoreTone, tone } from '../components/ui/tones';
import { calculateQuickStats, calculateUserStats, normalizeSkills, profileCompletion } from '../lib/careerStats';
import { dateLabel, firstName, greeting } from '../lib/format';

const TOOLS = [
  {
    to: '/salary-predictor', title: 'Salary', eyebrow: 'Predict', toneName: 'green',
    text: 'Your CTC in lakhs, estimated from real Indian job postings.',
    glow: 'from-[#34c759]/40 via-[#30b0c7]/15',
  },
  {
    to: '/resume-analyzer', title: 'Resume', eyebrow: 'Analyze', toneName: 'blue',
    text: 'Optimize your resume with smart analysis.',
    glow: 'from-[#007aff]/40 via-[#5856d6]/15',
  },
  {
    to: '/job-recommender', title: 'Jobs', eyebrow: 'Match', toneName: 'purple',
    text: 'Find your perfect job match using AI.',
    glow: 'from-[#af52de]/40 via-[#ff2d55]/15',
  },
];

const GOAL_TONES = ['blue', 'green', 'orange', 'purple'];

function ToolCard({ tool, index }) {
  const navigate = useNavigate();
  const t = tone(tool.toneName);
  return (
    <motion.button
      type="button"
      onClick={() => navigate(tool.to)}
      className="group relative flex flex-col items-start overflow-hidden rounded-[24px] bg-white p-6 text-left ring-1 ring-black/[0.05] transition-shadow hover:shadow-[0_20px_50px_-20px_rgba(0,0,0,0.25)] md:p-7"
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay: 0.1 + index * 0.07 }}
      whileHover={{ y: -3 }}
    >
      <div className={cx('pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-gradient-to-br to-transparent blur-2xl transition-opacity group-hover:opacity-100', tool.glow, 'opacity-90')} />
      <p className={cx('relative text-[13px] font-semibold', t.text)}>{tool.eyebrow}</p>
      <h3 className="relative mt-1 font-display text-[24px] font-semibold tracking-tight text-ink">{tool.title}</h3>
      <p className="relative mt-1 text-[15px] leading-[1.45] text-graphite">{tool.text}</p>
      <span className={cx('relative mt-5 inline-flex items-center gap-1 text-[14px] font-medium', t.text)}>
        Open <span aria-hidden="true" className="inline-block transition-transform group-hover:translate-x-0.5">&rsaquo;</span>
      </span>
    </motion.button>
  );
}

function HistoryRow({ resume, index, onDelete, onMakePrimary }) {
  const skills = normalizeSkills(resume.skills);
  const score = Math.round(resume.score || 0);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4, ease: EASE, delay: Math.min(index, 8) * 0.04 }}
      className="grid grid-cols-[auto_1fr_auto] items-center gap-4 py-4 md:grid-cols-[36px_minmax(0,2fr)_72px_minmax(0,2.4fr)_96px_64px]"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-mist text-[13px] font-semibold text-graphite">{index + 1}</span>
      <div className="min-w-0">
        <div className="flex min-w-0 items-center gap-2">
          <p className="truncate text-[15px] font-medium text-ink" title={resume.filename}>{resume.filename}</p>
          {resume.is_primary && <Badge toneName="green" className="shrink-0">Primary</Badge>}
        </div>
        {resume.is_primary ? (
          <p className="text-[12px] text-silver">Used for salary, job matches and HR</p>
        ) : (
          <button type="button" onClick={() => onMakePrimary(resume)} className="text-[13px] text-action-link hover:underline">
            Make primary
          </button>
        )}
        <p className="text-[13px] text-silver md:hidden">{dateLabel(resume.timestamp || resume.uploaded_at)}</p>
      </div>
      <Badge toneName={scoreTone(score)} className="justify-self-end md:justify-self-start">{score}%</Badge>
      <div className="col-span-3 flex flex-wrap gap-1.5 md:col-span-1">
        {skills.slice(0, 3).map((skill) => <Chip key={skill} className="!text-[12px]">{skill}</Chip>)}
        {skills.length > 3 && <span className="self-center text-[12px] text-silver">+{skills.length - 3} more</span>}
        {skills.length === 0 && <span className="text-[13px] text-silver">No skills found</span>}
      </div>
      <span className="hidden text-[13px] text-graphite md:block">{dateLabel(resume.timestamp || resume.uploaded_at)}</span>
      <button
        type="button"
        onClick={() => onDelete(resume.id, resume.filename)}
        className="hidden rounded-full px-3 py-1 text-[13px] text-red-ink transition hover:bg-red-soft md:block"
        aria-label={`Delete ${resume.filename}`}
      >
        Delete
      </button>
      <button
        type="button"
        onClick={() => onDelete(resume.id, resume.filename)}
        className="col-span-3 justify-self-start text-[13px] text-red-ink md:hidden"
      >
        Delete
      </button>
    </motion.li>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { notify, confirm } = useFeedback();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resumeHistory, setResumeHistory] = useState([]);
  const [maxResumes, setMaxResumes] = useState(5);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const fetchResumeHistory = useCallback(async () => {
    try {
      const response = await api.get('/resume-history');
      setResumeHistory(response.data.resumes || []);
      setMaxResumes(response.data.max_resumes || 5);
    } catch (err) {
      console.error('Error fetching resume history:', err);
    }
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/profile');
        setProfile(response.data);
      } catch (err) {
        if (err.response?.status !== 401) setError('Failed to load profile data');
      } finally {
        setLoading(false);
      }
    };
    load();
    fetchResumeHistory();
  }, [fetchResumeHistory]);

  const stats = useMemo(() => calculateUserStats(resumeHistory), [resumeHistory]);
  const quick = useMemo(() => calculateQuickStats(resumeHistory), [resumeHistory]);
  const completion = profileCompletion(profile);

  const handleFile = async (file) => {
    const problem = pdfError(file);
    if (problem) { setUploadError(problem); return; }
    setUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post('/upload-resume', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (response.data.skills) {
        notify('Resume uploaded and analyzed successfully!');
        await fetchResumeHistory();
      }
    } catch (err) {
      setUploadError(errorMessage(err, 'Failed to upload resume'));
    } finally {
      setUploading(false);
    }
  };

  const handleMakePrimary = async (resume) => {
    try {
      await api.put(`/resumes/${resume.id}/primary`);
      notify(`${resume.filename} is now your primary resume`);
      await fetchResumeHistory();
    } catch (err) {
      notify(errorMessage(err, 'Could not change the primary resume'), 'error');
    }
  };

  const handleDeleteResume = async (resumeId, filename) => {
    const ok = await confirm({
      title: 'Delete this resume?',
      message: `"${filename}" and its analysis will be removed. This action cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/resume-history/${resumeId}`);
      notify('Resume deleted successfully!');
      await fetchResumeHistory();
    } catch (err) {
      notify(errorMessage(err, 'Failed to delete resume'), 'error');
    }
  };

  const name = firstName(profile?.full_name);

  return (
    <AppShell>
      <PageHeader
        eyebrow={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
        toneName="orange"
        title={loading ? 'Welcome back.' : `${greeting()}${name ? `, ${name}` : ''}.`}
        subtitle="Estimate your salary, sharpen your resume and find roles across India that fit your skills."
      />

      {error && <Notice className="mb-8">{error}</Notice>}

      <div className="grid gap-5 md:grid-cols-3">
        {TOOLS.map((tool, i) => <ToolCard key={tool.to} tool={tool} index={i} />)}
      </div>

      {/* Overview */}
      <Appear delay={0.25} className="mt-14">
        <SectionTitle eyebrow="Your dashboard" toneName="blue" title="Where things stand" />
        <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            {loading ? (
              [0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[120px]" />)
            ) : (
              <>
                <StatTile label="Total resumes" value={stats.totalResumes} toneName="blue" />
                <StatTile label="Average score" value={`${stats.averageScore}%`} toneName={scoreTone(stats.averageScore)} />
                <StatTile label="This week" value={quick.thisWeekUploads} toneName="purple" />
                <StatTile label="Last upload" value={<span className="text-[19px]">{stats.lastUpload || 'No uploads yet'}</span>} toneName="teal" />
              </>
            )}

            <Card className="col-span-2 md:col-span-4 !p-6">
              <div className="flex flex-col gap-1 md:flex-row md:items-baseline md:justify-between">
                <h3 className="font-display text-[19px] font-semibold tracking-tight">Quick resume analysis</h3>
                <p className="text-[14px] text-graphite">Upload your resume for instant AI-powered analysis and scoring</p>
              </div>
              <div className="mt-4">
                {resumeHistory.length >= maxResumes ? (
                  <p className="rounded-2xl bg-mist p-4 text-[14px] text-graphite">
                    You have {maxResumes} resumes saved, the most you can keep. Delete one below to upload another.
                  </p>
                ) : (
                  <Dropzone compact onFile={handleFile} busy={uploading} busyLabel="Analyzing..." title="Drop a resume to score it" />
                )}
              </div>
              {uploadError && <Notice className="mt-3">{uploadError}</Notice>}
            </Card>
          </div>

          <div className="flex flex-col gap-5">
            <Card className="!p-6">
              <div className="flex items-center gap-5">
                <ScoreRing value={completion} size={96} stroke={9} toneName="orange" label="complete">
                  <span className="font-display text-[24px] font-semibold leading-none tracking-tight tabular-nums">{completion}%</span>
                </ScoreRing>
                <div>
                  <h3 className="font-display text-[19px] font-semibold tracking-tight">Your profile</h3>
                  <p className="mt-1 text-[14px] leading-[1.45] text-graphite">
                    {completion >= 100 ? 'Everything recruiters look for is filled in.' : 'A complete profile helps HR teams find you.'}
                  </p>
                  <Link to="/account" className="mt-2 inline-flex items-center gap-1 text-[14px] font-medium text-orange-ink hover:underline">
                    {completion >= 100 ? 'View profile' : 'Complete profile'} <span aria-hidden="true">&rsaquo;</span>
                  </Link>
                </div>
              </div>
            </Card>

            <Card className="flex-1 !p-6">
              <h3 className="font-display text-[19px] font-semibold tracking-tight">Top skills</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                {stats.topSkills.length > 0 ? (
                  stats.topSkills.map((skill, i) => (
                    <Chip key={skill} toneName={['blue', 'purple', 'green', 'orange', 'pink'][i % 5]}>{skill}</Chip>
                  ))
                ) : (
                  <p className="text-[14px] text-graphite">Upload a resume to see your top skills</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </Appear>

      {/* Tips and goals */}
      <Appear delay={0.35} className="mt-5 grid gap-5 md:grid-cols-2">
        <Card className="!p-6">
          <h3 className="font-display text-[19px] font-semibold tracking-tight">Improvement tips</h3>
          {quick.improvementTips.length > 0 ? (
            <ul className="mt-4 space-y-3">
              {quick.improvementTips.map((tip) => (
                <li key={tip} className="flex gap-3 text-[15px] text-ink">
                  <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-orange" aria-hidden="true" />
                  {tip}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[14px] text-graphite">Tips appear after your first resume upload.</p>
          )}
        </Card>
        <Card className="!p-6">
          <h3 className="font-display text-[19px] font-semibold tracking-tight">Your next goals</h3>
          <ol className="mt-4 space-y-3">
            {quick.nextGoals.map((goal, idx) => {
              const t = tone(GOAL_TONES[idx % GOAL_TONES.length]);
              return (
                <li key={goal} className="flex items-center gap-3 text-[15px] text-ink">
                  <span className={cx('flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[13px] font-semibold', t.soft, t.text)}>{idx + 1}</span>
                  {goal}
                </li>
              );
            })}
          </ol>
        </Card>
      </Appear>

      {/* History */}
      <Appear delay={0.45} className="mt-14">
        <SectionTitle
          eyebrow="Library"
          toneName="purple"
          title="Your resumes"
          action={resumeHistory.length > 0 && (
            <div className="flex items-center gap-3">
              <span className="hidden text-[13px] text-graphite sm:inline">{resumeHistory.length} of {maxResumes} saved</span>
              <Button variant="secondary" size="sm" onClick={fetchResumeHistory}>
                Refresh
              </Button>
            </div>
          )}
        />
        <Card className="!py-2">
          {resumeHistory.length > 0 ? (
            <>
              <div className="hidden md:grid-cols-[36px_minmax(0,2fr)_72px_minmax(0,2.4fr)_96px_64px] gap-4 border-b border-black/[0.06] py-3 text-[12px] font-medium uppercase tracking-[0.06em] text-silver md:grid">
                <span />
                <span>Resume</span>
                <span>Score</span>
                <span>Skills found</span>
                <span>Date</span>
                <span />
              </div>
              <ul className="divide-y divide-black/[0.06]">
                {resumeHistory.map((resume, idx) => (
                  <HistoryRow key={resume.id} resume={resume} index={idx} onDelete={handleDeleteResume} onMakePrimary={handleMakePrimary} />
                ))}
              </ul>
            </>
          ) : (
            <EmptyState
              title="No resume uploads yet"
              action={<Button onClick={() => navigate('/resume-analyzer')}>Upload resume</Button>}
            >
              Upload a resume to get started. You can keep up to 5 and choose which one is primary.
            </EmptyState>
          )}
        </Card>
      </Appear>
    </AppShell>
  );
}

export default Dashboard;
