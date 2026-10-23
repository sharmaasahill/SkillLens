import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Badge, Button, Card, Chip, EmptyState, Meter, Notice, ScoreRing, Segmented, SelectField, Skeleton, TextField, EASE, cx } from '../components/ui/primitives';
import { Modal } from '../components/ui/overlays';
import { matchTone, tone } from '../components/ui/tones';
import { boldSegments, decodeEntities, lpa } from '../lib/format';

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
            {job.work_mode && job.work_mode !== 'On-site' && <Badge toneName="teal">{job.work_mode}</Badge>}
          </div>
          {job.salary && (
            <p className="mt-2 text-[15px] font-medium text-green-ink tabular-nums">
              {lpa(job.salary.min)} to {lpa(job.salary.max)} <span className="font-normal text-silver">disclosed</span>
            </p>
          )}
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
            className="inline-flex h-10 items-center justify-center gap-2 self-start whitespace-nowrap rounded-full bg-action px-5 text-[15px] font-medium text-white transition-colors hover:bg-action-hover"
          >
            {job.job_url_label || 'Apply'}
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
          {job.missing_skills?.length > 0 && (
            <>
              <p className="mb-2 mt-5 text-[13px] font-semibold text-ink">Skills to add for this role</p>
              <div className="flex flex-wrap gap-1.5">
                {job.missing_skills.map((skill) => <Chip key={skill} toneName="orange" className="!text-[12px]">{skill}</Chip>)}
              </div>
            </>
          )}
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

const SOURCE_LINKS = { adzuna: ['Adzuna', 'https://www.adzuna.in/'], careerjet: ['Careerjet', 'https://www.careerjet.co.in/'] };

/**
 * Current openings from a live job-search API. Fetched only when the user asks,
 * because free API plans allow few calls; the server also caps calls per day.
 */
