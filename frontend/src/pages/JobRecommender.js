import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Button, Notice, Segmented, Skeleton, cx } from '../components/ui/primitives';
import { Combobox, Select } from '../components/ui/Select';
import { CountNumber, EASE, Rise, Section } from '../components/ui/studio';
import JobRow from '../components/jobs/JobRow';
import SourcePicker from '../components/jobs/SourcePicker';
import { breakable } from '../lib/format';

const CITIES = ['Bengaluru', 'Hyderabad', 'Pune', 'Mumbai', 'Chennai', 'Gurugram', 'Noida', 'Delhi', 'Kolkata', 'Ahmedabad',
  'Navi Mumbai', 'Thane', 'Kochi', 'Jaipur', 'Chandigarh', 'Indore', 'Coimbatore', 'Thiruvananthapuram', 'Bhubaneswar', 'Lucknow'];
const PLACE_OPTIONS = [{ value: '', label: 'anywhere in India' }, { value: 'remote', label: 'that are remote' },
  ...CITIES.map((c) => ({ value: c, label: `in ${c}` }))];
const DAY_OPTIONS = [1, 3, 7, 14, 30].map((d) => ({ value: d, label: d === 1 ? '24 hours' : `${d} days` }));
const POLL_MS = 1500;
const POLL_FOR_MS = 4 * 60 * 1000;

const STATUS_STYLE = {
  running: { dot: 'bg-purple', text: 'text-ink' },
  done: { dot: 'bg-green', text: 'text-ink' },
  limit: { dot: 'bg-orange', text: 'text-graphite' },
  error: { dot: 'bg-red', text: 'text-graphite' },
};

/** One line per source while a search runs: a pulsing dot, then how many jobs it found. */
function Progress({ sources, done }) {
  const reduce = useReducedMotion();
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-3" aria-live="polite">
      {sources.map((s) => {
        const st = STATUS_STYLE[s.status] || STATUS_STYLE.error;
        return (
          <li key={s.name} className={cx('flex items-center gap-2 text-[14px]', st.text)} title={s.message || ''}>
            <span className="relative flex h-2 w-2" aria-hidden="true">
              {s.status === 'running' && !reduce && <span className="absolute inset-0 animate-pulsering rounded-full bg-purple" />}
              <span className={cx('relative h-2 w-2 rounded-full', st.dot)} />
            </span>
            {s.label}
            <span className="tabular-nums text-silver">
              {s.status === 'running' ? 'searching' : s.status === 'done' ? `${s.count}${s.cached ? ' (saved)' : ''}` : s.status === 'limit' ? 'used up today' : 'failed'}
            </span>
          </li>
        );
      })}
      {!done && <li className="text-[13px] text-silver">Scrapers can take a minute or two.</li>}
    </ul>
  );
}

