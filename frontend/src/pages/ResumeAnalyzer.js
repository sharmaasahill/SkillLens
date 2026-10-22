import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  CheckCircleIcon, ExclamationTriangleIcon, XCircleIcon, InformationCircleIcon, SparklesIcon,
  DocumentTextIcon, BoltIcon, BuildingOffice2Icon, KeyIcon, ClipboardDocumentCheckIcon, LightBulbIcon,
} from '@heroicons/react/24/outline';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Appear, Badge, Button, Card, Chip, Notice, ScoreRing, SectionTitle, Skeleton, cx } from '../components/ui/primitives';
import Dropzone, { pdfError } from '../components/ui/Dropzone';
import { scoreTone, tone } from '../components/ui/tones';
import {
  analyzeActionVerbs, buildActionItems, buildRecommendations, calculateReadabilityScore,
  flattenSkills, getIndustrySpecificAdvice, getScoreLabel, wordCount,
} from '../lib/resumeInsights';

const SKILL_TONES = ['blue', 'purple', 'teal', 'green', 'indigo', 'pink', 'orange'];
const PRIORITY_TONE = { High: 'red', Medium: 'orange', Low: 'blue' };
const REC_STYLE = {
  critical: { toneName: 'red', icon: XCircleIcon },
  warning: { toneName: 'orange', icon: ExclamationTriangleIcon },
  success: { toneName: 'green', icon: CheckCircleIcon },
  info: { toneName: 'blue', icon: InformationCircleIcon },
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
  const words = wordCount(analysis.text);
  const sections = ats?.found_sections?.length || 0;
  const keywords = ats?.keyword_matches || 0;
  const readability = calculateReadabilityScore(analysis.text);
  const verbs = analyzeActionVerbs(analysis.text);
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
                <p className="flex items-center gap-2 text-[14px] text-graphite">
                  <DocumentTextIcon className="h-4 w-4" aria-hidden="true" /> {fileName}
                </p>
                <h2 className="mt-2 font-display text-[32px] font-semibold tracking-tight">ATS compatibility: {getScoreLabel(score)}</h2>
                <div className="mt-6 grid gap-6 sm:grid-cols-2">
                  <div>
                    <p className="mb-2 text-[13px] font-semibold text-green-ink">Strengths</p>
                    <ul className="space-y-2 text-[14px] text-ink">
                      {ats.found_sections?.length > 0 && (
                        <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 shrink-0 text-green" />Found {ats.found_sections.length} required sections: {ats.found_sections.join(', ')}</li>
                      )}
                      {ats.keyword_matches > 10 && (
                        <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 shrink-0 text-green" />Contains {ats.keyword_matches} industry keywords</li>
                      )}
                      {ats.problematic_elements?.length === 0 && (
                        <li className="flex gap-2"><CheckCircleIcon className="h-5 w-5 shrink-0 text-green" />No problematic formatting elements detected</li>
                      )}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-2 text-[13px] font-semibold text-red-ink">Areas for improvement</p>
                    {ats.issues?.length > 0 ? (
                      <ul className="space-y-2 text-[14px] text-ink">
                        {ats.issues.map((issue) => (
                          <li key={issue} className="flex gap-2"><ExclamationTriangleIcon className="h-5 w-5 shrink-0 text-orange" />{issue}</li>
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

      {/* Quality metrics */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <QualityTile delay={0.05} toneName="blue" value={words} label="Total words"
          hint={words < 200 ? 'Consider adding more detail' : words > 800 ? 'Consider being more concise' : 'Good length'} />
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
              <div className="flex items-center gap-2">
                <BoltIcon className="h-5 w-5 text-yellow-ink" aria-hidden="true" />
                <h2 className="font-display text-[21px] font-semibold tracking-tight">Action verbs</h2>
              </div>
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
            <div className="mb-5 flex items-center gap-2">
              <BuildingOffice2Icon className="h-5 w-5 text-indigo" aria-hidden="true" />
              <h2 className="font-display text-[21px] font-semibold tracking-tight">Industry</h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-display text-[19px] font-semibold text-indigo-ink">{industry.industry}</p>
              <Badge toneName={industry.confidence === 'High' ? 'green' : industry.confidence === 'Medium' ? 'orange' : 'gray'}>
                {industry.confidence} confidence
              </Badge>
            </div>
            <p className="mt-3 text-[14px] leading-[1.55] text-graphite">{industry.advice}</p>
            <div className="mt-5 flex items-center gap-2">
              <KeyIcon className="h-4 w-4 text-purple" aria-hidden="true" />
              <p className="text-[13px] font-medium">Recommended keywords</p>
            </div>
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
            <div className="flex items-center gap-2">
              <ClipboardDocumentCheckIcon className="h-5 w-5 text-green" aria-hidden="true" />
              <h2 className="font-display text-[21px] font-semibold tracking-tight">Action items</h2>
            </div>
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
                    <CheckCircleIcon className="h-5 w-5 shrink-0 text-green" aria-hidden="true" />
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
          <div className="mb-6 flex items-center gap-2">
            <LightBulbIcon className="h-5 w-5 text-yellow-ink" aria-hidden="true" />
            <h2 className="font-display text-[21px] font-semibold tracking-tight">Smart recommendations</h2>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {recommendations.map((rec, i) => {
              const style = REC_STYLE[rec.type] || REC_STYLE.info;
              const t = tone(style.toneName);
              const Icon = style.icon;
              return (
                <motion.div
                  key={rec.title}
                  className={cx('flex gap-3 rounded-2xl p-4', t.soft)}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                >
                  <Icon className={cx('h-5 w-5 shrink-0', t.text)} aria-hidden="true" />
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

function ResumeAnalyzer() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [analysis, setAnalysis] = useState(null);
  const [uploadedFileName, setUploadedFileName] = useState('');

  const pick = (picked) => {
    const problem = pdfError(picked);
    if (problem) { setError(problem); setFile(null); return; }
    setFile(picked);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) { setError('Please select a file first'); return; }
    setUploading(true);
    setError('');
    setAnalysis(null);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await api.post('/upload-resume', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setAnalysis(response.data);
      setUploadedFileName(response.data.filename || file.name);
    } catch (err) {
      setError(errorMessage(err, 'Failed to upload resume'));
    } finally {
      setUploading(false);
      setFile(null);
    }
  };

  return (
    <AppShell>
      <PageHeader
        eyebrow="Resume"
        toneName="blue"
        title="Read like a recruiter. Scored like a machine."
        subtitle="Upload a PDF. SkillLens pulls out your skills, checks the sections an applicant tracking system looks for, and tells you exactly what to fix."
      />

      <Card className="!p-5 md:!p-6">
        <Dropzone onFile={pick} file={file} busy={uploading} busyLabel="Analyzing resume..." />
        {error && <Notice className="mt-4">{error}</Notice>}
        <div className="mt-5 flex flex-col items-center justify-between gap-3 sm:flex-row">
          <p className="flex items-center gap-2 text-[13px] text-graphite">
            <SparklesIcon className="h-4 w-4 text-purple" aria-hidden="true" />
            Each analysis is saved to your history on the overview page.
          </p>
          <Button size="lg" onClick={handleUpload} disabled={!file || uploading} loading={uploading}>
            {uploading ? 'Analyzing...' : 'Upload and analyze'}
          </Button>
        </div>
      </Card>

      <div className="mt-8">
        <AnimatePresence mode="wait">
          {uploading ? (
            <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
              <Skeleton className="h-56" />
              <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
            </motion.div>
          ) : analysis ? (
            <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <Results analysis={analysis} fileName={uploadedFileName} />
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

export default ResumeAnalyzer;