function LiveJobs({ live, city }) {
  const [state, setState] = useState({ loading: false, jobs: null, error: '', remaining: live?.remaining_today });
  if (!live?.sources?.length) return null;

  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const { data } = await api.post('/api/live-jobs', { city: city || null });
      setState({
        loading: false, jobs: data.jobs, remaining: data.remaining_today,
        error: data.limit_reached ? 'Today\'s live searches are used up. Try again tomorrow.' : '',
      });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: errorMessage(err, 'Could not load live openings') }));
    }
  };

  return (
    <section className="mt-10" aria-labelledby="live-jobs-title">
      <Card className="!p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 id="live-jobs-title" className="font-display text-[24px] font-semibold tracking-tight">Live openings</h2>
            <p className="mt-1 text-[14px] text-graphite">
              Current jobs for your top skills{city ? ` in ${city}` : ''}, from{' '}
              {live.sources.map((name, i) => (
                <React.Fragment key={name}>
                  {i > 0 && ' and '}
                  <a href={SOURCE_LINKS[name]?.[1]} target="_blank" rel="noopener noreferrer" className="text-action-link hover:underline">{SOURCE_LINKS[name]?.[0] || name}</a>
                </React.Fragment>
              ))}
              . {state.remaining ?? live.remaining_today} of {live.daily_limit} searches left today.
            </p>
          </div>
          <Button onClick={load} loading={state.loading} disabled={(state.remaining ?? live.remaining_today) <= 0 && !state.jobs}>
            {state.jobs ? 'Refresh live openings' : 'Show live openings'}
          </Button>
        </div>
        {state.error && <Notice toneName="orange" className="mt-4">{state.error}</Notice>}
      </Card>
      {state.jobs && state.jobs.length === 0 && !state.error && (
        <p className="mt-4 text-[15px] text-graphite">No live openings found for your top skills right now.</p>
      )}
      {state.jobs?.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {state.jobs.map((job) => (
            <a key={job.id} href={job.job_url} target="_blank" rel="noopener noreferrer"
              className="group rounded-[20px] bg-white p-6 ring-1 ring-black/[0.05] transition-shadow hover:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.25)]">
              <p className="text-[12px] font-medium text-silver">Jobs by {job.source}{job.posted ? ` · ${job.posted}` : ''}</p>
              <h3 className="mt-1 font-display text-[19px] font-semibold leading-snug tracking-tight text-ink group-hover:text-action-link">{job.position}</h3>
              <p className="mt-1 text-[14px] text-graphite">{[job.company, job.location].filter(Boolean).join(' · ')}</p>
              {job.salary && <p className="mt-2 text-[14px] font-medium text-green-ink tabular-nums">{lpa(job.salary.min)} to {lpa(job.salary.max)}</p>}
              {job.matched_skills?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {job.matched_skills.slice(0, 5).map((skill) => <Chip key={skill} toneName="blue" className="!text-[12px]">{skill}</Chip>)}
                </div>
              )}
            </a>
          ))}
        </div>
      )}
    </section>
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
              <p className="mt-1 text-[12px] text-silver">
                In {data.job_count.toLocaleString('en-IN')} of {(analysis.total_jobs_analyzed || 0).toLocaleString('en-IN')} Indian postings. Typical experience asked: {data.avg_experience_level}
              </p>
            </div>
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-3 font-display text-[19px] font-semibold tracking-tight">Most requested skills in India</h3>
        <div className="flex flex-wrap gap-2">
          {analysis.trending_skills?.slice(0, 20).map((skill) => <Chip key={skill} toneName="orange" className="capitalize">{skill}</Chip>)}
        </div>
      </section>
      {analysis.skill_gap_analysis?.length > 0 && (
        <section className="rounded-[20px] bg-yellow-soft p-5">
          <h3 className="mb-2 font-display text-[19px] font-semibold tracking-tight">Recommended skills to learn</h3>
          <p className="mb-3 text-[14px] text-yellow-ink">Postings that ask for your skills often also ask for these:</p>
          <div className="flex flex-wrap gap-2">
            {analysis.skill_gap_analysis.map((skill) => <Chip key={skill} className="bg-white capitalize">{skill}</Chip>)}
          </div>
        </section>
      )}
      {analysis.source && (
        <p className="text-[12px] text-silver">
          Based on {analysis.source.name}, collected {analysis.source.collected}.{' '}
          <a href={analysis.source.url} target="_blank" rel="noopener noreferrer" className="text-action-link hover:underline">Dataset</a>
          {' '}({analysis.source.licence}).
        </p>
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
  const [availableCities, setAvailableCities] = useState([]);
  const [live, setLive] = useState(null);

  useEffect(() => {
    loadAvailableOptions();
    handleGetRecommendations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAvailableOptions = async () => {
    try {
      const [categories, cities] = await Promise.all([api.get('/api/job-categories'), api.get('/api/job-locations')]);
      setAvailableCategories(Array.isArray(categories.data.categories) ? categories.data.categories : []);
      setAvailableCities(Array.isArray(cities.data.locations) ? cities.data.locations.slice(0, 40) : []);
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
        experience_years: Number(filters.experienceYears) || 0,
        preferred_locations: filters.preferredLocations,
        preferred_categories: filters.preferredCategories,
        top_k: filters.topK,
      });
      setRecommendations(data.recommendations || []);
      setUserProfile(data.user_profile || null);
      setSkillsAnalysis(data.skills_analysis || null);
      setLive(data.live || null);
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
        subtitle="Your resume skills matched against 97,000+ Indian job postings from Naukri.com (2025)."
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
                From your primary resume, {userProfile.resume_analysis?.resume_filename}
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-[160px_220px_auto_1fr] lg:items-end">
          <TextField
            label="Experience (years)"
            type="number"
            min="0"
            value={filters.experienceYears}
            onChange={(e) => setFilters((prev) => ({ ...prev, experienceYears: e.target.value }))}
            placeholder="From resume"
          />
          <SelectField
            label="City"
            value={filters.preferredLocations[0] || ''}
            onChange={(e) => setFilters((prev) => ({ ...prev, preferredLocations: e.target.value ? [e.target.value] : [] }))}
            options={availableCities}
            placeholder="Anywhere in India"
          />
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink">Results</p>
            <Segmented
              label="Number of results"
              value={filters.topK}
              onChange={(v) => setFilters((prev) => ({ ...prev, topK: v }))}
              options={[5, 10, 15, 20].map((n) => ({ value: n, label: String(n) }))}
            />
          </div>
          <Button onClick={handleGetRecommendations} loading={loading} size="lg" className="lg:justify-self-end">
            Update search
          </Button>
        </div>
        <div className="mt-6 border-t border-black/[0.06] pt-5">
          <p className="mb-2 text-[13px] font-medium text-ink">Fields</p>
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
      </Card>


      {error && !needsResume && <Notice className="mb-6">{error}</Notice>}

      {loading ? (
        <div className="space-y-5">
          <p className="text-[15px] text-graphite">Matching your skills against Indian job postings...</p>
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
            <p className="text-[13px] text-graphite">From the 2025 dataset, sorted by fit</p>
          </div>
          <div className="space-y-5">
            {recommendations.map((job, index) => <JobCard key={job.job_id} job={job} index={index} />)}
          </div>
          <LiveJobs live={live} city={filters.preferredLocations[0]} />
        </>
      ) : null}

      <Modal open={showAnalysisModal && Boolean(skillsAnalysis)} onClose={() => setShowAnalysisModal(false)} title="Skills market analysis">
        {skillsAnalysis && <MarketAnalysis analysis={skillsAnalysis} />}
      </Modal>
    </AppShell>
  );
};

export default JobRecommender;
