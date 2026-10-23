import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Button, Notice, Skeleton, cx } from '../components/ui/primitives';
import { Select } from '../components/ui/Select';
import { CountNumber, Expand, Line, MiniRing, Rise, Section, WordCloud, ratioColor } from '../components/ui/studio';
import { boldSegments, decodeEntities, lpa } from '../lib/format';

const PURPLE = '#af52de';
const SOURCE_LINKS = { adzuna: ['Adzuna', 'https://www.adzuna.in/'], careerjet: ['Careerjet', 'https://www.careerjet.co.in/'] };

function Reasoning({ text }) {
  const reasons = String(text || '').split(' • ').filter(Boolean);
  return (
    <ul className="space-y-2.5">
      {reasons.map((reason) => (
        <li key={reason} className="flex gap-3 text-[15px] leading-[1.55] text-ink/85">
          <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: PURPLE }} aria-hidden="true" />
          <span>{boldSegments(reason).map((seg, i) => (seg.bold ? <strong key={i} className="font-semibold text-ink">{seg.text}</strong> : <span key={i}>{seg.text}</span>))}</span>
        </li>
      ))}
    </ul>
  );
}

/** One match as an editorial row. Click to open the reasoning in place. */
function MatchRow({ job, rank }) {
  const [open, setOpen] = useState(false);
  const pct = Math.round(job.overall_score * 100);
  return (
    <Rise delay={Math.min(rank, 8) * 0.04} amount={0.1}>
      <article className={cx('border-b border-black/[0.07] transition-colors', open && 'bg-white/50')}>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-5 py-7 text-left md:gap-8">
          <span className="w-10 font-display text-[28px] font-semibold tabular-nums text-black/15 transition-colors group-hover:text-purple md:text-[36px]">{String(rank + 1).padStart(2, '0')}</span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-[22px] font-semibold tracking-tight text-ink md:text-[28px]">{job.position}</h3>
            <p className="mt-1 truncate text-[15px] text-graphite">
              <span className="text-ink">{job.company}</span>
              {' · '}{job.city || job.location}
              {job.experience_level ? ` · ${job.experience_level}` : ''}
              {job.work_mode && job.work_mode !== 'On-site' ? ` · ${job.work_mode}` : ''}
            </p>
            {job.salary && <p className="mt-1 text-[14px] font-medium text-green-ink tabular-nums">{lpa(job.salary.min)} to {lpa(job.salary.max)}</p>}
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="font-display text-[32px] font-semibold leading-none tracking-tight tabular-nums text-ink">{pct}<span className="text-[16px] text-silver">%</span></p>
              <p className="text-[12px] text-silver">match</p>
            </div>
            <MiniRing value={pct} size={48} />
            <span className={cx('text-[22px] text-silver transition-transform duration-500', open ? 'rotate-90' : 'group-hover:translate-x-1')} aria-hidden="true">&rsaquo;</span>
          </div>
        </button>
        <Expand open={open}>
          <div className="grid gap-10 pb-10 pl-0 md:grid-cols-[1.4fr_1fr] md:pl-[72px]">
            <div>
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-purple-ink">Why it fits</p>
              <Reasoning text={job.recommendation_reasoning} />
              {job.job_description && (
                <p className="mt-6 max-w-[70ch] text-[14px] leading-[1.65] text-graphite">{decodeEntities(job.job_description)}</p>
              )}
            </div>
            <div className="space-y-7">
              {[['Skills', job.skill_match_score], ['Experience', job.experience_match_score]].map(([label, v], i) => (
                <div key={label}>
                  <div className="mb-2 flex justify-between text-[14px]"><span className="text-graphite">{label}</span><span className="font-semibold tabular-nums">{Math.round(v * 100)}%</span></div>
                  <Line value={v * 100} color={ratioColor(v)} delay={i * 0.1} />
                </div>
              ))}
              {job.matched_skills?.length > 0 && (
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-ink">You have</p>
                  <p className="text-[15px] leading-[1.6] text-blue-ink">{job.matched_skills.slice(0, 10).join(' · ')}</p>
                </div>
              )}
              {job.missing_skills?.length > 0 && (
                <div>
                  <p className="mb-2 text-[13px] font-semibold text-ink">To add for this role</p>
                  <p className="text-[15px] leading-[1.6] text-orange-ink">{job.missing_skills.join(' · ')}</p>
                </div>
              )}
              {job.job_url && (
                <a href={job.job_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[15px] font-medium text-action-link hover:underline">
                  {job.job_url_label || 'Apply'} <span aria-hidden="true">&rarr;</span>
                </a>
              )}
            </div>
          </div>
        </Expand>
      </article>
    </Rise>
  );
}

/** Current openings from a live job-search API, fetched only when asked (free plans allow few calls). */
function LiveJobs({ live, city }) {
  const [state, setState] = useState({ loading: false, jobs: null, error: '', remaining: live?.remaining_today });
  if (!live?.sources?.length) return null;
  const remaining = state.remaining ?? live.remaining_today;

  const load = async () => {
    setState((s) => ({ ...s, loading: true, error: '' }));
    try {
      const { data } = await api.post('/api/live-jobs', { city: city || null });
      setState({ loading: false, jobs: data.jobs, remaining: data.remaining_today, error: data.limit_reached ? 'Today\'s live searches are used up. Try again tomorrow.' : '' });
    } catch (err) {
      setState((s) => ({ ...s, loading: false, error: errorMessage(err, 'Could not load live openings') }));
    }
  };

  return (
    <Section
      index="03"
      title="Live openings"
      note={(
        <>
          Current jobs for your top skills{city ? ` in ${city}` : ''}, from{' '}
          {live.sources.map((name, i) => (
            <React.Fragment key={name}>
              {i > 0 && ' and '}
              <a href={SOURCE_LINKS[name]?.[1]} target="_blank" rel="noopener noreferrer" className="text-action-link hover:underline">{SOURCE_LINKS[name]?.[0] || name}</a>
            </React.Fragment>
          ))}. {remaining} of {live.daily_limit} searches left today.
        </>
      )}
      aside={(
        <Button onClick={load} loading={state.loading} disabled={remaining <= 0 && !state.jobs}>
          {state.jobs ? 'Refresh' : 'Show live openings'}
        </Button>
      )}
    >
      {state.error && <Notice toneName="orange" className="mb-6">{state.error}</Notice>}
      {!state.jobs && !state.error && <p className="py-6 text-[16px] text-graphite">Live listings load only when you ask, so the free daily quota lasts.</p>}
      {state.jobs?.length === 0 && !state.error && <p className="py-6 text-[16px] text-graphite">No live openings for your top skills right now.</p>}
      {state.jobs?.map((job) => (
        <a key={job.id} href={job.job_url} target="_blank" rel="noopener noreferrer" className="group flex items-baseline justify-between gap-6 border-b border-black/[0.07] py-5">
          <div className="min-w-0">
            <p className="truncate font-display text-[20px] font-semibold tracking-tight text-ink group-hover:text-action-link">{job.position}</p>
            <p className="truncate text-[14px] text-graphite">{[job.company, job.location, job.posted].filter(Boolean).join(' · ')}</p>
            {job.matched_skills?.length > 0 && <p className="mt-1 text-[13px] text-blue-ink">{job.matched_skills.slice(0, 5).join(' · ')}</p>}
          </div>
          <div className="shrink-0 text-right">
            {job.salary && <p className="text-[14px] font-medium text-green-ink tabular-nums">{lpa(job.salary.min)} to {lpa(job.salary.max)}</p>}
            <p className="text-[12px] text-silver">Jobs by {job.source}</p>
          </div>
        </a>
      ))}
    </Section>
  );
}

function MarketAnalysis({ analysis }) {
  const demand = Object.entries(analysis.user_skills_demand || {})
    .sort(([, a], [, b]) => b.demand_percentage - a.demand_percentage)
    .slice(0, 8);
  const top = Math.max(1, ...demand.map(([, d]) => d.demand_percentage));
  return (
    <Section
      index="02"
      title="Your skills in the market"
      note={`Share of ${(analysis.total_jobs_analyzed || 0).toLocaleString('en-IN')} Indian postings that ask for each skill.`}
    >
      <div className="space-y-5">
        {demand.map(([skill, d], i) => (
          <div key={skill} className="grid grid-cols-[120px_1fr_70px] items-center gap-4 md:grid-cols-[180px_1fr_90px]">
            <span className="truncate text-[15px] font-medium text-ink">{skill}</span>
            <div>
              <Line value={(d.demand_percentage / top) * 100} color={`linear-gradient(90deg, ${PURPLE}, #ff2d55)`} delay={i * 0.06} />
              <p className="mt-1 text-[12px] text-silver">{d.job_count.toLocaleString('en-IN')} postings · typically {d.avg_experience_level}</p>
            </div>
            <span className="text-right font-display text-[22px] font-semibold tabular-nums">{d.demand_percentage}<span className="text-[13px] text-silver">%</span></span>
          </div>
        ))}
      </div>
      {analysis.skill_gap_analysis?.length > 0 && (
        <div className="mt-12 border-t border-black/[0.07] pt-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-orange-ink">Learn next</p>
          <p className="mt-2 text-[15px] text-graphite">Postings that ask for your skills often also ask for:</p>
          <WordCloud className="mt-4" words={analysis.skill_gap_analysis} colorFor={() => '#c93400'} />
        </div>
      )}
      {analysis.trending_skills?.length > 0 && (
        <div className="mt-12 border-t border-black/[0.07] pt-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-silver">Most requested across India</p>
          <WordCloud className="mt-4" words={analysis.trending_skills.slice(0, 16)} colorFor={(w, i) => `rgba(29,29,31,${1 - i * 0.04})`} />
        </div>
      )}
      {analysis.source && (
        <p className="mt-10 text-[12px] text-silver">
          {analysis.source.name}, collected {analysis.source.collected}.{' '}
          <a href={analysis.source.url} target="_blank" rel="noopener noreferrer" className="text-action-link hover:underline">Dataset</a> ({analysis.source.licence}).
        </p>
      )}
    </Section>
  );
}

const JobRecommender = () => {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [skillsAnalysis, setSkillsAnalysis] = useState(null);
  const [filters, setFilters] = useState({ experienceYears: '', city: '', field: '', topK: 10 });
  const [categories, setCategories] = useState([]);
  const [cities, setCities] = useState([]);
  const [live, setLive] = useState(null);

  useEffect(() => {
    Promise.all([api.get('/api/job-categories'), api.get('/api/job-locations')])
      .then(([c, l]) => { setCategories(c.data.categories || []); setCities((l.data.locations || []).slice(0, 60)); })
      .catch(() => {});
    search();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const search = async () => {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/api/recommend-jobs', {
        experience_years: Number(filters.experienceYears) || 0,
        preferred_locations: filters.city ? [filters.city] : [],
        preferred_categories: filters.field ? [filters.field] : [],
        top_k: filters.topK,
      });
      setRecommendations(data.recommendations || []);
      setUserProfile(data.user_profile || null);
      setSkillsAnalysis(data.skills_analysis || null);
      setLive(data.live || null);
      if (!filters.experienceYears && data.user_profile?.experience_years) {
        setFilters((f) => ({ ...f, experienceYears: String(data.user_profile.experience_years) }));
      }
      if (data.recommendations?.length === 0) setError('No matches found. Try another city or field, or upload a more detailed resume.');
    } catch (err) {
      setError(errorMessage(err, 'Failed to connect to server. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const set = (key) => (e) => setFilters((f) => ({ ...f, [key]: e.target.value }));
  const needsResume = !loading && !userProfile && /resume/i.test(error);
  const skills = userProfile?.extracted_skills || [];

  return (
    <AppShell toneName="purple">
      <PageHeader
        eyebrow="Jobs"
        title="Roles that fit the skills you already have."
        accent={3}
        subtitle={(
          <>Your primary resume matched against <span className="font-semibold text-ink"><CountNumber value={97316} /></span> Indian job postings from Naukri.com.</>
        )}
      />

      {needsResume ? (
        <div className="border-t border-black/[0.07] py-16">
          <p className="font-display text-[32px] font-semibold tracking-tight">Upload a resume to see matches.</p>
          <p className="mt-2 text-[17px] text-graphite">{error}</p>
          <Button className="mt-6" onClick={() => navigate('/resume-analyzer')}>Analyze a resume</Button>
        </div>
      ) : (
        <>
          {userProfile && (
            <Rise className="mb-12">
              <p className="text-[15px] text-graphite">
                From <span className="text-ink">{userProfile.resume_analysis?.resume_filename}</span>, your primary resume · {skills.length} skills
              </p>
              <WordCloud className="mt-4" words={skills.slice(0, 24)} colorFor={(w, i) => ['#af52de', '#ff2d55', '#5856d6', '#1d1d1f'][i % 4]} />
            </Rise>
          )}

          <div className="rounded-[32px] border border-black/[0.06] bg-white/60 p-6 backdrop-blur-xl md:p-9">
            <p className="font-display text-[24px] font-semibold leading-[1.75] tracking-tight text-black/35 md:text-[32px]">
              Show{' '}
              <Select variant="inline" value={filters.topK} onChange={(e) => setFilters((f) => ({ ...f, topK: Number(e.target.value) }))} options={[5, 10, 15, 20].map((n) => ({ value: n, label: String(n) }))} />{' '}
              roles in{' '}
              <Select variant="inline" value={filters.city} onChange={set('city')} options={cities} placeholder="anywhere in India" />{' '}
              for{' '}
              <Select variant="inline" value={filters.field} onChange={set('field')} options={categories} placeholder="any field" />,
              with{' '}
              <input
                type="number" min="0" max="40" value={filters.experienceYears} onChange={set('experienceYears')} placeholder="0" aria-label="Years of experience"
                className="inline-block w-[2.6ch] border-b-2 border-black/15 bg-transparent px-0.5 pb-0.5 text-center font-display font-semibold tracking-tight text-ink placeholder:text-black/25 focus:border-action focus:outline-none"
              />{' '}
              years of experience.
            </p>
            <div className="mt-5 flex justify-end">
              <Button size="lg" onClick={search} loading={loading} className="min-w-[200px]">Find matches</Button>
            </div>
          </div>

          {error && <Notice className="mt-6">{error}</Notice>}

          <Section index="01" title={loading ? 'Matching...' : `${recommendations.length} matches`} note="Ranked by skills, experience and your filters. Click a role to see why." className="mt-16">
            {loading ? (
              <div className="space-y-6 py-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
            ) : (
              <div className="border-t border-black/[0.07]">
                {recommendations.map((job, i) => <MatchRow key={job.job_id} job={job} rank={i} />)}
              </div>
            )}
          </Section>

          {skillsAnalysis && Object.keys(skillsAnalysis).length > 0 && <MarketAnalysis analysis={skillsAnalysis} />}
          <LiveJobs live={live} city={filters.city} />
        </>
      )}
    </AppShell>
  );
};

export default JobRecommender;
