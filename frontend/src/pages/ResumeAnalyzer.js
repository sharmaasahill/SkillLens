import React, { useEffect, useId, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Button, Notice, Segmented, Skeleton, Spinner, cx } from '../components/ui/primitives';
import { Select } from '../components/ui/Select';
import { pdfError } from '../components/ui/Dropzone';
import { WRAP, breakable } from '../lib/format';
import {
  Check, CountNumber, EASE, Glass, Line, Metric, MetricRow, Rise, Section, SegmentDial, WordCloud, ratioColor, scoreColor,
} from '../components/ui/studio';
import {
  verbsFor, buildActionItems, buildRecommendations, calculateReadabilityScore,
  flattenSkills, getIndustrySpecificAdvice, getScoreLabel, wordCount,
} from '../lib/resumeInsights';
import AiCoach from '../components/resume/AiCoach';
import CoverLetter from '../components/resume/CoverLetter';
import MarketFit from '../components/resume/MarketFit';
import RecruiterChecks from '../components/resume/RecruiterChecks';

const JD_TYPES = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
const SKILL_COLORS = ['#007aff', '#5856d6', '#af52de', '#30b0c7', '#1d1d1f', '#34c759', '#ff2d55'];
const REC_COLOR = { critical: '#ff3b30', warning: '#ff9500', success: '#34c759', info: '#007aff' };

/** File picker as a single line with a pulsing mark, instead of a big dashed box. */
function FileLine({ accept, file, onFile, busy, title, note }) {
  const id = useId();
  const [over, setOver] = useState(false);
  return (
    <label
      htmlFor={id}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (e.dataTransfer.files[0]) onFile(e.dataTransfer.files[0]); }}
      className="group flex cursor-pointer items-center gap-5 border-b border-dashed border-black/20 py-5 transition-colors hover:border-action"
    >
      <input id={id} type="file" accept={accept} className="sr-only" disabled={busy} onChange={(e) => { if (e.target.files[0]) onFile(e.target.files[0]); e.target.value = ''; }} />
      <span className={cx('relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-white transition-colors', over || file ? 'bg-action' : 'bg-ink group-hover:bg-action')}>
        {busy ? <Spinner className="h-5 w-5" /> : <span className="text-[22px] leading-none">{file ? '\u2713' : '+'}</span>}
        {!busy && !file && <span className="absolute inset-0 animate-pulsering rounded-full border border-action/40" aria-hidden="true" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cx('block font-display text-[19px] font-semibold leading-[1.3] tracking-tight text-ink', WRAP)}>{file ? breakable(file.name) : over ? 'Drop to add' : title}</span>
        <span className="block text-[14px] text-graphite">{note}</span>
      </span>
    </label>
  );
}

