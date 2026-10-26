import React, { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Button, Notice, Spinner, cx } from '../components/ui/primitives';
import { useFeedback } from '../components/ui/overlays';
import { pdfError } from '../components/ui/Dropzone';
import { CountNumber, EASE, Marquee, MiniRing, Orbit, Rise, Section } from '../components/ui/studio';
import { calculateQuickStats, calculateUserStats, normalizeSkills, profileCompletion } from '../lib/careerStats';
import { dateLabel, firstName, greeting } from '../lib/format';

const TOOLS = [
  { to: '/salary-predictor', index: '01', title: 'Salary', line: 'Your CTC in lakhs, from 31,566 real Indian salaries.', a: '#34c759', b: '#30b0c7' },
  { to: '/resume-analyzer', index: '02', title: 'Resume', line: 'An ATS score, an AI coach and your market fit. Add a JD to see your fit for one job.', a: '#007aff', b: '#5856d6' },
  { to: '/job-recommender', index: '03', title: 'Jobs', line: 'Live openings ranked against your resume. Coming soon.', a: '#af52de', b: '#ff2d55' },
];

/** One tool as a full-width typographic row. Hover draws a gradient sweep under the title. */
function ToolRow({ tool, i }) {
  return (
    <Rise delay={0.05 * i}>
      <Link to={tool.to} className="group relative grid grid-cols-[auto_1fr_auto] items-center gap-6 border-b border-black/[0.07] py-8 md:gap-10 md:py-10">
        <span className="text-[13px] font-medium tabular-nums text-silver">{tool.index}</span>
        <div className="min-w-0">
          <h3 className="relative inline-block font-display text-[48px] font-semibold leading-none tracking-tighter2 text-ink md:text-[88px]">
            <span className="transition-colors duration-500 group-hover:text-transparent" style={{ backgroundImage: `linear-gradient(90deg, ${tool.a}, ${tool.b})`, WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>
              {tool.title}
            </span>
            <span className="absolute -bottom-2 left-0 h-[3px] w-full origin-left scale-x-0 rounded-full transition-transform duration-700 ease-apple group-hover:scale-x-100" style={{ background: `linear-gradient(90deg, ${tool.a}, ${tool.b})` }} />
          </h3>
          <p className="mt-4 max-w-[48ch] text-[16px] leading-[1.5] text-graphite md:text-[19px]">{tool.line}</p>
        </div>
        <span className="flex h-14 w-14 items-center justify-center rounded-full border border-black/10 text-ink transition-all duration-500 group-hover:border-transparent group-hover:text-white md:h-20 md:w-20" style={{ '--a': tool.a }}>
          <span className="absolute h-14 w-14 scale-0 rounded-full transition-transform duration-500 ease-apple group-hover:scale-100 md:h-20 md:w-20" style={{ background: `linear-gradient(135deg, ${tool.a}, ${tool.b})` }} />
          <svg viewBox="0 0 24 24" className="relative h-6 w-6 transition-transform duration-500 group-hover:-rotate-45" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            <path d="M5 12h14M13 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </Link>
    </Rise>
  );
}

/** Slim drop target: a dashed line that comes alive on drag, instead of a big box. */
function UploadLine({ onFile, busy, disabled, note }) {
  const id = useId();
  const [over, setOver] = useState(false);
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled && e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
      className={cx('group relative flex items-center gap-5 py-6', disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer')}
    >
      <input id={id} type="file" accept=".pdf,application/pdf" className="sr-only" disabled={disabled || busy}
        onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ''; }} />
      <span className={cx('relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full transition-colors', over ? 'bg-action text-white' : 'bg-ink text-white group-hover:bg-action')}>
        {busy ? <Spinner className="h-5 w-5" /> : <span className="text-[22px] leading-none">+</span>}
        {!busy && !disabled && <span className="absolute inset-0 animate-pulsering rounded-full border border-action/40" aria-hidden="true" />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[19px] font-semibold tracking-tight text-ink">{busy ? 'Reading your resume...' : over ? 'Drop to upload' : 'Add a resume'}</p>
        <p className="text-[14px] text-graphite">{note}</p>
      </div>
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-px w-full" preserveAspectRatio="none" aria-hidden="true">
        <line x1="0" y1="0.5" x2="100%" y2="0.5" stroke={over ? '#0071e3' : 'rgba(0,0,0,0.18)'} strokeWidth="1" strokeDasharray="6 6" className={over ? 'animate-ants' : ''} />
      </svg>
    </label>
  );
}

function ResumeRow({ resume, i, onDelete, onMakePrimary }) {
  const skills = normalizeSkills(resume.skills);
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min(i, 6) * 0.05 }}
      className="group grid grid-cols-[auto_1fr] items-center gap-x-5 gap-y-2 border-b border-black/[0.07] py-5 md:grid-cols-[auto_minmax(0,1.3fr)_minmax(0,1.6fr)_auto_auto]"
    >
      <MiniRing value={resume.score} size={52} stroke={4} label="ATS score" />
      <div className="min-w-0">
        <div className="flex items-center gap-2.5">
          <p className="truncate text-[16px] font-medium text-ink" title={resume.filename}>{resume.filename}</p>
          {resume.is_primary && (
            <span className="inline-flex shrink-0 items-center gap-1 text-[12px] font-semibold text-green-ink">
              <svg viewBox="0 0 12 12" className="h-3 w-3" aria-hidden="true"><path d="M6 .8l1.6 3.3 3.6.5-2.6 2.5.6 3.6L6 9l-3.2 1.7.6-3.6L.8 4.6l3.6-.5z" fill="currentColor" /></svg>
              Primary
            </span>
          )}
        </div>
        <p className="text-[13px] text-silver">{dateLabel(resume.timestamp || resume.uploaded_at)}</p>
      </div>
      <p className="col-span-2 truncate text-[14px] text-graphite md:col-span-1">
        {skills.length ? skills.slice(0, 5).join(' · ') : 'No skills found'}
        {skills.length > 5 && <span className="text-silver"> +{skills.length - 5}</span>}
      </p>
      <div className="col-span-2 flex items-center gap-4 text-[14px] md:col-span-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100 md:group-focus-within:opacity-100">
        {!resume.is_primary && (
          <button type="button" onClick={() => onMakePrimary(resume)} className="font-medium text-action-link hover:underline">Make primary</button>
        )}
        <button type="button" onClick={() => onDelete(resume)} className="text-red-ink hover:underline" aria-label={`Delete ${resume.filename}`}>Delete</button>
      </div>
      <span className="hidden text-[20px] text-silver transition-transform duration-500 group-hover:translate-x-1 md:block" aria-hidden="true">&rsaquo;</span>
    </motion.li>
  );
}