function JobRecommender() {
  const reduce = useReducedMotion();
  const [setup, setSetup] = useState(null);
  const [setupError, setSetupError] = useState('');
  const [role, setRole] = useState('');
  const [place, setPlace] = useState('');
  const [days, setDays] = useState(14);
  const [selected, setSelected] = useState([]);
  const [result, setResult] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');
  const [sort, setSort] = useState('match');
  const [onlyRemote, setOnlyRemote] = useState(false);
  const poll = useRef(null);

  const loadSetup = async (keepSelection = false) => {
    try {
      const { data } = await api.get('/api/jobs/setup');
      setSetup(data);
      if (!keepSelection) {
        setRole((r) => r || data.defaults.role || '');
        setPlace((p) => p || data.defaults.city || '');
        setSelected(data.sources.filter((s) => s.configured && s.remaining_today > 0).map((s) => s.name));
      }
    } catch (err) {
      setSetupError(errorMessage(err, 'Could not load job sources'));
    }
  };
  useEffect(() => {
    loadSetup();
    return () => clearTimeout(poll.current);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const follow = (id, startedAt) => {
    clearTimeout(poll.current);
    poll.current = setTimeout(async () => {
      try {
        const { data } = await api.get(`/api/jobs/search/${id}`);
        setResult(data);
        if (!data.done && Date.now() - startedAt < POLL_FOR_MS) follow(id, startedAt);
        else loadSetup(true);
      } catch (err) {
        setError(errorMessage(err, 'Lost track of the search. Try again.'));
      }
    }, POLL_MS);
  };

  const search = async (e) => {
    e?.preventDefault();
    if (role.trim().length < 2) { setError('Type the role you are looking for'); return; }
    if (!selected.length) { setError('Turn on at least one source'); return; }
    setError('');
    setStarting(true);
    try {
      const { data } = await api.post('/api/jobs/search', {
        role: role.trim(), city: place === 'remote' ? null : place || null, remote_only: place === 'remote', days, sources: selected,
      });
      setResult(data);
      setSort('match');
      setOnlyRemote(false);
      if (!data.done) follow(data.id, Date.now());
      else loadSetup(true);
      setTimeout(() => document.getElementById('job-results')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    } catch (err) {
      setError(errorMessage(err, 'Could not start the search'));
    } finally {
      setStarting(false);
    }
  };

  const toggle = (name) => setSelected((s) => (s.includes(name) ? s.filter((n) => n !== name) : [...s, name]));
  const setGroup = (names, on) => setSelected((s) => (on ? [...new Set([...s, ...names])] : s.filter((n) => !names.includes(n))));

  const jobs = useMemo(() => {
    const list = (result?.jobs || []).filter((j) => !onlyRemote || j.remote);
    if (sort === 'newest') return [...list].sort((a, b) => (b.posted || '').localeCompare(a.posted || ''));
    return list;
  }, [result, sort, onlyRemote]);

  const ready = setup?.sources.filter((s) => s.configured) || [];
  const running = result && !result.done;

  return (
    <AppShell toneName="purple">
      <PageHeader
        eyebrow="Jobs"
        title="Fresh roles that fit what you already do."
        accent={3}
        subtitle="Live openings from job boards, Naukri, LinkedIn and Wellfound, and the career pages of companies hiring in India, ranked against your primary resume."
      />

      {setupError && <Notice className="mb-8">{setupError}</Notice>}
      {setup && !setup.has_resume && (
        <Notice toneName="orange" className="mb-8">
          Jobs are ranked against your primary resume. <Link to="/resume-analyzer" className="font-medium underline">Add a resume</Link> to see how well each one fits.
        </Notice>
      )}

      <div className="rounded-[32px] border border-black/[0.06] bg-white/60 p-6 backdrop-blur-xl md:p-9">
        <form onSubmit={search}>
          <p className="font-display text-[24px] font-semibold leading-[1.75] tracking-tight text-black/35 md:text-[32px]">
            Find{' '}
            <Combobox variant="inline" value={role} onChange={(e) => setRole(e.target.value)} suggestions={setup?.roles || []} placeholder="a job title" maxLength={100} />{' '}
            jobs{' '}
            <Select variant="inline" value={place} onChange={(e) => setPlace(e.target.value)} options={PLACE_OPTIONS} />
            {place && place !== 'remote' ? ' (and remote)' : ''}, posted in the last{' '}
            <Select variant="inline" value={days} onChange={(e) => setDays(Number(e.target.value))} options={DAY_OPTIONS} />.
          </p>

          <div className="mt-8 border-t border-black/[0.07] pt-8">
            {setup ? <SourcePicker sources={setup.sources} selected={selected} onToggle={toggle} onGroup={setGroup} />
              : <div className="space-y-3"><Skeleton className="h-8 w-2/3" /><Skeleton className="h-8 w-1/2" /></div>}
          </div>

          <div className="mt-8 flex flex-col gap-4 border-t border-black/[0.07] pt-6 md:flex-row md:items-center md:justify-between">
            {error ? <Notice className="md:flex-1">{error}</Notice> : (
              <p className="text-[14px] text-graphite">
                {selected.length} of {ready.length} sources on. Only the role, city and dates are sent to them, never your resume.
              </p>
            )}
            <Button type="submit" size="lg" loading={starting} disabled={starting || running} className="min-w-[200px]">
              {running ? 'Searching...' : 'Search jobs'}
            </Button>
          </div>
        </form>
      </div>

      <div id="job-results" className="scroll-mt-24 pt-16">
        <AnimatePresence mode="wait">
          {result && (
            <motion.div key={result.id} initial={reduce ? false : { opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}>
              <Rise>
                <div className="flex flex-col gap-6 border-b border-black/[0.07] pb-8 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="font-display text-[56px] font-semibold leading-none tracking-tighter2 text-ink md:text-[72px]">
                      <CountNumber value={result.total} />
                      <span className="ml-3 align-middle text-[20px] font-medium tracking-normal text-graphite">
                        {result.total === 1 ? 'opening' : 'openings'} for {result.query.role}
                      </span>
                    </p>
                    <div className="mt-5"><Progress sources={result.sources} done={result.done} /></div>
                  </div>
                  {result.total > 0 && (
                    <div className="flex flex-wrap items-center gap-3">
                      <button type="button" onClick={() => setOnlyRemote((v) => !v)} aria-pressed={onlyRemote}
                        className={cx('rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-colors', onlyRemote ? 'bg-teal text-white' : 'bg-black/[0.05] text-ink hover:bg-black/[0.09]')}>
                        Remote only
                      </button>
                      <Segmented label="Sort jobs" value={sort} onChange={setSort} options={[{ value: 'match', label: 'Best fit' }, { value: 'newest', label: 'Newest' }]} />
                    </div>
                  )}
                </div>
              </Rise>

              {jobs.length > 0 ? (
                <Section index="01" title="Ranked for you" note={setup?.resume_filename ? `Scored against ${breakable(setup.resume_filename)}: skills, role, experience and how recent it is.` : 'Add a resume to rank by fit.'}>
                  {jobs.map((job, i) => <JobRow key={job.id} job={job} rank={i} attribution={result.attribution} />)}
                </Section>
              ) : running ? (
                <div className="space-y-4 pt-10">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-24" />)}</div>
              ) : (
                <div className="py-16">
                  <p className="font-display text-[28px] font-semibold tracking-tight text-ink">No openings matched.</p>
                  <p className="mt-2 max-w-[60ch] text-[16px] leading-[1.6] text-graphite">
                    Try a broader title (Backend Developer rather than Senior Java Backend Developer), anywhere in India, or the last 30 days.
                  </p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

export default JobRecommender;
