import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Appear, Badge, Button, Card, Chip, Meter, Notice, ScoreRing, SectionTitle, Segmented, SelectField, Skeleton, TextArea, cx } from '../components/ui/primitives';
import Dropzone, { pdfError } from '../components/ui/Dropzone';
import { scoreTone, tone } from '../components/ui/tones';
import {
  verbsFor, buildActionItems, buildRecommendations, calculateReadabilityScore,
  flattenSkills, getIndustrySpecificAdvice, getScoreLabel, wordCount,
} from '../lib/resumeInsights';

const SKILL_TONES = ['blue', 'purple', 'teal', 'green', 'indigo', 'pink', 'orange'];
const PRIORITY_TONE = { High: 'red', Medium: 'orange', Low: 'blue' };
const REC_STYLE = {
  critical: { toneName: 'red' },
  warning: { toneName: 'orange' },
  success: { toneName: 'green' },
  info: { toneName: 'blue' },
};

function QualityTile({ value, label, hint, toneName, delay }) {
  const t = tone(toneName);
  return (
    <Appear delay={delay}>
      <div className={cx('h-full rounded-[20px] p-5', t.soft)}>
        <p className={cx('font-display text-[36px] font-semibold leading-none tracking-tight tabular-nums', t.text)}>{value}</p>
        <p className="mt-2 text-[14px] font-medium text-ink">{label}</p>
        <p className="mt-0.5 text-[12px] text-graphite">{hint}</p>
      </div>
    </Appear>
  );
}

