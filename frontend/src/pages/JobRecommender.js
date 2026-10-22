import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Badge, Button, Card, Chip, EmptyState, Meter, Notice, ScoreRing, Segmented, Skeleton, TextField, EASE, cx } from '../components/ui/primitives';
import { Modal } from '../components/ui/overlays';
import { matchTone, tone } from '../components/ui/tones';
import { boldSegments, decodeEntities } from '../lib/format';

const CATEGORY_TONES = ['purple', 'blue', 'teal', 'green', 'orange', 'pink', 'indigo'];

const formatLocation = (location) => {
  if (!location) return 'Location not specified';
  return location.length > 30 ? `${location.substring(0, 30)}...` : location;
};

function Reasoning({ text }) {
  const reasons = String(text || '').split(' • ').filter(Boolean);
  return (
    <ul className="space-y-2">
      {reasons.map((reason) => (
        <li key={reason} className="flex gap-2.5 text-[14px] leading-[1.5] text-ink/85">
          <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-purple" aria-hidden="true" />
          <span>
            {boldSegments(reason).map((seg, i) => (seg.bold ? <strong key={i} className="font-semibold text-ink">{seg.text}</strong> : <span key={i}>{seg.text}</span>))}
          </span>
        </li>
      ))}
    </ul>
  );
}

function JobCard({ job, index }) {
  const [expanded, setExpanded] = useState(false);
  const overall = job.overall_score;
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: EASE, delay: Math.min(index, 10) * 0.06 }}
      className="overflow-hidden rounded-[24px] bg-white ring-1 ring-black/[0.05] transition-shadow hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.25)]"
    >
      <div className="grid gap-6 p-6 md:grid-cols-[auto_1fr_auto] md:items-start md:p-8">
        <ScoreRing value={overall * 100} size={92} stroke={8} toneName={matchTone(overall)} label="match">
          <span className="font-display text-[24px] font-semibold leading-none tabular-nums">{(overall * 100).toFixed(0)}%</span>
        </ScoreRing>

        <div className="min-w-0">
          <h3 className="font-display text-[24px] font-semibold leading-tight tracking-tight text-ink">{job.position}</h3>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] text-graphite">
            <span className="font-medium text-purple-ink">{job.company}</span>
            <span>{formatLocation(job.location)}</span>
            <span>{job.job_category}</span>
            {job.experience_level && <Badge toneName="indigo">{job.experience_level}</Badge>}
          </div>
          {job.why_recommended?.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {job.why_recommended.map((highlight) => <Chip key={highlight} toneName="green" className="!text-[12px]">{highlight}</Chip>)}
            </div>
          )}
        </div>

        {job.job_url && (
          <a
            href={job.job_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-10 items-center justify-center gap-2 self-start rounded-full bg-action px-5 text-[15px] font-medium text-white transition-colors hover:bg-action-hover"
          >
            Apply
          </a>
        )}
      </div>

      <div className="grid gap-6 border-t border-black/[0.06] bg-[#fbfbfd] p-6 md:grid-cols-[1.4fr_1fr] md:p-8">
        <div>
          <p className="mb-3 text-[13px] font-semibold text-purple-ink">Why this job fits you</p>
          <Reasoning text={job.recommendation_reasoning} />
          <p className="mb-2 mt-6 text-[13px] font-semibold text-ink">Your matching skills</p>
          <div className="flex flex-wrap gap-1.5">
            {job.matched_skills?.slice(0, 8).map((skill) => <Chip key={skill} toneName="blue" className="!text-[12px]">{skill}</Chip>)}
            {job.matched_skills?.length > 8 && <Chip className="!text-[12px]">+{job.matched_skills.length - 8} more</Chip>}
          </div>
        </div>
        <div className="space-y-4">
          {[
            ['Skills match', job.skill_match_score],
            ['Experience match', job.experience_match_score],
            ['Overall score', job.overall_score],
          ].map(([label, value], i) => (
            <div key={label}>
              <div className="mb-1.5 flex justify-between text-[14px]">
                <span className="text-graphite">{label}</span>
                <span className={cx('font-semibold tabular-nums', tone(matchTone(value)).text)}>{(value * 100).toFixed(0)}%</span>
              </div>
              <Meter value={value * 100} toneName={matchTone(value)} delay={0.1 + i * 0.1} />
            </div>
          ))}
        </div>
      </div>

      {job.job_description && (
        <div className="border-t border-black/[0.06] px-6 py-5 md:px-8">
          <p className={cx('text-[14px] leading-[1.6] text-graphite', !expanded && 'line-clamp-2')}>{decodeEntities(job.job_description)}</p>
          <button type="button" onClick={() => setExpanded((v) => !v)} className="mt-2 text-[13px] text-action-link hover:underline">
            {expanded ? 'Show less' : 'Read job description'}
          </button>
        </div>
      )}
    </motion.article>
  );
}