/** How well the resume fits the pasted or uploaded job description. */
function JdMatch({ match, overall, atsScore }) {
  const parts = match.breakdown.filter((p) => p.score !== null);
  const columns = [
    ['Must-haves you have', match.must_have.matched, '#34c759'],
    ['Must-haves missing', match.must_have.missing, '#ff3b30'],
    ['Nice-to-haves you have', match.nice_to_have.matched, '#007aff'],
    ['JD words to add', match.keywords.missing, '#ff9500'],
  ].filter(([, list]) => list.length > 0);
  return (
    <>
      <Rise>
        <div className="grid grid-cols-1 items-center gap-12 pb-14 md:grid-cols-[auto_minmax(0,1fr)] md:gap-16">
          <SegmentDial size={300} parts={parts.map((p) => ({ ...p, max: p.max, score: p.score }))} toneFor={ratioColor}>
            <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-silver">JD match</p>
            <p className="font-display text-[80px] font-semibold leading-none tracking-tighter2"><CountNumber value={match.score} /></p>
            <p className="mt-1 text-[13px] font-medium" style={{ color: scoreColor(match.score) }}>{match.verdict}</p>
          </SegmentDial>
          <div>
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-blue-ink">Fit for this role</p>
            <h2 className="mt-3 font-display text-[36px] font-semibold leading-[1.08] tracking-tight md:text-[48px]">{match.job_title || 'This job description'}</h2>
            <p className="mt-4 text-[17px] text-graphite">
              Overall <span className="font-semibold text-ink tabular-nums">{Math.round(overall)}</span>, from 60% fit for this job and 40% resume quality (ATS {Math.round(atsScore)}).
            </p>
            <div className="mt-8 space-y-4">
              {parts.map((p, i) => (
                <div key={p.key} className="grid grid-cols-[130px_1fr_64px] items-center gap-4">
                  <span className="text-[14px] text-ink">{p.label}</span>
                  <Line value={p.max ? (p.score / p.max) * 100 : 0} color={ratioColor(p.max ? p.score / p.max : 0)} delay={i * 0.08} />
                  <span className="text-right text-[13px] tabular-nums text-graphite">{p.score}/{p.max}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Rise>
      {columns.length > 0 && (
        <Section index="JD" title="Skills against the JD" note="Must-haves count double in the match score.">
          <div className="grid gap-10 sm:grid-cols-2">
            {columns.map(([title, list, color]) => (
              <div key={title}>
                <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-ink"><span className="h-2 w-2 rounded-full" style={{ background: color }} />{title}</p>
                <WordCloud words={list} colorFor={() => color} />
              </div>
            ))}
          </div>
        </Section>
      )}
      {match.suggestions.length > 0 && (
        <Section index="JD" title="To raise your chances" note="Specific to this job description.">
          <ol>
            {match.suggestions.map((tip, i) => (
              <li key={tip} className="flex gap-6 border-b border-black/[0.07] py-5">
                <span className="font-display text-[24px] font-semibold tabular-nums text-black/15">{String(i + 1).padStart(2, '0')}</span>
                <span className="text-[17px] leading-[1.5] text-ink">{tip}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}
    </>
  );
}

// One colour per area of the skill map
const AREA_COLORS = {
  'Programming languages': '#007aff', Backend: '#5856d6', Frontend: '#af52de', Mobile: '#ff2d55', Databases: '#30b0c7',
  Cloud: '#ff9500', 'DevOps & infrastructure': '#34c759', 'Testing & QA': '#248a3d', 'APIs & security': '#d70015',
  'AI & machine learning': '#8944ab', 'Data & analytics': '#0071a4', Design: '#ff2d55',
};

/** Skills grouped by area. How strongly a skill is set shows how often the resume mentions it. */
function SkillMap({ groups }) {
  return (
    <div>
      {groups.map((group, gi) => (
        <Rise key={group.category} delay={Math.min(gi, 8) * 0.04} amount={0.1}>
          <div className="grid gap-3 border-b border-black/[0.06] py-5 first:pt-0 last:border-0 md:grid-cols-[210px_minmax(0,1fr)] md:gap-8">
            <p className="flex items-baseline gap-2.5 pt-1 text-[13px] font-semibold text-ink">
              <span className="h-2 w-2 shrink-0 self-center rounded-full" style={{ background: AREA_COLORS[group.category] || '#86868b' }} aria-hidden="true" />
              {group.category}
              <span className="font-medium tabular-nums text-silver">{group.skills.length}</span>
            </p>
            <ul className="flex flex-wrap gap-x-5 gap-y-1.5">
              {group.skills.map((skill) => (
                <li
                  key={skill.name}
                  title={`Mentioned ${skill.mentions} time${skill.mentions === 1 ? '' : 's'}`}
                  className={cx(
                    'font-display text-[18px] tracking-tight md:text-[19px]',
                    skill.mentions >= 3 ? 'font-semibold text-ink' : skill.mentions === 2 ? 'font-medium text-ink/80' : 'text-ink/55'
                  )}
                >
                  {skill.name}
                </li>
              ))}
            </ul>
          </div>
        </Rise>
      ))}
    </div>
  );
}

function Results({ analysis, fileName, jd }) {
  const ats = analysis.ats_analysis || {};
  const score = ats.score ?? 0;
  const skills = flattenSkills(analysis.skills);
  const words = ats.word_count ?? wordCount(analysis.text);
  const readability = calculateReadabilityScore(analysis.text);
  const verbs = verbsFor(analysis);
  const industry = getIndustrySpecificAdvice(analysis.skills);
  const actionItems = buildActionItems(analysis);
  const done = actionItems.filter((i) => i.completed);
  const recommendations = buildRecommendations(analysis);

  return (
    <>
      <Rise>
        <div className="grid grid-cols-1 items-center gap-12 pb-14 md:grid-cols-[auto_minmax(0,1fr)] md:gap-16">
          {ats.breakdown?.length > 0 && (
            <SegmentDial size={300} parts={ats.breakdown} toneFor={ratioColor}>
              <p className="text-[12px] font-medium uppercase tracking-[0.12em] text-silver">ATS score</p>
              <p className="font-display text-[80px] font-semibold leading-none tracking-tighter2"><CountNumber value={score} /></p>
              <p className="mt-1 text-[13px] font-medium" style={{ color: scoreColor(score) }}>{getScoreLabel(score)}</p>
            </SegmentDial>
          )}
          <div>
            <p className={cx('text-[14px] text-graphite', WRAP)}>{breakable(fileName)}</p>
            <h2 className="mt-2 font-display text-[36px] font-semibold leading-[1.08] tracking-tight md:text-[48px]">
              {ats.issues?.length ? `${ats.issues.length} things to fix.` : 'Nothing major to fix.'}
            </h2>
            <ul className="mt-6">
              {(ats.issues || []).slice(0, 5).map((issue, i) => (
                <motion.li key={issue} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.07, duration: 0.5, ease: EASE }}
                  className="flex gap-3 border-b border-black/[0.07] py-3 text-[15px] leading-[1.5] text-ink">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-orange" aria-hidden="true" />{issue}
                </motion.li>
              ))}
            </ul>
            {ats.found_sections?.length > 0 && (
              <p className="mt-4 text-[14px] text-graphite">Sections found: <span className="text-ink">{ats.found_sections.join(', ')}</span></p>
            )}
          </div>
        </div>
      </Rise>

      <AiCoach resumeId={analysis.id} jd={jd} status={analysis.ai} />

      <CoverLetter resumeId={analysis.id} jd={jd} status={analysis.ai} />

      {ats.breakdown?.length > 0 && (
        <Section index="01" title="How the score adds up" note="Seven parts, 100 points. Each arc of the dial is one part.">
          <div className="space-y-6">
            {ats.breakdown.map((part, i) => {
              const ratio = part.max ? part.score / part.max : 0;
              return (
                <div key={part.key}>
                  <div className="mb-2 flex items-baseline justify-between gap-4">
                    <span className="text-[16px] font-medium text-ink">{part.label}</span>
                    <span className="text-[14px] tabular-nums text-graphite"><span className="font-semibold" style={{ color: ratioColor(ratio) }}>{part.score}</span> / {part.max}</span>
                  </div>
                  <Line value={ratio * 100} color={ratioColor(ratio)} delay={i * 0.06} />
                  <p className="mt-1.5 text-[13px] text-silver">{part.detail}</p>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      <Section index="02" title="By the numbers">
        <MetricRow>
          <Metric label="Words" value={words} hint={words < 300 ? 'Add more detail' : words > 1000 ? 'Trim it down' : 'Good length'} toneName="blue" />
          <Metric label="Sections" value={ats.found_sections?.length || 0} hint="of 5 standard" toneName="green" />
          <Metric label="Keywords" value={ats.keyword_matches || 0} hint="industry terms" toneName="purple" />
          <Metric label="Readability" value={readability} hint={readability >= 80 ? 'Very readable' : readability >= 60 ? 'Readable' : 'Simplify sentences'} toneName="orange" />
        </MetricRow>
      </Section>

      {skills.length > 0 && (
        <Section
          index="03"
          title="Skills we found"
          note={analysis.skill_groups?.length
            ? `${skills.length} skills in ${analysis.skill_groups.length} areas. Darker ones come up more often in your resume.`
            : `${skills.length} recognised. Recruiters search for these exact words.`}
        >
          {analysis.skill_groups?.length
            ? <SkillMap groups={analysis.skill_groups} />
            : <WordCloud words={skills} colorFor={(w, i) => SKILL_COLORS[i % SKILL_COLORS.length]} />}
        </Section>
      )}

      <MarketFit resumeId={analysis.id} index="04" />

      <RecruiterChecks checks={analysis.checks} index="05" />

      <Section index="06" title="Language" note={`Action verbs ${verbs.score}/100. Strong verbs show ownership; weak phrases hide it.`}>
        <div className="grid gap-10 md:grid-cols-2">
          <div>
            <p className="mb-3 text-[13px] font-semibold text-green-ink">Strong verbs you used</p>
            {verbs.strong.length ? <WordCloud words={verbs.strong.slice(0, 14)} colorFor={() => '#248a3d'} /> : <p className="text-[15px] text-graphite">None yet. Start bullets with led, built or reduced.</p>}
          </div>
          <div>
            <p className="mb-3 text-[13px] font-semibold text-red-ink">Weak phrases to replace</p>
            {verbs.weak.length ? <WordCloud words={verbs.weak.slice(0, 8)} colorFor={() => '#d70015'} /> : <p className="text-[15px] text-graphite">None found.</p>}
          </div>
        </div>
        <div className="mt-10 border-t border-black/[0.07] pt-8">
          <p className="text-[13px] text-graphite">Reads like <span className="font-medium text-ink">{industry.industry}</span> ({industry.confidence.toLowerCase()} confidence)</p>
          <p className="mt-2 max-w-[70ch] text-[16px] leading-[1.55] text-ink">{industry.advice}</p>
          <p className="mt-3 text-[14px] text-graphite">Worth including where true: <span className="text-ink">{industry.keywords.join(', ')}</span></p>
        </div>
      </Section>

      <Section index="07" title="Checklist" aside={<p className="font-display text-[44px] font-semibold leading-none tracking-tighter2 tabular-nums">{done.length}<span className="text-[20px] text-silver">/{actionItems.length}</span></p>}>
        <ul>
          {actionItems.map((item, i) => (
            <Rise key={item.task} delay={i * 0.03}>
              <li className="flex items-center gap-4 border-b border-black/[0.07] py-4">
                <Check done={item.completed} />
                <span className={cx('flex-1 text-[16px]', item.completed ? 'text-graphite line-through decoration-black/20' : 'text-ink')}>{item.task}</span>
                {!item.completed && <span className={cx('text-[12px] font-medium', item.priority === 'High' ? 'text-red-ink' : item.priority === 'Medium' ? 'text-orange-ink' : 'text-blue-ink')}>{item.priority}</span>}
              </li>
            </Rise>
          ))}
        </ul>
      </Section>

      {recommendations.length > 0 && (
        <Section index="08" title="Recommendations">
          <ol>
            {recommendations.map((rec, i) => (
              <Rise key={rec.title} delay={i * 0.05}>
                <li className="grid grid-cols-[auto_1fr] gap-6 border-b border-black/[0.07] py-6">
                  <span className="mt-2 h-2.5 w-2.5 rounded-full" style={{ background: REC_COLOR[rec.type] || '#007aff' }} aria-hidden="true" />
                  <div>
                    <p className="font-display text-[21px] font-semibold tracking-tight text-ink">{rec.title}</p>
                    <p className="mt-1 max-w-[70ch] text-[16px] leading-[1.55] text-graphite">{rec.message}</p>
                  </div>
                </li>
              </Rise>
            ))}
          </ol>
        </Section>
      )}
    </>
  );
}

function ResumeAnalyzer() {
  const location = useLocation();
  const navigate = useNavigate();
  const [library, setLibrary] = useState({ resumes: [], max: 5 });
  // A job sent from the Jobs page ("Check my resume for this job")
  const [fromJob, setFromJob] = useState(null);
  const [source, setSource] = useState('upload'); // 'upload' | 'saved'
  const [savedId, setSavedId] = useState('');
  const [file, setFile] = useState(null);
  const [makePrimary, setMakePrimary] = useState(false);
  const [jdMode, setJdMode] = useState('none'); // 'none' | 'paste' | 'upload'
  const [jdText, setJdText] = useState('');
  const [jdFile, setJdFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [fileName, setFileName] = useState('');
  // The job description used for the shown analysis, so the AI review compares against the same one
  const [analysisJd, setAnalysisJd] = useState(null);
  const [runCount, setRunCount] = useState(0);

  const loadLibrary = async () => {
    try {
      const { data } = await api.get('/resume-history');
      const resumes = data.resumes || [];
      setLibrary({ resumes, max: data.max_resumes || 5 });
      if (resumes.length) {
        setSource((s) => (s === 'upload' && !file ? 'saved' : s));
        setSavedId((id) => id || String(data.primary_id || resumes[0].id));
      }
    } catch (err) { /* the upload path still works */ }
  };
  useEffect(() => { loadLibrary(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const jd = location.state?.jd;
    if (!jd?.text) return;
    setJdMode('paste');
    setJdText(jd.text);
    setFromJob({ title: jd.title, company: jd.company });
    // Clear it from the history entry, so a reload does not fill it in again
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const full = library.resumes.length >= library.max;
  const jdWords = jdText.trim() ? jdText.trim().split(/\s+/).length : 0;
  const hasJd = (jdMode === 'paste' && jdWords > 0) || (jdMode === 'upload' && jdFile);

  const pickResume = (picked) => {
    const problem = pdfError(picked);
    if (problem) { setError(problem); setFile(null); return; }
    setFile(picked);
    setError('');
  };
  const pickJd = (picked) => {
    if (!JD_TYPES.includes(picked.type) && !/\.(pdf|docx|txt)$/i.test(picked.name)) { setError('Upload the job description as PDF, DOCX or TXT'); return; }
    if (picked.size > 5 * 1024 * 1024) { setError('The job description file should be under 5 MB'); return; }
    setJdFile(picked);
    setError('');
  };

  const handleAnalyze = async () => {
    if (source === 'upload' && !file) { setError('Choose a PDF resume first'); return; }
    if (source === 'saved' && !savedId) { setError('Choose a saved resume'); return; }
    if (jdMode === 'paste' && jdWords > 0 && jdWords < 15) { setError('Paste the full job description (at least 15 words), or choose No JD'); return; }
    setBusy(true);
    setError('');
    setAnalysis(null);
    const formData = new FormData();
    if (jdMode === 'paste' && jdWords) formData.append('jd_text', jdText.trim());
    if (jdMode === 'upload' && jdFile) formData.append('jd_file', jdFile);
    try {
      let response;
      if (source === 'upload') {
        formData.append('file', file);
        if (makePrimary) formData.append('make_primary', 'true');
        response = await api.post('/upload-resume', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
        setFile(null);
        setMakePrimary(false);
        await loadLibrary();
        setSavedId(String(response.data.id));
      } else {
        response = await api.post(`/resumes/${savedId}/analyze`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      }
      setAnalysis(response.data);
      setFileName(response.data.filename || '');
      setAnalysisJd({ text: jdMode === 'paste' && jdWords ? jdText.trim() : '', file: jdMode === 'upload' ? jdFile : null });
      setRunCount((n) => n + 1);
      setTimeout(() => document.getElementById('results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 200);
    } catch (err) {
      setError(errorMessage(err, 'Analysis failed'));
    } finally {
      setBusy(false);
    }
  };

  const resumeOptions = library.resumes.map((r) => ({
    value: String(r.id),
    // Zero-width spaces after _ . - let long file names wrap at sensible points
    label: `${breakable(r.filename)}${r.is_primary ? ' (primary)' : ''} · ATS ${Math.round(r.score || 0)}`,
  }));

  return (
    <AppShell toneName="blue">
      <PageHeader
        eyebrow="Resume"
        title="Read like a recruiter. Scored like a machine."
        accent={3}
        subtitle="Score any of your resumes the way applicant tracking systems read them. Add a job description to see how well it fits that exact role."
      />

      {fromJob && (
        <Notice toneName="blue" className="mb-6">
          The job description for <span className="font-medium">{fromJob.title}{fromJob.company ? ` at ${fromJob.company}` : ''}</span> is filled in below.
          Pick a resume and press Analyze to see how well it fits, then write a cover letter for it.
        </Notice>
      )}

      <Glass innerClassName="!p-0">
        <div className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-black/[0.07]">
          <div className="p-6 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-blue-ink">01 · Resume</p>
              {library.resumes.length > 0 && (
                <Segmented label="Resume source" value={source} onChange={(v) => { setSource(v); setError(''); }}
                  options={[{ value: 'saved', label: 'Saved' }, { value: 'upload', label: 'New upload' }]} />
              )}
            </div>
            <div className="mt-6">
              {source === 'saved' ? (
                <>
                  <p className="font-display text-[24px] font-semibold leading-[1.6] tracking-tight text-black/35">
                    Analyze <Select variant="inline" value={savedId} onChange={(e) => setSavedId(e.target.value)} options={resumeOptions} />
                  </p>
                  <p className="mt-3 text-[14px] text-graphite">Saved resumes are re-scored with the latest rules, without uploading again.</p>
                </>
              ) : full ? (
                <Notice toneName="orange">
                  You have {library.max} resumes saved, the most you can keep. Delete one on the <Link to="/dashboard" className="underline">overview</Link>, or analyze a saved one.
                </Notice>
              ) : (
                <>
                  <FileLine accept=".pdf,application/pdf" file={file} onFile={pickResume} busy={busy && source === 'upload'} title="Add a PDF resume" note="Drop it here or choose a file, up to 5 MB" />
                  {library.resumes.length > 0 && (
                    <label className="mt-4 flex items-center gap-2.5 text-[14px] text-ink">
                      <input type="checkbox" checked={makePrimary} onChange={(e) => setMakePrimary(e.target.checked)} className="h-4 w-4 accent-[#0071e3]" />
                      Make this my primary resume
                    </label>
                  )}
                  <p className="mt-2 text-[13px] text-silver">Saved to your library ({library.resumes.length} of {library.max}).</p>
                </>
              )}
            </div>
          </div>

          <div className="border-t border-black/[0.07] p-6 md:border-t-0 md:p-10">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-blue-ink">02 · Job description <span className="font-normal normal-case tracking-normal text-silver">optional</span></p>
              <Segmented label="Job description" value={jdMode} onChange={(v) => { setJdMode(v); setError(''); }}
                options={[{ value: 'none', label: 'None' }, { value: 'paste', label: 'Paste' }, { value: 'upload', label: 'Upload' }]} />
            </div>
            <div className="mt-6">
              {jdMode === 'none' && (
                <p className="text-[16px] leading-[1.6] text-graphite">
                  Without a JD you get a general ATS score. Add the posting you are applying for to also see your match, the must-have skills you are missing and the words to add.
                </p>
              )}
              {jdMode === 'paste' && (
                <div>
                  <textarea
                    rows={7} value={jdText} onChange={(e) => setJdText(e.target.value)} maxLength={20000}
                    placeholder="Paste the full posting: role, responsibilities and requirements"
                    aria-label="Job description"
                    className="block w-full resize-y border-0 border-b border-black/15 bg-transparent p-0 pb-3 text-[16px] leading-[1.6] text-ink placeholder:text-silver focus:border-action focus:outline-none focus:ring-0"
                  />
                  <p className="mt-2 text-[12px] tabular-nums text-silver">{jdWords} words</p>
                </div>
              )}
              {jdMode === 'upload' && (
                <FileLine accept=".pdf,.docx,.txt,application/pdf,text/plain" file={jdFile} onFile={pickJd} title="Add the job description" note="PDF, DOCX or TXT, up to 5 MB" />
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4 border-t border-black/[0.07] p-6 md:flex-row md:items-center md:justify-between md:px-10">
          {error ? <Notice className="md:flex-1">{error}</Notice> : <p className="text-[14px] text-graphite">{hasJd ? 'You will get an ATS score and a match score for this job.' : 'You will get an ATS score with every lost point explained.'}</p>}
          <Button size="lg" onClick={handleAnalyze} loading={busy} disabled={busy || (source === 'upload' && (!file || full))} className="min-w-[220px]">
            {busy ? 'Analyzing...' : hasJd ? 'Analyze against JD' : 'Analyze resume'}
          </Button>
        </div>
      </Glass>

      <div id="results" className="scroll-mt-24 pt-20">
        <AnimatePresence mode="wait">
          {busy ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="grid items-center gap-12 md:grid-cols-[300px_1fr]">
              <Skeleton className="h-[300px] !rounded-full" />
              <div className="space-y-4"><Skeleton className="h-10 w-2/3" /><Skeleton className="h-5" /><Skeleton className="h-5 w-5/6" /><Skeleton className="h-5 w-4/6" /></div>
            </motion.div>
          ) : analysis ? (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {analysis.jd_match && (
                <>
                  <JdMatch match={analysis.jd_match} overall={analysis.overall_score} atsScore={analysis.ats_analysis?.score || 0} />
                  <div className="my-16 flex items-center gap-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-silver">
                    <span className="h-px flex-1 bg-black/[0.08]" />Resume quality<span className="h-px flex-1 bg-black/[0.08]" />
                  </div>
                </>
              )}
              <Results key={runCount} analysis={analysis} fileName={fileName} jd={analysisJd} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

export default ResumeAnalyzer;