function Results({ analysis, fileName }) {
  const ats = analysis.ats_analysis;
  const score = ats?.score ?? 0;
  const skills = flattenSkills(analysis.skills);
  const words = ats?.word_count ?? wordCount(analysis.text);
  const sections = ats?.found_sections?.length || 0;
  const keywords = ats?.keyword_matches || 0;
  const readability = calculateReadabilityScore(analysis.text);
  const verbs = verbsFor(analysis);
  const industry = getIndustrySpecificAdvice(analysis.skills);
  const actionItems = buildActionItems(analysis);
  const done = actionItems.filter((i) => i.completed);
  const pending = actionItems.filter((i) => !i.completed);
  const recommendations = buildRecommendations(analysis);

  return (
    <div className="space-y-6">
      {/* Score */}
      {ats && (
        <Appear>
          <Card className="relative overflow-hidden">
            <div className={cx('pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full opacity-60 blur-3xl', tone(scoreTone(score)).bg)} style={{ opacity: 0.12 }} />
            <div className="relative grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
              <ScoreRing value={score} size={168} stroke={12} toneName={scoreTone(score)} label="out of 100">
                <span className="font-display text-[48px] font-semibold leading-none tracking-tight tabular-nums">{Math.round(score)}</span>
              </ScoreRing>
              <div>
                <p className="text-[14px] text-graphite">{fileName}</p>
                <h2 className="mt-2 font-display text-[32px] font-semibold tracking-tight">ATS compatibility: {getScoreLabel(score)}</h2>
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[13px] font-semibold text-green-ink">Strengths</p>
                    <ul className="space-y-2 text-[14px] text-ink">
                      {ats.found_sections?.length > 0 && (
                        <li className="flex gap-2.5"><span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-green" aria-hidden="true" />Found {ats.found_sections.length} required sections: {ats.found_sections.join(', ')}</li>
                      )}
                      {ats.keyword_matches > 10 && (
                        <li className="flex gap-2.5"><span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-green" aria-hidden="true" />Contains {ats.keyword_matches} industry keywords</li>
                      )}
                      {ats.problematic_elements?.length === 0 && (
                        <li className="flex gap-2.5"><span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-green" aria-hidden="true" />No problematic formatting elements detected</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-[13px] font-semibold text-red-ink">Areas for improvement</p>
                    {ats.issues?.length > 0 ? (
                      <ul className="space-y-2 text-[14px] text-ink">
                        {ats.issues.map((issue) => (
                          <li key={issue} className="flex gap-2.5"><span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-orange" aria-hidden="true" />{issue}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-[14px] text-green-ink">No major issues detected!</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </Appear>
      )}

      {/* Score breakdown */}
      {ats?.breakdown?.length > 0 && (
        <Appear delay={0.05}>
          <Card>
            <SectionTitle eyebrow="How the score adds up" toneName="blue" title="Score breakdown" />
            <div className="grid gap-x-10 gap-y-5 md:grid-cols-2">
              {ats.breakdown.map((part, i) => {
                const ratio = part.max ? (part.score / part.max) * 100 : 0;
                const partTone = ratio >= 80 ? 'green' : ratio >= 50 ? 'orange' : 'red';
                return (
                  <div key={part.key}>
                    <div className="mb-1.5 flex items-baseline justify-between gap-3">
                      <span className="text-[15px] font-medium text-ink">{part.label}</span>
                      <span className="text-[14px] text-graphite tabular-nums">
                        <span className={cx('font-semibold', tone(partTone).text)}>{part.score}</span> / {part.max}
                      </span>
                    </div>
                    <Meter value={ratio} toneName={partTone} delay={i * 0.06} />
                    <p className="mt-1 text-[12px] text-silver">{part.detail}</p>
                  </div>
                );
              })}
            </div>
          </Card>
        </Appear>
      )}

      {/* Quality metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <QualityTile delay={0.05} toneName="blue" value={words} label="Total words"
          hint={words < 300 ? 'Consider adding more detail' : words > 1000 ? 'Consider being more concise' : 'Good length'} />
        <QualityTile delay={0.1} toneName="green" value={sections} label="Sections detected"
          hint={sections >= 4 ? 'Well structured' : 'Add more sections'} />
        <QualityTile delay={0.15} toneName="purple" value={keywords} label="Industry keywords"
          hint={keywords >= 15 ? 'Excellent keyword usage' : keywords >= 5 ? 'Good keyword usage' : 'Add more keywords'} />
        <QualityTile delay={0.2} toneName="orange" value={readability} label="Readability score"
          hint={readability >= 80 ? 'Very readable' : readability >= 60 ? 'Good readability' : 'Improve clarity'} />
      </div>

      {/* Skills */}
      {analysis.skills && (
        <Appear delay={0.1}>
          <Card>
            <SectionTitle eyebrow={`${skills.length} detected`} toneName="blue" title="Skills analysis" />
            {Array.isArray(analysis.skills) ? (
              <div className="flex flex-wrap gap-2">
                {analysis.skills.map((skill, i) => (
                  <motion.span key={skill} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(i, 30) * 0.02 }}>
                    <Chip toneName={SKILL_TONES[i % SKILL_TONES.length]}>{skill}</Chip>
                  </motion.span>
                ))}
              </div>
            ) : (
              <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
                {Object.entries(analysis.skills).map(([category, list], ci) => (
                  <div key={category} className="rounded-2xl bg-mist p-4">
                    <p className="mb-3 text-[14px] font-semibold">{category}</p>
                    <div className="flex flex-wrap gap-2">
                      {list.map((skill) => <Chip key={skill} toneName={SKILL_TONES[ci % SKILL_TONES.length]}>{skill}</Chip>)}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-5 rounded-2xl bg-blue-soft px-4 py-3 text-[14px] text-blue-ink">
              <strong>Tip:</strong> Total of {skills.length} skills detected. Consider highlighting your most relevant skills for the positions you're targeting.
            </p>
          </Card>
        </Appear>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Action verbs */}
        <Appear delay={0.1}>
          <Card className="h-full">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="font-display text-[21px] font-semibold tracking-tight">Action verbs</h2>
              <Badge toneName={scoreTone(verbs.score)}>{verbs.score}/100</Badge>
            </div>
            {verbs.strong.length > 0 && (
              <div className="mb-5">
                <p className="mb-2 text-[13px] font-medium text-green-ink">Strong action verbs found</p>
                <div className="flex flex-wrap gap-1.5">
                  {verbs.strong.slice(0, 8).map((verb) => <Chip key={verb} toneName="green">{verb}</Chip>)}
                  {verbs.strong.length > 8 && <Chip>+{verbs.strong.length - 8} more</Chip>}
                </div>
              </div>
            )}
            {verbs.weak.length > 0 && (
              <div>
                <p className="mb-2 text-[13px] font-medium text-red-ink">Weak phrases to replace</p>
                <div className="flex flex-wrap gap-1.5">
                  {verbs.weak.slice(0, 5).map((phrase) => <Chip key={phrase} toneName="red">{phrase}</Chip>)}
                </div>
              </div>
            )}
            {verbs.strong.length === 0 && verbs.weak.length === 0 && (
              <p className="text-[14px] text-graphite">Add more action verbs to strengthen your resume!</p>
            )}
          </Card>
        </Appear>

        {/* Industry */}
        <Appear delay={0.15}>
          <Card className="h-full">
            <h2 className="mb-5 font-display text-[21px] font-semibold tracking-tight">Industry</h2>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-[19px] font-semibold text-indigo-ink">{industry.industry}</p>
              <Badge toneName={industry.confidence === 'High' ? 'green' : industry.confidence === 'Medium' ? 'orange' : 'gray'}>
                {industry.confidence} confidence
              </Badge>
            </div>
            <p className="mt-3 text-[14px] leading-[1.55] text-graphite">{industry.advice}</p>
            <p className="mt-5 text-[13px] font-medium">Recommended keywords</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {industry.keywords.map((k) => <Chip key={k} toneName="purple">{k}</Chip>)}
            </div>
            <p className="mt-3 text-[12px] text-silver">Consider including these industry-relevant terms naturally in your resume.</p>
          </Card>
        </Appear>
      </div>

      {/* Checklist */}
      <Appear delay={0.1}>
        <Card>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-[21px] font-semibold tracking-tight">Action items</h2>
            <div className="flex items-center gap-3">
              <div className="h-2 w-40 overflow-hidden rounded-full bg-[#e8e8ed]">
                <motion.div className="h-full rounded-full bg-green" initial={{ width: 0 }} animate={{ width: `${(done.length / actionItems.length) * 100}%` }} transition={{ duration: 1 }} />
              </div>
              <span className="text-[13px] text-graphite tabular-nums">{done.length}/{actionItems.length} completed</span>
            </div>
          </div>
          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <p className="mb-3 text-[13px] font-semibold text-red-ink">To do ({pending.length} remaining)</p>
              <ul className="space-y-2">
                {pending.map((item) => {
                  const t = tone(PRIORITY_TONE[item.priority]);
                  return (
                    <li key={item.task} className="flex items-center gap-3 rounded-2xl bg-mist px-4 py-3">
                      <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', t.bg)} aria-hidden="true" />
                      <span className="flex-1 text-[14px] text-ink">{item.task}</span>
                      <Badge toneName={PRIORITY_TONE[item.priority]}>{item.priority}</Badge>
                    </li>
                  );
                })}
                {pending.length === 0 && <li className="text-[14px] text-green-ink">All action items completed!</li>}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-[13px] font-semibold text-green-ink">Completed ({done.length}/{actionItems.length})</p>
              <ul className="space-y-2">
                {done.map((item) => (
                  <li key={item.task} className="flex items-center gap-3 rounded-2xl bg-green-soft px-4 py-3">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-green" aria-hidden="true" />
                    <span className="text-[14px] text-ink">{item.task}</span>
                  </li>
                ))}
                {done.length === 0 && <li className="text-[14px] text-graphite">No items completed yet</li>}
              </ul>
            </div>
          </div>
        </Card>
      </Appear>

      {/* Recommendations */}
      <Appear delay={0.1}>
        <Card>
          <h2 className="mb-6 font-display text-[21px] font-semibold tracking-tight">Smart recommendations</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {recommendations.map((rec, i) => {
              const style = REC_STYLE[rec.type] || REC_STYLE.info;
              const t = tone(style.toneName);
              return (
                <motion.div
                  key={rec.title}
                  className={cx('flex gap-3 rounded-2xl p-4', t.soft)}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                >
                  <span className={cx('mt-[7px] h-2 w-2 shrink-0 rounded-full', t.bg)} aria-hidden="true" />
                  <div>
                    <p className={cx('text-[15px] font-semibold', t.text)}>{rec.title}</p>
                    <p className="mt-0.5 text-[14px] leading-[1.5] text-ink/80">{rec.message}</p>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </Card>
      </Appear>
    </div>
  );
}

const JD_TYPES = ['application/pdf', 'text/plain', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];

/** How well the resume fits the pasted or uploaded job description. */
function JdMatch({ match, overall, atsScore }) {
  const parts = match.breakdown.filter((p) => p.score !== null);
  return (
    <Appear>
      <Card className="relative overflow-hidden">
        <div className="grid gap-8 md:grid-cols-[auto_1fr] md:items-center">
          <ScoreRing value={match.score} size={150} stroke={12} toneName={scoreTone(match.score)} label="JD match">
            <span className="font-display text-[44px] font-semibold leading-none tracking-tight tabular-nums">{Math.round(match.score)}</span>
          </ScoreRing>
          <div>
            <Badge toneName={scoreTone(match.score)}>{match.verdict}</Badge>
            <h2 className="mt-3 font-display text-[28px] font-semibold leading-tight tracking-tight">
              {match.job_title ? `Fit for ${match.job_title}` : 'Fit for this job description'}
            </h2>
            <p className="mt-2 text-[15px] text-graphite">
              Overall score <span className="font-semibold text-ink tabular-nums">{Math.round(overall)}</span>: 60% fit for this job, 40% resume quality (ATS {Math.round(atsScore)}).
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-x-10 gap-y-5 md:grid-cols-2">
          {parts.map((part, i) => {
            const ratio = part.max ? (part.score / part.max) * 100 : 0;
            const t = ratio >= 80 ? 'green' : ratio >= 50 ? 'orange' : 'red';
            return (
              <div key={part.key}>
                <div className="mb-1.5 flex items-baseline justify-between gap-3">
                  <span className="text-[15px] font-medium text-ink">{part.label}</span>
                  <span className="text-[14px] text-graphite tabular-nums"><span className={cx('font-semibold', tone(t).text)}>{part.score}</span> / {part.max}</span>
                </div>
                <Meter value={ratio} toneName={t} delay={i * 0.06} />
                <p className="mt-1 text-[12px] text-silver">{part.detail}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2">
          {[
            ['Must-have skills you have', match.must_have.matched, 'green'],
            ['Must-have skills missing', match.must_have.missing, 'red'],
            ['Nice-to-have skills you have', match.nice_to_have.matched, 'blue'],
            ['Keywords from the JD to add', match.keywords.missing, 'orange'],
          ].filter(([, list]) => list.length > 0).map(([title, list, t]) => (
            <div key={title}>
              <p className="mb-2 text-[13px] font-semibold text-ink">{title}</p>
              <div className="flex flex-wrap gap-1.5">{list.map((s) => <Chip key={s} toneName={t} className="!text-[12px]">{s}</Chip>)}</div>
            </div>
          ))}
        </div>

        {match.suggestions.length > 0 && (
          <div className="mt-8 rounded-[20px] bg-mist p-5">
            <p className="mb-3 text-[13px] font-semibold text-ink">To improve your chances for this job</p>
            <ul className="space-y-2">
              {match.suggestions.map((tip) => (
                <li key={tip} className="flex gap-2.5 text-[14px] leading-[1.5] text-ink/85">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-orange" aria-hidden="true" />{tip}
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>
    </Appear>
  );
}

function ResumeAnalyzer() {
  const [library, setLibrary] = useState({ resumes: [], max: 5 });
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
  const [uploadedFileName, setUploadedFileName] = useState('');

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

  const full = library.resumes.length >= library.max;

  const pick = (picked) => {
    const problem = pdfError(picked);
    if (problem) { setError(problem); setFile(null); return; }
    setFile(picked);
    setError('');
  };

  const pickJd = (e) => {
    const picked = e.target.files?.[0];
    e.target.value = '';
    if (!picked) return;
    if (!JD_TYPES.includes(picked.type) && !/\.(pdf|docx|txt)$/i.test(picked.name)) { setError('Upload the job description as PDF, DOCX or TXT'); return; }
    if (picked.size > 5 * 1024 * 1024) { setError('The job description file should be under 5 MB'); return; }
    setJdFile(picked);
    setError('');
  };

  const addJd = (formData) => {
    if (jdMode === 'paste' && jdText.trim()) formData.append('jd_text', jdText.trim());
    if (jdMode === 'upload' && jdFile) formData.append('jd_file', jdFile);
  };

  const handleAnalyze = async () => {
    if (source === 'upload' && !file) { setError('Choose a PDF resume first'); return; }
    if (source === 'saved' && !savedId) { setError('Choose a saved resume'); return; }
    if (jdMode === 'paste' && jdText.trim() && jdText.trim().split(/\s+/).length < 15) { setError('Paste the full job description (at least 15 words), or choose No JD'); return; }
    setBusy(true);
    setError('');
    setAnalysis(null);
    const formData = new FormData();
    addJd(formData);
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
      setUploadedFileName(response.data.filename || file?.name || '');
    } catch (err) {
      setError(errorMessage(err, 'Analysis failed'));
    } finally {
      setBusy(false);
    }
  };

  const resumeOptions = library.resumes.map((r) => ({
    value: String(r.id),
    label: `${r.filename}${r.is_primary ? ' (primary)' : ''}, ATS ${Math.round(r.score || 0)}`,
  }));

  return (
    <AppShell>
      <PageHeader
        eyebrow="Resume"
        toneName="blue"
        title="Read like a recruiter. Scored like a machine."
        subtitle="Score any of your resumes for applicant tracking systems. Add a job description to see how well it fits that exact role."
      />

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card className="!p-5 md:!p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-[19px] font-semibold tracking-tight">1. Resume</h2>
            {library.resumes.length > 0 && (
              <Segmented
                label="Resume source"
                value={source}
                onChange={(v) => { setSource(v); setError(''); }}
                options={[{ value: 'saved', label: 'Saved resume' }, { value: 'upload', label: 'Upload new' }]}
              />
            )}
          </div>
          {source === 'saved' ? (
            <SelectField label="Choose a resume" value={savedId} onChange={(e) => setSavedId(e.target.value)} options={resumeOptions} />
          ) : full ? (
            <Notice toneName="orange">
              You have {library.max} resumes saved, the most you can keep. Delete one on the <Link to="/dashboard" className="underline">overview page</Link>, or analyze a saved one.
            </Notice>
          ) : (
            <>
              <Dropzone compact onFile={pick} file={file} busy={busy && source === 'upload'} busyLabel="Analyzing resume..." />
              {library.resumes.length > 0 && (
                <label className="mt-3 flex items-center gap-2 text-[14px] text-ink">
                  <input type="checkbox" checked={makePrimary} onChange={(e) => setMakePrimary(e.target.checked)} className="h-4 w-4 accent-[#0071e3]" />
                  Make this my primary resume
                </label>
              )}
              <p className="mt-2 text-[12px] text-silver">Saved to your library ({library.resumes.length} of {library.max}).</p>
            </>
          )}
        </Card>

        <Card className="!p-5 md:!p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-display text-[19px] font-semibold tracking-tight">2. Job description <span className="font-normal text-silver">(optional)</span></h2>
            <Segmented
              label="Job description"
              value={jdMode}
              onChange={(v) => { setJdMode(v); setError(''); }}
              options={[{ value: 'none', label: 'No JD' }, { value: 'paste', label: 'Paste' }, { value: 'upload', label: 'Upload' }]}
            />
          </div>
          {jdMode === 'none' && (
            <p className="text-[14px] leading-[1.5] text-graphite">
              Without a JD you get a general ATS score. Add the job description you are applying for to also get a match
              score, the must-have skills you are missing and the exact keywords to add.
            </p>
          )}
          {jdMode === 'paste' && (
            <TextArea
              label="Paste the job description" rows={8} value={jdText} onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the full posting: role, responsibilities and requirements" maxLength={20000}
              hint={`${jdText.trim() ? jdText.trim().split(/\s+/).length : 0} words`}
            />
          )}
          {jdMode === 'upload' && (
            <label className="flex cursor-pointer flex-col items-center justify-center rounded-[20px] border-2 border-dashed border-hairline bg-mist/60 px-6 py-8 text-center transition-colors hover:border-blue/50 hover:bg-blue-soft/50">
              <input type="file" accept=".pdf,.docx,.txt,application/pdf,text/plain" className="sr-only" onChange={pickJd} />
              <span className="font-display text-[17px] font-semibold text-ink">{jdFile ? jdFile.name : 'Choose a job description file'}</span>
              <span className="mt-1 text-[13px] text-graphite">PDF, DOCX or TXT, up to 5 MB</span>
            </label>
          )}
        </Card>
      </div>

      {error && <Notice className="mt-5">{error}</Notice>}
      <div className="mt-5 flex justify-end">
        <Button size="lg" onClick={handleAnalyze} loading={busy} disabled={busy || (source === 'upload' && (!file || full))}>
          {busy ? 'Analyzing...' : (jdMode !== 'none' && (jdText.trim() || jdFile)) ? 'Analyze against JD' : 'Analyze resume'}
        </Button>
      </div>

      <div className="mt-8">
        <AnimatePresence mode="wait">
          {busy ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <Skeleton className="h-56" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
            </motion.div>
          ) : analysis ? (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              {analysis.jd_match && (
                <JdMatch match={analysis.jd_match} overall={analysis.overall_score} atsScore={analysis.ats_analysis?.score || 0} />
              )}
              <Results analysis={analysis} fileName={uploadedFileName} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

export default ResumeAnalyzer;