function MarketAnalysis({ analysis }) {
  // Most-demanded first; bars are relative to the top skill so small percentages stay readable
  const demand = Object.entries(analysis.user_skills_demand || {})
    .sort(([, a], [, b]) => b.demand_percentage - a.demand_percentage)
    .slice(0, 10);
  const top = Math.max(1, ...demand.map(([, d]) => d.demand_percentage));
  return (
    <div className="space-y-8">
      <section>
        <h3 className="mb-4 font-display text-[19px] font-semibold tracking-tight">Your skills, by market demand</h3>
        <div className="space-y-4">
          {demand.map(([skill, data], i) => (
            <div key={skill}>
              <div className="mb-1.5 flex items-baseline justify-between gap-4 text-[14px]">
                <span className="font-medium text-ink">{skill}</span>
                <span className="font-semibold text-blue-ink tabular-nums">{data.demand_percentage}%</span>
              </div>
              <Meter value={(data.demand_percentage / top) * 100} toneName={CATEGORY_TONES[i % CATEGORY_TONES.length]} delay={i * 0.05} />
              <p className="mt-1 text-[12px] text-silver">Found in {data.job_count} of {analysis.total_jobs_analyzed || 'all'} jobs. Typical level: {data.avg_experience_level}</p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-3 font-display text-[19px] font-semibold tracking-tight">Trending in the market</h3>
        <div className="flex flex-wrap gap-2">
          {analysis.trending_skills?.slice(0, 20).map((skill) => <Chip key={skill} toneName="orange" className="capitalize">{skill}</Chip>)}
        </div>
      </section>
      {analysis.skill_gap_analysis?.length > 0 && (
        <section className="rounded-[20px] bg-yellow-soft p-5">
          <h3 className="mb-2 font-display text-[19px] font-semibold tracking-tight">Recommended skills to learn</h3>
          <p className="mb-3 text-[14px] text-yellow-ink">These trending skills could boost your market value:</p>
          <div className="flex flex-wrap gap-2">
            {analysis.skill_gap_analysis.map((skill) => <Chip key={skill} className="bg-white capitalize">{skill}</Chip>)}
          </div>
        </section>
      )}
    </div>
  );
}

const JobRecommender = () => {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [skillsAnalysis, setSkillsAnalysis] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [filters, setFilters] = useState({ experienceYears: '', preferredLocations: [], preferredCategories: [], topK: 10 });
  const [availableCategories, setAvailableCategories] = useState([]);

  useEffect(() => {
    loadAvailableOptions();
    handleGetRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAvailableOptions = async () => {
    try {
      const { data } = await api.get('/api/job-categories');
      setAvailableCategories(Array.isArray(data.categories) ? data.categories : []);
    } catch (err) {
      setAvailableCategories([]);
    }
  };

  const handleGetRecommendations = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/api/recommend-jobs', {
        experience_years: parseInt(filters.experienceYears, 10) || 0,
        preferred_locations: filters.preferredLocations,
        preferred_categories: filters.preferredCategories,
        top_k: filters.topK,
      });
      setRecommendations(data.recommendations || []);
      setUserProfile(data.user_profile || null);
      setSkillsAnalysis(data.skills_analysis || null);
      if (data.recommendations && data.recommendations.length === 0) {
        setError('No job recommendations found. Try adjusting your filters or uploading a more detailed resume.');
      }
    } catch (err) {
      setError(errorMessage(err, 'Failed to connect to server. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const handleSkillsAnalysis = async () => {
    if (!userProfile?.extracted_skills) {
      setError('No skills available for analysis');
      return;
    }
    // The recommendations response already includes the analysis for the same skills
    if (skillsAnalysis) {
      setShowAnalysisModal(true);
      return;
    }
    setAnalysisLoading(true);
    try {
      const { data } = await api.post('/api/job-market-analysis', { skills: userProfile.extracted_skills });
      setSkillsAnalysis(data.analysis || null);
      setShowAnalysisModal(true);
    } catch (err) {
      setError(errorMessage(err, 'Failed to analyze skills'));
    } finally {
      setAnalysisLoading(false);
    }
  };

  const toggleCategory = (category) => setFilters((prev) => ({
    ...prev,
    preferredCategories: prev.preferredCategories.includes(category)
      ? prev.preferredCategories.filter((c) => c !== category)
      : [...prev.preferredCategories, category],
  }));

  const needsResume = !loading && !userProfile && /resume/i.test(error);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Jobs"
        toneName="purple"
        title="Roles that fit the skills you already have."
        subtitle="AI-powered job matching based on your resume skills."
        actions={userProfile && (
          <Button variant="outline" onClick={handleSkillsAnalysis} loading={analysisLoading}>
            Market analysis
          </Button>
        )}
      />

      {userProfile && (
        <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE }}>
          <Card className="mb-6">
            <div className="grid gap-6 md:grid-cols-[repeat(3,auto)_1fr] md:items-center">
              {[
                { label: 'Skills extracted', value: userProfile.extracted_skills?.length || 0, toneName: 'blue' },
                { label: 'Experience', value: `${userProfile.experience_years} years`, toneName: 'green' },
                { label: 'Resume', value: 'Analyzed', toneName: 'purple' },
              ].map(({ label, value, toneName }) => {
                const t = tone(toneName);
                return (
                  <div key={label} className="md:pr-8">
                    <div>
                      <p className={cx('text-[13px] font-medium', t.text)}>{label}</p>
                      <p className="font-display text-[21px] font-semibold tracking-tight">{value}</p>
                    </div>
                  </div>
                );
              })}
              <p className="truncate text-[13px] text-silver md:text-right" title={userProfile.resume_analysis?.resume_filename}>
                From {userProfile.resume_analysis?.resume_filename}
              </p>
            </div>
            <div className="mt-6 flex flex-wrap gap-2 border-t border-black/[0.06] pt-5">
              {userProfile.extracted_skills?.slice(0, 15).map((skill, i) => (
                <Chip key={skill} toneName={CATEGORY_TONES[i % CATEGORY_TONES.length]}>{skill}</Chip>
              ))}
              {userProfile.extracted_skills?.length > 15 && <Chip>+{userProfile.extracted_skills.length - 15} more</Chip>}
            </div>
          </Card>
        </motion.div>
      )}

      {/* Filters */}
      <Card className="mb-8 !p-6">
        <div className="grid gap-6 lg:grid-cols-[180px_1fr_auto_auto] lg:items-end">
          <TextField
            label="Experience (years)"
            type="number"
            min="0"
            value={filters.experienceYears}
            onChange={(e) => setFilters((prev) => ({ ...prev, experienceYears: e.target.value }))}
            placeholder="From resume"
          />
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink">Preferred categories</p>
            <div className="flex flex-wrap gap-2">
              {availableCategories.map((category, i) => {
                const active = filters.preferredCategories.includes(category);
                const t = tone(CATEGORY_TONES[i % CATEGORY_TONES.length]);
                return (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggleCategory(category)}
                    className={cx(
                      'rounded-full border px-3.5 py-1.5 text-[13px] transition-colors',
                      active ? `${t.soft} ${t.text} border-transparent` : 'border-hairline text-graphite hover:border-silver hover:text-ink'
                    )}
                  >
                    {category}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink">Results</p>
            <Segmented
              label="Number of results"
              value={filters.topK}
              onChange={(v) => setFilters((prev) => ({ ...prev, topK: v }))}
              options={[5, 10, 15, 20].map((n) => ({ value: n, label: String(n) }))}
            />
          </div>
          <Button onClick={handleGetRecommendations} loading={loading} size="lg">
            Update search
          </Button>
        </div>
      </Card>

      {error && !needsResume && <Notice className="mb-6">{error}</Notice>}

      {loading ? (
        <div className="space-y-5">
          <p className="text-[15px] text-graphite">Analyzing your resume and finding perfect job matches...</p>
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-64" />)}
        </div>
      ) : needsResume ? (
        <Card>
          <EmptyState
            toneName="purple"
            title="Upload a resume to see matches"
            action={<Button onClick={() => navigate('/resume-analyzer')}>Analyze a resume</Button>}
          >
            {error}
          </EmptyState>
        </Card>
      ) : recommendations.length > 0 ? (
        <>
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="font-display text-[24px] font-semibold tracking-tight">{recommendations.length} matches</h2>
            <p className="text-[13px] text-graphite">Sorted by relevance score</p>
          </div>
          <div className="space-y-5">
            {recommendations.map((job, index) => <JobCard key={job.job_id} job={job} index={index} />)}
          </div>
        </>
      ) : null}

      <Modal open={showAnalysisModal && Boolean(skillsAnalysis)} onClose={() => setShowAnalysisModal(false)} title="Skills market analysis">
        {skillsAnalysis && <MarketAnalysis analysis={skillsAnalysis} />}
      </Modal>
    </AppShell>
  );
};

export default JobRecommender;