function Dashboard() {
  const navigate = useNavigate();
  const { notify, confirm } = useFeedback();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [resumes, setResumes] = useState([]);
  const [maxResumes, setMaxResumes] = useState(5);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  const fetchResumes = useCallback(async () => {
    try {
      const { data } = await api.get('/resume-history');
      setResumes(data.resumes || []);
      setMaxResumes(data.max_resumes || 5);
    } catch (err) { /* the page still works without history */ }
  }, []);

  useEffect(() => {
    api.get('/profile')
      .then((res) => setProfile(res.data))
      .catch((err) => { if (err.response?.status !== 401) setError('Failed to load profile data'); })
      .finally(() => setLoading(false));
    fetchResumes();
  }, [fetchResumes]);

  const stats = useMemo(() => calculateUserStats(resumes), [resumes]);
  const quick = useMemo(() => calculateQuickStats(resumes), [resumes]);
  const completion = profileCompletion(profile);
  const primary = resumes.find((r) => r.is_primary) || resumes[0];
  const primaryScore = Math.round(primary?.score || 0);
  const skillCount = normalizeSkills(primary?.skills).length;
  const full = resumes.length >= maxResumes;

  const handleFile = async (file) => {
    const problem = pdfError(file);
    if (problem) { setUploadError(problem); return; }
    setUploading(true);
    setUploadError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/upload-resume', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      notify('Resume added and scored');
      await fetchResumes();
    } catch (err) {
      setUploadError(errorMessage(err, 'Failed to upload resume'));
    } finally {
      setUploading(false);
    }
  };

  const makePrimary = async (resume) => {
    try {
      await api.put(`/resumes/${resume.id}/primary`);
      notify(`${resume.filename} is now your primary resume`);
      await fetchResumes();
    } catch (err) {
      notify(errorMessage(err, 'Could not change the primary resume'), 'error');
    }
  };

  const remove = async (resume) => {
    const ok = await confirm({
      title: 'Delete this resume?',
      message: `"${resume.filename}" and its analysis will be removed. This cannot be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/resume-history/${resume.id}`);
      notify('Resume deleted');
      await fetchResumes();
    } catch (err) {
      notify(errorMessage(err, 'Failed to delete resume'), 'error');
    }
  };

  const name = firstName(profile?.full_name);
  const rings = [
    { label: 'Primary resume score', value: primaryScore, a: '#007aff', b: '#5856d6' },
    { label: 'Profile complete', value: completion, a: '#ff9500', b: '#ff2d55' },
    { label: 'Skills found', value: Math.min(100, (skillCount / 25) * 100), a: '#34c759', b: '#30b0c7' },
  ];
  const nextMoves = [
    ...(primary ? [] : [{ text: 'Upload your first resume to unlock salary and job matches', to: '/resume-analyzer' }]),
    ...(completion < 100 ? [{ text: `Finish your profile. HR teams see it (${completion}% done)`, to: '/account' }] : []),
    ...(primary && primaryScore < 80 ? [{ text: `Lift your resume from ${primaryScore} to 80+. Start with the lowest scoring part`, to: '/resume-analyzer' }] : []),
    ...quick.improvementTips.slice(0, primary ? 2 : 0).map((tip) => ({ text: tip, to: '/resume-analyzer' })),
    { text: 'Check your market salary in lakhs per annum', to: '/salary-predictor' },
  ].slice(0, 4);

  return (
    <AppShell toneName="orange">
      <PageHeader
        eyebrow={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        title={loading ? 'Welcome back.' : `${greeting()}${name ? `, ${name}.` : '.'}`}
        accent={name ? 1 : 0}
        subtitle="Estimate your salary, sharpen your resume and find roles across India that fit your skills."
      />

      {error && <Notice className="mb-8">{error}</Notice>}

      {/* Where you stand */}
      <div className="grid items-center gap-12 pb-16 md:grid-cols-[auto_1fr] md:gap-20">
        <Rise className="mx-auto md:mx-0">
          <Orbit rings={rings} size={320}>
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-silver">Primary resume</p>
            <p className="mt-1 font-display text-[72px] font-semibold leading-none tracking-tighter2 text-ink">
              <CountNumber value={primaryScore} />
            </p>
            <p className="mt-1 text-[13px] text-graphite">ATS score out of 100</p>
          </Orbit>
        </Rise>
        <div className="space-y-0">
          {rings.map((ring, i) => (
            <Rise key={ring.label} delay={0.1 + i * 0.08}>
              <div className="flex items-baseline justify-between gap-6 border-b border-black/[0.07] py-5">
                <div className="flex items-center gap-3">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: `linear-gradient(135deg, ${ring.a}, ${ring.b})` }} aria-hidden="true" />
                  <span className="text-[16px] text-ink">{ring.label}</span>
                </div>
                <span className="font-display text-[32px] font-semibold tracking-tight tabular-nums text-ink">
                  {i === 2 ? <CountNumber value={skillCount} /> : <><CountNumber value={ring.value} /><span className="text-[18px] text-silver">%</span></>}
                </span>
              </div>
            </Rise>
          ))}
          <Rise delay={0.35}>
            <div className="flex flex-wrap gap-x-10 gap-y-2 pt-5 text-[14px] text-graphite">
              <span><span className="font-semibold text-ink tabular-nums">{stats.totalResumes}</span> of {maxResumes} resumes saved</span>
              <span>Average score <span className="font-semibold text-ink tabular-nums">{stats.averageScore}</span></span>
              <span><span className="font-semibold text-ink tabular-nums">{quick.thisWeekUploads}</span> this week</span>
            </div>
          </Rise>
        </div>
      </div>

      {/* Tools */}
      <div className="border-t border-black/[0.07]">
        {TOOLS.map((tool, i) => <ToolRow key={tool.to} tool={tool} i={i} />)}
      </div>

      {stats.topSkills.length > 0 && (
        <div className="-mx-6 py-14 md:py-20">
          <Marquee items={normalizeSkills(primary?.skills).slice(0, 12).length ? normalizeSkills(primary?.skills).slice(0, 12) : stats.topSkills} />
        </div>
      )}

      <Section
        index="04"
        title="Your resumes"
        note={`Keep up to ${maxResumes}. The primary one drives salary, job matches and what HR sees.`}
        aside={<p className="font-display text-[44px] font-semibold leading-none tracking-tighter2 tabular-nums text-ink">{resumes.length}<span className="text-[20px] text-silver">/{maxResumes}</span></p>}
      >
        <UploadLine
          onFile={handleFile}
          busy={uploading}
          disabled={full}
          note={full ? `You have ${maxResumes} saved, the most you can keep. Delete one to add another.` : 'Drop a PDF here or choose a file. We score it in a few seconds.'}
        />
        {uploadError && <Notice className="mt-4">{uploadError}</Notice>}
        {resumes.length > 0 ? (
          <ul>
            <AnimatePresence initial={false}>
              {resumes.map((r, i) => <ResumeRow key={r.id} resume={r} i={i} onDelete={remove} onMakePrimary={makePrimary} />)}
            </AnimatePresence>
          </ul>
        ) : (
          <p className="py-10 text-[16px] text-graphite">No resumes yet. Add one above and your scores appear here.</p>
        )}
      </Section>

      <Section index="05" title="Next moves" note="What would make the biggest difference right now.">
        <ol>
          {nextMoves.map((move, i) => (
            <Rise key={move.text} delay={i * 0.06}>
              <li>
                <button type="button" onClick={() => navigate(move.to)} className="group flex w-full items-baseline gap-6 border-b border-black/[0.07] py-5 text-left">
                  <span className="font-display text-[28px] font-semibold tabular-nums text-black/15 transition-colors group-hover:text-orange">{String(i + 1).padStart(2, '0')}</span>
                  <span className="flex-1 text-[17px] text-ink md:text-[19px]">{move.text}</span>
                  <span className="text-[20px] text-silver transition-transform duration-500 group-hover:translate-x-1" aria-hidden="true">&rsaquo;</span>
                </button>
              </li>
            </Rise>
          ))}
        </ol>
      </Section>

      <div className="flex justify-end pt-6">
        <Button variant="ghost" size="sm" onClick={fetchResumes}>Refresh</Button>
      </div>
    </AppShell>
  );
}

export default Dashboard;
