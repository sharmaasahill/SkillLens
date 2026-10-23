import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Button, Notice, Skeleton, cx } from '../components/ui/primitives';
import { Select } from '../components/ui/Select';
import { useFeedback } from '../components/ui/overlays';
import { CountNumber, EASE, Line, MiniRing, Section, WordCloud, arcPath, scoreColor } from '../components/ui/studio';
import { dateLabel, downloadBlob, toCsv } from '../lib/format';

const PER_PAGE = 12;
const TEAL = '#30b0c7';
const STATUSES = [
  { value: 'shortlisted', label: 'Shortlisted', color: '#34c759' },
  { value: 'contacted', label: 'Contacted', color: '#007aff' },
  { value: 'interviewing', label: 'Interviewing', color: '#af52de' },
  { value: 'hired', label: 'Hired', color: '#30b0c7' },
  { value: 'rejected', label: 'Rejected', color: '#ff3b30' },
];
const STATUS_BY_VALUE = Object.fromEntries(STATUSES.map((st) => [st.value, st]));
const STATUS_OPTIONS = [{ value: '', label: 'No status' }, ...STATUSES.map(({ value, label }) => ({ value, label }))];
const SORTS = [
  { value: 'created_at', label: 'newest first' }, { value: 'activity', label: 'recently active' },
  { value: 'name', label: 'name' }, { value: 'experience', label: 'experience' }, { value: 'score', label: 'resume score' },
];
const AVATAR_GRADIENTS = [
  'from-[#30b0c7] to-[#007aff]', 'from-[#34c759] to-[#30b0c7]', 'from-[#ff9500] to-[#ff2d55]',
  'from-[#af52de] to-[#5856d6]', 'from-[#ff2d55] to-[#af52de]', 'from-[#5856d6] to-[#007aff]',
];
const INLINE_NUMBER = 'inline-block w-[2.6ch] border-b-2 border-black/15 bg-transparent px-0.5 pb-0.5 text-center font-display font-semibold tracking-tight text-ink placeholder:text-black/25 focus:border-action focus:outline-none';

// The API returns these as JSON objects, whose key order is alphabetical; show them in range order
const inOrder = (obj, order) => order.filter((k) => k in (obj || {})).map((k) => [k, obj[k]]);
const nameOf = (user) => user.full_name || user.email;
const roleLine = (user) => [user.current_work, user.current_company].filter(Boolean).join(' at ');

/* ---------- Small pieces ---------- */

function Avatar({ user, size = 'h-12 w-12 text-[17px]' }) {
  const letter = (user.full_name || user.email || '?')[0].toUpperCase();
  return (
    <span className={cx('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-display font-semibold text-white shadow-[0_8px_20px_-10px_rgba(0,0,0,0.45)]', AVATAR_GRADIENTS[user.id % AVATAR_GRADIENTS.length], size)}>
      {letter}
    </span>
  );
}

/** Round selection tick; the check mark draws itself. */
function Tick({ checked, onChange, label }) {
  return (
    <button
      type="button" role="checkbox" aria-checked={checked} aria-label={label} onClick={onChange}
      className={cx(
        'flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full transition-all duration-300',
        checked ? 'bg-teal text-white shadow-[0_6px_14px_-6px_rgba(48,176,199,0.9)]' : 'text-white ring-[1.5px] ring-inset ring-black/15 hover:ring-black/35'
      )}
    >
      <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
        <motion.path d="M2.5 6.2l2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" initial={false} animate={{ pathLength: checked ? 1 : 0 }} transition={{ duration: 0.3, ease: EASE }} />
      </svg>
    </button>
  );
}

const ICONS = {
  open: 'M5 12h14M13 6l6 6-6 6',
  download: 'M12 4v11m0 0l-4.5-4.5M12 15l4.5-4.5M5 19.5h14',
  remove: 'M7 7l10 10M17 7L7 17',
  restore: 'M9 14L4.5 9.5 9 5M4.5 9.5h10a5 5 0 010 10H11',
};

function IconButton({ label, icon, onClick, href, tone = 'text-ink' }) {
  const cls = cx('flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white hover:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.3)]', tone);
  const glyph = icon === 'linkedin'
    ? <span className="font-display text-[14px] font-bold leading-none">in</span>
    : <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONS[icon]} /></svg>;
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} title={label} className={cls}>{glyph}</a>;
  return <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>{glyph}</button>;
}

/* ---------- Pipeline ---------- */

const W = 1000;
const H = 150;

/** Closed ribbon whose thickness at each stage follows that stage's count, with smooth joins between stages. */
function ribbon(heights) {
  const n = heights.length;
  const pts = [[0, heights[0]], ...heights.map((h, i) => [((i + 0.5) * W) / n, h]), [W, heights[n - 1]]];
  const mid = H / 2;
  const top = pts.map(([x, h]) => [x, mid - h / 2]);
  const bottom = pts.map(([x, h]) => [x, mid + h / 2]).reverse();
  const f = (v) => v.toFixed(1);
  const curve = (list) => list.slice(1).map(([x, y], i) => {
    const [px, py] = list[i];
    const c = (px + x) / 2;
    return `C ${f(c)} ${f(py)} ${f(c)} ${f(y)} ${f(x)} ${f(y)}`;
  }).join(' ');
  return `M ${f(top[0][0])} ${f(top[0][1])} ${curve(top)} L ${f(bottom[0][0])} ${f(bottom[0][1])} ${curve(bottom)} Z`;
}

/** Hiring pipeline as a flowing stream. Each stage is a filter; the active one is underlined. */
function Pipeline({ stats, view, statusFilter, onStage, onRemoved }) {
  const reduce = useReducedMotion();
  const total = stats.total_users || 0;
  const counts = stats.status_counts || {};
  const reviewed = Object.values(counts).reduce((a, b) => a + b, 0);
  const stages = [
    { key: '', label: 'All candidates', count: total, color: TEAL },
    ...STATUSES.filter((s) => s.value !== 'rejected').map((s) => ({ key: s.value, label: s.label, count: counts[s.value] || 0, color: s.color })),
  ];
  const extras = [
    { key: 'none', label: 'Not reviewed', count: Math.max(0, total - reviewed), color: '#c7c7cc', onClick: () => onStage('none') },
    { key: 'rejected', label: 'Rejected', count: counts.rejected || 0, color: '#ff3b30', onClick: () => onStage('rejected') },
    { key: 'removed', label: 'Removed', count: stats.removed_count || 0, color: '#86868b', onClick: onRemoved },
  ];
  const n = stages.length;
  const max = Math.max(1, ...stages.map((s) => s.count));
  const d = ribbon(stages.map((s) => 12 + (s.count / max) * (H - 28)));
  const active = view === 'removed' ? 'removed' : statusFilter;
  const avg = stats.average_score || 0;

  return (
    <section aria-label="Hiring pipeline">
      <div className="-mx-6 overflow-x-auto px-6 pb-2 [scrollbar-width:none]">
        <div className="min-w-[640px]">
          <div className="grid" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
            {stages.map((s, i) => {
              const on = active === s.key;
              return (
                <button key={s.label} type="button" onClick={() => onStage(s.key)} aria-pressed={on} className="group flex flex-col items-center px-2 text-center">
                  <span className={cx('font-display text-[38px] font-semibold leading-none tracking-tighter2 transition-colors duration-300 md:text-[56px]', on ? 'text-ink' : 'text-black/25 group-hover:text-ink')}>
                    <CountNumber value={s.count} />
                  </span>
                  <span className={cx('relative mt-3 flex items-center gap-2 pb-2 text-[13px] font-medium transition-colors', on ? 'text-ink' : 'text-graphite')}>
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />
                    {s.label}
                    {on && <motion.span layoutId="stage-line" className="absolute inset-x-0 bottom-0 h-[2px] rounded-full" style={{ background: s.color }} transition={{ duration: 0.5, ease: EASE }} />}
                  </span>
                  <span className="text-[12px] tabular-nums text-silver">{i === 0 ? `${stats.users_with_resume || 0} with a resume` : `${total ? Math.round((s.count / total) * 100) : 0}% of all`}</span>
                </button>
              );
            })}
          </div>

          <div className="relative mt-7 h-[110px] md:h-[140px]" aria-hidden="true">
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
              <defs>
                <linearGradient id="pipe-grad" x1="0" y1="0" x2="1" y2="0">
                  {stages.map((s, i) => <stop key={s.label} offset={`${((i + 0.5) / n) * 100}%`} stopColor={s.color} />)}
                </linearGradient>
                <linearGradient id="pipe-sheen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#fff" stopOpacity="0.55" />
                  <stop offset="45%" stopColor="#fff" stopOpacity="0" />
                </linearGradient>
                <clipPath id="pipe-clip">
                  <motion.rect x="0" y="0" height={H} initial={reduce ? false : { width: 0 }} animate={{ width: W }} transition={{ duration: 1.8, ease: EASE, delay: 0.35 }} />
                </clipPath>
              </defs>
              {stages.map((s, i) => (
                <line key={s.label} x1={((i + 0.5) * W) / n} x2={((i + 0.5) * W) / n} y1="0" y2={H} stroke="rgba(0,0,0,0.09)" strokeDasharray="2 5" vectorEffect="non-scaling-stroke" />
              ))}
              <g clipPath="url(#pipe-clip)">
                <motion.path initial={false} animate={{ d }} transition={{ duration: 0.9, ease: EASE }} fill="url(#pipe-grad)" opacity="0.88" />
                <motion.path initial={false} animate={{ d }} transition={{ duration: 0.9, ease: EASE }} fill="url(#pipe-sheen)" />
                <path d={`M 0 ${H / 2} L ${W} ${H / 2}`} fill="none" stroke="#fff" strokeOpacity="0.8" strokeWidth="1.5" strokeDasharray="3 21" className="animate-ants" vectorEffect="non-scaling-stroke" />
              </g>
            </svg>
            {stages.map((s, i) => (
              <span key={s.label} className="absolute top-1/2" style={{ left: `${((i + 0.5) / n) * 100}%` }}>
                <span className="relative -ml-[7px] -mt-[7px] block h-[14px] w-[14px]">
                  {active === s.key && <span className="absolute inset-0 animate-pulsering rounded-full" style={{ background: s.color }} />}
                  <span className="absolute inset-0 rounded-full bg-white transition-transform duration-500" style={{ boxShadow: `0 0 0 3px ${s.color}, 0 6px 14px -4px rgba(0,0,0,0.3)`, transform: active === s.key ? 'scale(1.25)' : 'scale(1)' }} />
                </span>
              </span>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-5 border-t border-black/[0.07] pt-6 lg:flex-row lg:items-center lg:justify-between">
        <p className="max-w-[62ch] text-[15px] leading-[1.6] text-graphite">
          Average ATS score{' '}
          <span className="font-semibold tabular-nums" style={{ color: scoreColor(avg) }}>{avg}%</span>
          {' '}across <span className="font-semibold tabular-nums text-ink">{stats.total_resumes || 0}</span> resumes.
          {' '}Click a stage to see who is in it.
        </p>
        <div className="flex flex-wrap gap-x-8 gap-y-3">
          {extras.map((x) => {
            const on = active === x.key;
            return (
              <button key={x.key} type="button" onClick={x.onClick} aria-pressed={on} className="group relative flex items-baseline gap-2 pb-2 text-[14px]">
                <span className="h-1.5 w-1.5 self-center rounded-full" style={{ background: x.color }} aria-hidden="true" />
                <span className={cx('transition-colors', on ? 'font-medium text-ink' : 'text-graphite group-hover:text-ink')}>{x.label}</span>
                <span className="font-display text-[18px] font-semibold tabular-nums text-ink">{x.count}</span>
                {on && <motion.span layoutId="stage-line" className="absolute inset-x-0 bottom-0 h-[2px] rounded-full" style={{ background: x.color }} transition={{ duration: 0.5, ease: EASE }} />}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/* ---------- Search and filters ---------- */

function FilterSentence({ f, set, lists, onApply, onClear }) {
  const val = (name) => (e) => set[name](e.target.value);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onApply(); }} className="mt-8 border-t border-black/[0.07] pt-8">
      <p className="font-display text-[21px] font-semibold leading-[1.9] tracking-tight text-black/35 md:text-[27px]">
        Show people working as{' '}
        <Select variant="inline" value={f.jobRole} onChange={val('jobRole')} options={lists.jobRoles} placeholder="any role" />{' '}
        in{' '}
        <Select variant="inline" value={f.location} onChange={val('location')} options={lists.locations} placeholder="any city" />{' '}
        at{' '}
        <Select variant="inline" value={f.company} onChange={val('company')} options={lists.companies} placeholder="any company" />, who know{' '}
        <Select variant="inline" value={f.skills} onChange={val('skills')} options={lists.skills} placeholder="any skill" />, with{' '}
        <input type="number" min="0" max="60" value={f.minExperience} onChange={val('minExperience')} placeholder="0" aria-label="Minimum years of experience" className={INLINE_NUMBER} />{' '}
        to{' '}
        <input type="number" min="0" max="60" value={f.maxExperience} onChange={val('maxExperience')} placeholder="20" aria-label="Maximum years of experience" className={INLINE_NUMBER} />{' '}
        years, a resume score of at least{' '}
        <input type="number" min="0" max="100" value={f.minScore} onChange={val('minScore')} placeholder="0" aria-label="Minimum resume score" className={cx(INLINE_NUMBER, 'w-[3.2ch]')} />, and{' '}
        <Select variant="inline" value={f.hasResume} onChange={val('hasResume')} options={[{ value: 'true', label: 'with' }, { value: 'false', label: 'without' }]} placeholder="with or without" />{' '}
        a resume.
      </p>
      <div className="mt-6 flex items-center gap-5">
        <Button type="submit" variant="dark">Apply filters</Button>
        <button type="button" onClick={onClear} className="text-[15px] font-medium text-graphite hover:text-ink">Clear all</button>
      </div>
    </form>
  );
}

/* ---------- Candidate list ---------- */

function CandidateRow({ user, index, selected, onToggle, onView, onDownload, onStatus, onRemove, removedView }) {
  const st = STATUS_BY_VALUE[user.review?.status];
  const meta = [user.current_location, user.total_experience ? `${user.total_experience} yrs` : null, user.email].filter(Boolean).join(' · ');
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 18 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -60, transition: { duration: 0.35, ease: EASE } }}
      transition={{ duration: 0.5, ease: EASE, delay: Math.min(index, 12) * 0.035 }}
      className={cx(
        // Raised while hovered or focused so its status menu opens above the rows below
        'group relative grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-4 rounded-[22px] px-3 py-5 transition-colors duration-300 focus-within:z-10 hover:z-10 md:gap-6 md:px-4',
        'lg:grid-cols-[22px_minmax(0,1.45fr)_minmax(0,1fr)_48px_170px_168px]',
        selected ? 'bg-teal-soft/70' : 'hover:bg-white/70'
      )}
    >
      <span aria-hidden="true" className={cx('absolute bottom-5 left-0 top-5 w-[3px] origin-center rounded-full bg-gradient-to-b from-[#30b0c7] to-[#007aff] transition-transform duration-500', selected ? 'scale-y-100' : 'scale-y-0 group-hover:scale-y-100')} />
      <Tick checked={selected} onChange={() => onToggle(user.id)} label={`Select ${nameOf(user)}`} />

      <button type="button" onClick={() => onView(user)} className="flex min-w-0 items-center gap-4 text-left">
        <Avatar user={user} />
        <span className="min-w-0">
          <span className="flex items-center gap-2">
            <span className="truncate font-display text-[19px] font-semibold tracking-tight text-ink transition-colors group-hover:text-teal-ink">{user.full_name || 'No name'}</span>
            {user.review?.returned && <span className="shrink-0 text-[12px] font-medium text-orange-ink" title="Used SkillLens again after being removed">Active again</span>}
          </span>
          <span className="block truncate text-[14px] text-graphite">{roleLine(user) || 'No position yet'}</span>
          <span className="block truncate text-[13px] text-silver">{meta}</span>
          {st && <span className="mt-1 flex items-center gap-1.5 text-[13px] text-ink/80 lg:hidden"><span className="h-1.5 w-1.5 rounded-full" style={{ background: st.color }} />{st.label}</span>}
        </span>
      </button>

      <div className="hidden min-w-0 lg:block">
        {user.all_skills?.length ? (
          <p className="line-clamp-2 text-[14px] leading-[1.55] text-ink/70">
            {user.all_skills.slice(0, 5).join(' · ')}
            {user.all_skills.length > 5 && <span className="text-silver">{` +${user.all_skills.length - 5}`}</span>}
          </p>
        ) : <p className="text-[14px] text-silver">No skills yet</p>}
        <p className="mt-1 text-[12px] text-silver">
          {user.resume_count} resume{user.resume_count === 1 ? '' : 's'}
          {user.review?.note ? ' · has a note' : ''}
        </p>
      </div>

      <MiniRing value={user.latest_score ?? null} size={46} label={user.latest_score ? `Primary resume score ${Math.round(user.latest_score)}` : 'No resume score'} />

      <div className="hidden items-center gap-2 text-[14px] lg:flex">
        <span className="h-2 w-2 shrink-0 rounded-full transition-colors" style={{ background: st?.color || '#d2d2d7' }} aria-hidden="true" />
        <Select variant="inline" value={user.review?.status || ''} onChange={(e) => onStatus(user, e.target.value)} options={STATUS_OPTIONS} />
      </div>

      <div className="hidden items-center justify-end gap-0.5 transition-opacity duration-300 lg:flex lg:opacity-0 lg:group-focus-within:opacity-100 lg:group-hover:opacity-100">
        {user.profile_resume_filename && <IconButton label="Download resume" icon="download" onClick={() => onDownload(user.id)} tone="text-green-ink" />}
        {user.linkedin_url && <IconButton label="LinkedIn profile" icon="linkedin" href={user.linkedin_url} tone="text-blue-ink" />}
        <IconButton
          label={removedView ? 'Restore to the list' : 'Remove from the list'} icon={removedView ? 'restore' : 'remove'}
          onClick={() => onRemove(user, !removedView)} tone={removedView ? 'text-ink' : 'text-red-ink'}
        />
        <IconButton label="Open details" icon="open" onClick={() => onView(user)} />
      </div>
    </motion.li>
  );
}

function Pager({ page, pages, onPage }) {
  if (pages <= 1) return null;
  const nums = Array.from({ length: pages }, (_, i) => i + 1).filter((n) => n === 1 || n === pages || Math.abs(n - page) <= 1);
  return (
    <nav className="mt-10 flex items-center justify-between border-t border-black/[0.07] pt-6" aria-label="Candidate pages">
      <button type="button" onClick={() => onPage(Math.max(1, page - 1))} disabled={page <= 1} className="text-[15px] font-medium text-ink transition-opacity hover:text-teal-ink disabled:opacity-25">
        <span aria-hidden="true">&larr;</span> Previous
      </button>
      <div className="flex items-center gap-1">
        {nums.map((n, i) => (
          <React.Fragment key={n}>
            {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-silver">...</span>}
            <button
              type="button" onClick={() => onPage(n)} aria-current={n === page ? 'page' : undefined}
              className={cx('relative h-10 min-w-[40px] px-2 font-display text-[17px] tabular-nums transition-colors', n === page ? 'font-semibold text-ink' : 'text-silver hover:text-ink')}
            >
              {String(n).padStart(2, '0')}
              {n === page && <motion.span layoutId="page-dot" className="absolute inset-x-0 bottom-0.5 mx-auto h-1 w-1 rounded-full bg-teal" />}
            </button>
          </React.Fragment>
        ))}
      </div>
      <button type="button" onClick={() => onPage(Math.min(pages, page + 1))} disabled={page >= pages} className="text-[15px] font-medium text-ink transition-opacity hover:text-teal-ink disabled:opacity-25">
        Next <span aria-hidden="true">&rarr;</span>
      </button>
    </nav>
  );
}

/** Floating action bar for the current selection. Stages are plain buttons so nothing opens off-screen. */
function BulkBar({ count, removedView, onStatus, onRemove, onExport, onClear }) {
  return (
    <AnimatePresence>
      {count > 0 && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <motion.div
            initial={{ y: 90, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 90, opacity: 0 }} transition={{ duration: 0.5, ease: EASE }}
            className="pointer-events-auto flex max-w-full flex-wrap items-center gap-x-5 gap-y-2 rounded-[28px] bg-white/85 px-5 py-3 text-[14px] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.45)] ring-1 ring-black/[0.06] backdrop-blur-2xl"
          >
            <span className="flex items-center gap-2 font-medium text-ink">
              <span className="flex h-7 min-w-[28px] items-center justify-center rounded-full bg-teal px-2 text-[13px] font-semibold tabular-nums text-white">{count}</span>
              selected
            </span>
            <span className="hidden h-5 w-px bg-black/10 md:block" aria-hidden="true" />
            <span className="text-silver">Mark as</span>
            {STATUSES.map((s) => (
              <button key={s.value} type="button" onClick={() => onStatus(s.value)} className="flex items-center gap-1.5 font-medium text-ink/75 transition-colors hover:text-ink">
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.color }} aria-hidden="true" />{s.label}
              </button>
            ))}
            <span className="hidden h-5 w-px bg-black/10 md:block" aria-hidden="true" />
            <button type="button" onClick={onRemove} className={cx('font-medium', removedView ? 'text-ink' : 'text-red-ink')}>{removedView ? 'Restore' : 'Remove'}</button>
            <button type="button" onClick={onExport} className="font-medium text-action-link">Export</button>
            <button type="button" onClick={onClear} className="text-silver transition-colors hover:text-ink">Clear</button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Details drawer ---------- */

function Drawer({ open, onClose, label, children }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => panelRef.current?.focus(), 40);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[80]">
          <motion.div
            className="absolute inset-0 bg-black/25 backdrop-blur-[3px]"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}
            onMouseDown={onClose}
          />
          <motion.aside
            ref={panelRef} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}
            className="absolute inset-y-0 right-0 flex w-full max-w-[620px] flex-col overflow-hidden bg-[#fbfbfd] shadow-[-40px_0_90px_-40px_rgba(0,0,0,0.45)] outline-none"
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ duration: 0.6, ease: EASE }}
          >
            <div aria-hidden="true" className="pointer-events-none absolute -right-24 -top-32 h-96 w-96 animate-drift rounded-full opacity-30 blur-3xl" style={{ background: 'radial-gradient(closest-side, #30b0c7, transparent)' }} />
            <div className="relative flex items-center justify-between px-7 pt-6 md:px-10">
              <p className="text-[12px] font-semibold uppercase tracking-[0.16em] text-teal-ink">Candidate</p>
              <button type="button" onClick={onClose} aria-label="Close details" className="flex h-10 w-10 items-center justify-center rounded-full text-graphite transition hover:rotate-90 hover:bg-white hover:text-ink hover:shadow-[0_6px_18px_-8px_rgba(0,0,0,0.3)]">
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d={ICONS.remove} /></svg>
              </button>
            </div>
            <div className="relative flex-1 overflow-y-auto px-7 pb-14 md:px-10">{children}</div>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  );
}

function Block({ title, children, delay = 0 }) {
  return (
    <motion.section
      className="border-t border-black/[0.07] py-8"
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay }}
    >
      <h3 className="mb-5 text-[12px] font-semibold uppercase tracking-[0.14em] text-silver">{title}</h3>
      {children}
    </motion.section>
  );
}

/** Stage and private note for one candidate. Only HR can see this. */
function ReviewPanel({ details, onSaved }) {
  const { notify } = useFeedback();
  const [status, setStatus] = useState(details.review?.status || '');
  const [note, setNote] = useState(details.review?.note || '');
  const [saving, setSaving] = useState(false);
  const dirty = status !== (details.review?.status || '') || note !== (details.review?.note || '');

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch(`/hr/candidates/${details.id}/review`, { status: status || null, note });
      onSaved(details.id, data.review);
      notify('Review saved');
    } catch (err) {
      notify(errorMessage(err, 'Could not save'), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Block title="Your review">
      <div role="radiogroup" aria-label="Stage" className="flex flex-wrap gap-x-6 gap-y-3">
        {[{ value: '', label: 'No status', color: '#aeaeb2' }, ...STATUSES].map((s) => {
          const on = status === s.value;
          return (
            <button key={s.value || 'none'} type="button" role="radio" aria-checked={on} onClick={() => setStatus(s.value)} className="relative flex items-center gap-2 pb-2 text-[15px]">
              <span className="h-2.5 w-2.5 rounded-full transition-colors" style={{ background: on ? s.color : 'transparent', boxShadow: `inset 0 0 0 1.5px ${s.color}` }} aria-hidden="true" />
              <span className={on ? 'font-medium text-ink' : 'text-graphite hover:text-ink'}>{s.label}</span>
              {on && <motion.span layoutId="review-stage" className="absolute inset-x-0 bottom-0 h-[2px] rounded-full" style={{ background: s.color }} transition={{ duration: 0.45, ease: EASE }} />}
            </button>
          );
        })}
      </div>
      <label className="mt-6 block">
        <span className="text-[13px] font-medium text-graphite">Private note</span>
        <textarea
          rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="For example: strong SQL, ask about notice period"
          className="mt-2 block w-full resize-none rounded-2xl border border-black/[0.08] bg-white/80 px-4 py-3 text-[15px] leading-[1.55] text-ink placeholder:text-silver transition focus:border-action/60 focus:outline-none focus:ring-4 focus:ring-action/10"
        />
      </label>
      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-[13px] text-silver">
          {dirty ? 'Unsaved changes' : details.review?.updated_at ? `Last updated ${dateLabel(details.review.updated_at)}` : 'Not reviewed yet'}
        </p>
        <Button size="sm" variant="dark" onClick={save} loading={saving} disabled={!dirty}>Save review</Button>
      </div>
    </Block>
  );
}

function Facts({ items }) {
  const shown = items.filter(([, v]) => v !== null && v !== undefined && v !== '');
  if (!shown.length) return <p className="text-[15px] text-graphite">Not filled in yet.</p>;
  return (
    <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
      {shown.map(([label, value]) => (
        <div key={label} className="min-w-0">
          <dt className="text-[12px] text-silver">{label}</dt>
          <dd className="mt-1 whitespace-pre-line break-words text-[15px] leading-[1.5] text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function CandidateDetails({ user, details, onSaved, onDownload, onRemove }) {
  const removed = Boolean((details || user).review?.removed);
  const score = user.latest_score;
  return (
    <div>
      <div className="flex items-start justify-between gap-6 pb-8 pt-6">
        <div className="min-w-0">
          <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, ease: EASE, delay: 0.15 }}>
            <Avatar user={user} size="h-16 w-16 text-[26px]" />
          </motion.div>
          <motion.h2
            className="mt-5 break-words font-display text-[32px] font-semibold leading-[1.05] tracking-tighter2 text-ink md:text-[38px]"
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.22 }}
          >
            {user.full_name || user.email}
          </motion.h2>
          <p className="mt-2 text-[16px] text-graphite">{roleLine(user) || 'No position yet'}</p>
          <p className="mt-1 text-[14px] text-silver">{[user.current_location, user.total_experience ? `${user.total_experience} years experience` : null].filter(Boolean).join(' · ')}</p>
        </div>
        <div className="flex shrink-0 flex-col items-center pt-2">
          <MiniRing value={score ?? null} size={64} stroke={5} label="Primary resume score" />
          <p className="mt-2 text-[12px] text-silver">Resume score</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-3 pb-8 text-[14px] font-medium">
        <a href={`mailto:${user.email}`} className="text-action-link hover:underline">Email</a>
        {user.profile_resume_filename && <button type="button" onClick={() => onDownload(user.id)} className="text-green-ink hover:underline">Download resume</button>}
        {user.linkedin_url && <a href={user.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-ink hover:underline">LinkedIn</a>}
        {details?.website_url && <a href={details.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-ink hover:underline">Website</a>}
        <button type="button" onClick={() => onRemove(user, !removed)} className={removed ? 'text-ink hover:underline' : 'text-red-ink hover:underline'}>
          {removed ? 'Restore to the list' : 'Remove from the list'}
        </button>
      </div>

      {!details ? (
        <div className="space-y-4 border-t border-black/[0.07] pt-8"><Skeleton className="h-24" /><Skeleton className="h-36" /><Skeleton className="h-28" /></div>
      ) : (
        <>
          <ReviewPanel key={`${details.id}-${details.review?.updated_at || ''}`} details={details} onSaved={onSaved} />

          {user.all_skills?.length > 0 && (
            <Block title="Skills" delay={0.05}>
              <WordCloud words={user.all_skills} colorFor={(_, i) => (i < 3 ? '#0071a4' : i < 8 ? '#1d1d1f' : '#86868b')} />
              {details.skills_summary && <p className="mt-5 text-[15px] leading-[1.6] text-graphite">{details.skills_summary}</p>}
            </Block>
          )}

          <Block title="Contact and work" delay={0.1}>
            <Facts items={[
              ['Email', details.email], ['Phone', details.phone_number], ['Age', details.age], ['Address', details.address],
              ['Position', details.current_work], ['Company', details.current_company], ['Location', details.current_location],
              ['Experience', details.total_experience ? `${details.total_experience} years` : null],
            ]}
            />
          </Block>

          {(details.education || details.languages || details.certifications || details.achievements || details.bio) && (
            <Block title="Background" delay={0.15}>
              {details.bio && <p className="mb-6 text-[16px] leading-[1.6] text-ink">{details.bio}</p>}
              <Facts items={[
                ['Education', details.education], ['Languages', details.languages],
                ['Certifications', details.certifications], ['Achievements', details.achievements],
              ]}
              />
            </Block>
          )}

          {details.resume_history?.length > 0 && (
            <Block title="Resumes" delay={0.2}>
              <ul>
                {details.resume_history.map((resume) => (
                  <li key={resume.id} className="flex items-center gap-4 border-b border-black/[0.06] py-3.5 last:border-0">
                    <MiniRing value={resume.score ?? null} size={38} stroke={3.5} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium text-ink">{resume.filename}</p>
                      <p className="text-[13px] text-silver">{dateLabel(resume.uploaded_at)}{resume.skills?.length ? ` · ${resume.skills.length} skills` : ''}</p>
                    </div>
                    {resume.is_primary && <span className="text-[13px] font-medium text-green-ink">Primary</span>}
                  </li>
                ))}
              </ul>
            </Block>
          )}

          {details.profile_history?.length > 0 && (
            <Block title="Career changes" delay={0.25}>
              <ol className="relative ml-1 border-l border-black/[0.1]">
                {details.profile_history.map((change, i) => (
                  <li key={`${change.changed_at}-${i}`} className="relative pb-5 pl-6 last:pb-0">
                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-white ring-2 ring-teal" aria-hidden="true" />
                    <p className="text-[15px] text-ink">{change.current_work || 'No position'}{change.current_company ? ` at ${change.current_company}` : ''}</p>
                    <p className="text-[13px] text-silver">{dateLabel(change.changed_at)}</p>
                  </li>
                ))}
              </ol>
            </Block>
          )}
        </>
      )}
    </div>
  );
}

/* ---------- Analytics ---------- */

const SCORE_BUCKETS = [['0-40', '0 to 40', '#ff3b30'], ['41-60', '41 to 60', '#ff9500'], ['61-80', '61 to 80', '#ffcc00'], ['81-100', '81 to 100', '#34c759']];

/** Donut of score buckets with the average in the middle. */
function ScoreArcs({ distribution, average }) {
  const reduce = useReducedMotion();
  const size = 260;
  const c = size / 2;
  const r = c - 20;
  const entries = SCORE_BUCKETS.map(([key, label, color]) => ({ key, label, color, count: distribution?.[key] || 0 }));
  const sum = entries.reduce((s, e) => s + e.count, 0);
  const nonZero = entries.filter((e) => e.count > 0).length;
  const gap = nonZero > 1 ? 4 : 0;
  let cursor = 0;
  return (
    <div className="flex flex-col items-center gap-10 sm:flex-row sm:items-center">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" role="img" aria-label={entries.map((e) => `${e.label}: ${e.count}`).join(', ')}>
          <circle cx={c} cy={c} r={r} fill="none" stroke="#ececf0" strokeWidth="20" />
          {sum > 0 && entries.map((e, i) => {
            if (!e.count) return null;
            const span = (e.count / sum) * 360;
            const start = cursor + gap / 2;
            const end = cursor + Math.min(span - gap / 2, 359.9);
            cursor += span;
            return (
              <motion.path
                key={e.key} d={arcPath(c, c, r, start, Math.max(start + 0.5, end))} fill="none" stroke={e.color} strokeWidth="20" strokeLinecap="round"
                initial={reduce ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }}
                transition={{ duration: 1, ease: EASE, delay: 0.2 + i * 0.15 }}
              />
            );
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <p className="font-display text-[56px] font-semibold leading-none tracking-tighter2 text-ink"><CountNumber value={Math.round(average || 0)} /></p>
          <p className="mt-1 text-[13px] text-graphite">average score</p>
        </div>
      </div>
      <ul className="w-full space-y-4">
        {entries.map((e) => (
          <li key={e.key} className="flex items-baseline justify-between gap-4 border-b border-black/[0.06] pb-3">
            <span className="flex items-center gap-2.5 text-[15px] text-ink"><span className="h-2 w-2 rounded-full" style={{ background: e.color }} aria-hidden="true" />{e.label}</span>
            <span className="text-[13px] text-silver">
              <span className="mr-2 font-display text-[19px] font-semibold tabular-nums text-ink">{e.count}</span>
              {sum ? `${Math.round((e.count / sum) * 100)}%` : '0%'}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function RankedLines({ entries }) {
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="text-[15px] text-graphite">No data yet.</p>;
  return (
    <ol className="space-y-5">
      {entries.map(([label, value], i) => (
        <li key={label} className="grid grid-cols-[2.2ch_minmax(0,1fr)_auto] items-baseline gap-x-4">
          <span className="text-[13px] tabular-nums text-silver">{String(i + 1).padStart(2, '0')}</span>
          <div className="min-w-0">
            <p className="truncate text-[16px] font-medium text-ink">{label}</p>
            <Line value={(value / max) * 100} color="linear-gradient(90deg, #30b0c7, #007aff)" className="mt-2" delay={i * 0.06} />
          </div>
          <span className="font-display text-[20px] font-semibold tabular-nums text-ink">{value}</span>
        </li>
      ))}
    </ol>
  );
}

/** Cities sized by how many candidates live there. */
function CityCloud({ entries }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="text-[15px] text-graphite">No data yet.</p>;
  return (
    <div className="flex flex-wrap content-start items-baseline gap-x-6 gap-y-3 self-start">
      {entries.map(([city, count], i) => (
        <motion.span
          key={city}
          className="font-display font-semibold tracking-tight"
          style={{ fontSize: 17 + (count / max) * 30, color: i === 0 ? '#0071a4' : `rgba(29,29,31,${0.4 + (count / max) * 0.6})` }}
          initial={reduce ? false : { opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
          transition={{ duration: 0.6, ease: EASE, delay: i * 0.05 }}
          title={`${count} candidate${count === 1 ? '' : 's'}`}
        >
          {city}<sup className="ml-1 align-super text-[12px] font-medium tabular-nums text-silver">{count}</sup>
        </motion.span>
      ))}
    </div>
  );
}

function ExperienceSpread({ distribution }) {
  const entries = inOrder(distribution, ['0-2', '3-5', '6-10', '10+']);
  const max = Math.max(1, ...entries.map(([, v]) => v));
  if (!entries.length) return <p className="text-[15px] text-graphite">No data yet.</p>;
  return (
    <div className="grid grid-cols-2 gap-x-8 gap-y-10 md:grid-cols-4">
      {entries.map(([band, count], i) => (
        <div key={band}>
          <p className="font-display text-[44px] font-semibold leading-none tracking-tighter2 text-ink md:text-[52px]"><CountNumber value={count} /></p>
          <p className="mt-2 text-[14px] text-graphite">{band.replace('-', ' to ')} years</p>
          <Line value={(count / max) * 100} color={['#30b0c7', '#007aff', '#5856d6', '#af52de'][i % 4]} className="mt-4" delay={i * 0.08} />
        </div>
      ))}
    </div>
  );
}

/* ---------- Page ---------- */

const HRDashboard = () => {
  const { notify } = useFeedback();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('active'); // 'active' | 'removed'
  const [statusFilter, setStatusFilter] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [error, setError] = useState('');

  const [jobRoleFilter, setJobRoleFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [skillsFilter, setSkillsFilter] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const [maxExperience, setMaxExperience] = useState('');
  const [minScore, setMinScore] = useState('');
  const [hasResume, setHasResume] = useState('');

  const [jobRoles, setJobRoles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [skills, setSkills] = useState([]);

  const [showFilters, setShowFilters] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [reloadKey, setReloadKey] = useState(0);
  const isFirstLoad = useRef(true);
  const analyticsRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    fetchDropdownData();
    fetchSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Debounce typing in the search box; page, sort and filter changes load almost immediately
    const delay = isFirstLoad.current ? 0 : 300;
    isFirstLoad.current = false;
    const timer = setTimeout(() => fetchHRData(page), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortBy, searchTerm, reloadKey, view, statusFilter]);

  const fetchHRData = async (pageToLoad = page) => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (jobRoleFilter) params.append('job_role', jobRoleFilter);
      if (locationFilter) params.append('location', locationFilter);
      if (companyFilter) params.append('company', companyFilter);
      if (skillsFilter) params.append('skills', skillsFilter);
      if (minExperience) params.append('min_experience', minExperience);
      if (maxExperience) params.append('max_experience', maxExperience);
      if (minScore) params.append('min_score', minScore);
      if (hasResume) params.append('has_resume', hasResume);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      params.append('view', view);
      if (statusFilter) params.append('status', statusFilter);
      params.append('sort', sortBy);
      params.append('page', pageToLoad);
      params.append('per_page', PER_PAGE);

      // Only the candidate list changes with paging, search and filters
      const usersResponse = await api.get(`/hr/all-users?${params.toString()}`);
      setUsers(usersResponse.data.users);
      setPagination({ total: usersResponse.data.total_users, pages: usersResponse.data.pages });
      setError('');
    } catch (err) {
      if (err.response?.status === 403) setError('Access denied. HR privileges required.');
      else if (err.response?.status !== 401) setError('Failed to load HR data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Totals and analytics cover every candidate, so they load once, on Refresh and after changes
  const fetchSummary = async () => {
    try {
      const [statsResponse, analyticsResponse] = await Promise.all([api.get('/hr/stats'), api.get('/hr/analytics')]);
      setStats(statsResponse.data);
      setAnalytics(analyticsResponse.data);
    } catch (err) {
      if (err.response?.status !== 401) setError('Failed to load HR data');
    }
  };

  const fetchDropdownData = async () => {
    try {
      const [roles, locs, comps, skillList] = await Promise.all([
        api.get('/hr/job-roles'), api.get('/hr/locations'), api.get('/hr/companies'), api.get('/hr/skills'),
      ]);
      setJobRoles(roles.data.job_roles);
      setLocations(locs.data.locations);
      setCompanies(comps.data.companies);
      setSkills(skillList.data.skills);
    } catch (err) {
      console.error('Error fetching dropdown data:', err);
    }
  };

  const openDetails = async (user) => {
    setSelectedUser(user);
    setUserDetails(null);
    try {
      const response = await api.get(`/hr/user/${user.id}`);
      setUserDetails(response.data);
    } catch (err) {
      setSelectedUser(null);
      notify('Failed to load user details', 'error');
    }
  };

  const closeDetails = () => { setSelectedUser(null); setUserDetails(null); };

  const downloadUserResume = async (userId) => {
    try {
      const response = await api.get(`/hr/download-profile-resume/${userId}`, { responseType: 'blob' });
      downloadBlob(response.data, `user_${userId}_resume.pdf`);
    } catch (err) {
      notify('Failed to download resume', 'error');
    }
  };

  const reload = () => { setPage(1); setReloadKey((k) => k + 1); };

  const applyReview = (id, review) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, review } : u)));
    setSelectedUser((u) => (u && u.id === id ? { ...u, review } : u));
    setUserDetails((d) => (d && d.id === id ? { ...d, review } : d));
    fetchSummary();
  };

  const changeStatus = async (user, status) => {
    try {
      const { data } = await api.patch(`/hr/candidates/${user.id}/review`, { status: status || null });
      applyReview(user.id, data.review);
    } catch (err) {
      notify(errorMessage(err, 'Could not update status'), 'error');
    }
  };

  const setRemoved = async (user, remove) => {
    try {
      await api.post(`/hr/candidates/${user.id}/${remove ? 'remove' : 'restore'}`);
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      setPagination((p) => ({ ...p, total: Math.max(0, p.total - 1) }));
      setSelectedUsers((prev) => prev.filter((id) => id !== user.id));
      if (selectedUser?.id === user.id) closeDetails();
      notify(remove
        ? `${nameOf(user)} removed. They come back if they use SkillLens again.`
        : `${nameOf(user)} restored`);
      fetchSummary();
    } catch (err) {
      notify(errorMessage(err, 'Could not update candidate'), 'error');
    }
  };

  const bulk = async (action, status) => {
    if (!selectedUsers.length) return;
    try {
      await api.post('/hr/candidates/bulk', { user_ids: selectedUsers, action, status: status || null });
      notify(`Updated ${selectedUsers.length} candidate${selectedUsers.length === 1 ? '' : 's'}`);
      setSelectedUsers([]);
      setReloadKey((k) => k + 1);
      fetchSummary();
    } catch (err) {
      notify(errorMessage(err, 'Bulk update failed'), 'error');
    }
  };

  // Pipeline stages and the removed list double as filters
  const pickStage = (key) => {
    if (view !== 'active') setSelectedUsers([]);
    setView('active');
    setStatusFilter((cur) => (cur === key && key ? '' : key));
    setPage(1);
  };
  const showRemoved = () => {
    if (view !== 'removed') setSelectedUsers([]);
    setView('removed');
    setStatusFilter('');
    setPage(1);
  };

  const clearAllFilters = () => {
    setSearchTerm('');
    setStatusFilter('');
    setJobRoleFilter('');
    setLocationFilter('');
    setCompanyFilter('');
    setSkillsFilter('');
    setMinExperience('');
    setMaxExperience('');
    setMinScore('');
    setHasResume('');
    reload();
  };

  const exportToCSV = () => {
    const pool = selectedUsers.length ? users.filter((u) => selectedUsers.includes(u.id)) : users;
    if (pool.length === 0) { notify('No candidates to export', 'info'); return; }
    const csv = toCsv(pool.map((user) => ({
      Name: user.full_name || 'N/A',
      Email: user.email,
      Position: user.current_work || 'N/A',
      Company: user.current_company || 'N/A',
      Location: user.current_location || 'N/A',
      Experience: user.total_experience ? `${user.total_experience} years` : 'N/A',
      Score: user.latest_score || 'N/A',
      Status: STATUS_BY_VALUE[user.review?.status]?.label || '',
      Note: user.review?.note || '',
      Skills: user.all_skills ? user.all_skills.join(', ') : 'N/A',
      HasResume: user.profile_resume_filename ? 'Yes' : 'No',
    })));
    downloadBlob(csv, `candidates_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    notify(`Exported ${pool.length} candidate${pool.length === 1 ? '' : 's'}`);
  };

  const toggleUserSelection = (userId) => setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  const allSelected = users.length > 0 && users.every((u) => selectedUsers.includes(u.id));
  const toggleAll = () => setSelectedUsers(allSelected ? [] : users.map((u) => u.id));
  const goToPage = (n) => { setPage(n); listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); };

  const activeFilterCount = [jobRoleFilter, locationFilter, companyFilter, skillsFilter, minExperience, maxExperience, minScore, hasResume].filter(Boolean).length;
  const removedView = view === 'removed';
  const stageLabel = statusFilter === 'none' ? 'not reviewed' : STATUS_BY_VALUE[statusFilter]?.label.toLowerCase();
  const listTitle = removedView ? 'removed' : stageLabel ? `${stageLabel}` : `candidate${pagination.total === 1 ? '' : 's'}`;

  return (
    <AppShell wide toneName="teal">
      <PageHeader
        eyebrow="Talent desk"
        toneName="teal"
        title="Meet your next hire."
        accent={2}
        subtitle="Search every SkillLens candidate, move people through your stages, and keep private notes only HR can see."
        actions={(
          <>
            <Button variant="outline" onClick={() => analyticsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>Analytics</Button>
            <Button variant="dark" onClick={exportToCSV}>Export CSV</Button>
          </>
        )}
      />

      {error && <Notice className="mb-8">{error}</Notice>}

      <Pipeline stats={stats} view={view} statusFilter={statusFilter} onStage={pickStage} onRemoved={showRemoved} />

      {/* Search, sort and filters */}
      <div ref={listRef} className="mt-16 scroll-mt-24">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <label className="group relative block w-full max-w-[640px]">
            <span className="sr-only">Search candidates</span>
            <svg viewBox="0 0 24 24" className="pointer-events-none absolute left-0 top-1/2 h-6 w-6 -translate-y-1/2 text-silver transition-colors group-focus-within:text-teal-ink" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
              <circle cx="11" cy="11" r="6.5" /><path d="M20 20l-4.2-4.2" />
            </svg>
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Search name, email or role"
              className="block w-full border-b-2 border-black/10 bg-transparent py-3 pl-10 font-display text-[24px] font-semibold tracking-tight text-ink placeholder:text-black/20 focus:outline-none md:text-[30px]"
            />
            <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[2px] origin-left scale-x-0 bg-gradient-to-r from-[#30b0c7] to-[#007aff] transition-transform duration-700 ease-apple group-focus-within:scale-x-100" />
          </label>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 text-[15px] text-graphite">
            <span className="flex items-center gap-2">
              Sorted by
              <Select variant="inline" value={sortBy} onChange={(e) => { setSortBy(e.target.value); setPage(1); }} options={SORTS} />
            </span>
            <button type="button" onClick={() => setShowFilters((v) => !v)} aria-expanded={showFilters} className="flex items-center gap-2 font-medium text-ink">
              <span className={cx('flex h-6 w-6 items-center justify-center rounded-full text-[17px] leading-none transition-all duration-500', showFilters ? 'rotate-45 bg-ink text-white' : 'bg-black/[0.06]')} aria-hidden="true">+</span>
              Filters
              {activeFilterCount > 0 && <span className="rounded-full bg-teal px-1.5 text-[12px] font-semibold tabular-nums text-white">{activeFilterCount}</span>}
            </button>
            <button type="button" onClick={() => { fetchHRData(page); fetchSummary(); }} className="font-medium text-ink hover:text-teal-ink">Refresh</button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0, overflow: 'hidden' }}
              animate={{ height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } }}
              exit={{ height: 0, opacity: 0, overflow: 'hidden' }}
              transition={{ duration: 0.5, ease: EASE }}
            >
              <FilterSentence
                f={{ jobRole: jobRoleFilter, location: locationFilter, company: companyFilter, skills: skillsFilter, minExperience, maxExperience, minScore, hasResume }}
                set={{
                  jobRole: setJobRoleFilter, location: setLocationFilter, company: setCompanyFilter, skills: setSkillsFilter,
                  minExperience: setMinExperience, maxExperience: setMaxExperience, minScore: setMinScore, hasResume: setHasResume,
                }}
                lists={{ jobRoles, locations, companies, skills }}
                onApply={reload}
                onClear={clearAllFilters}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* List */}
        <div className="mt-14 flex flex-wrap items-end justify-between gap-4 border-b border-black/[0.07] pb-5">
          <div className="flex items-center gap-5">
            <Tick checked={allSelected} onChange={toggleAll} label="Select everyone on this page" />
            <p className="font-display text-[34px] font-semibold leading-none tracking-tighter2 text-ink md:text-[40px]">
              <CountNumber value={pagination.total} />
              <span className="ml-3 text-[17px] font-medium tracking-normal text-graphite">{listTitle}</span>
            </p>
            {refreshing && !loading && (
              <span className="flex items-center gap-2 text-[13px] text-silver">
                <span className="relative flex h-2 w-2"><span className="absolute inset-0 animate-pulsering rounded-full bg-teal" /><span className="relative h-2 w-2 rounded-full bg-teal" /></span>
                Updating
              </span>
            )}
          </div>
          <p className="text-[14px] text-graphite">
            {removedView
              ? <>They return on their own when they use SkillLens again. <button type="button" onClick={() => pickStage('')} className="font-medium text-action-link hover:underline">Back to everyone</button></>
              : (statusFilter || activeFilterCount > 0 || searchTerm)
                ? <button type="button" onClick={clearAllFilters} className="font-medium text-action-link hover:underline">Show everyone</button>
                : pagination.pages > 1 ? `Page ${page} of ${pagination.pages}` : null}
          </p>
        </div>

        {loading ? (
          <div className="mt-4 space-y-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[84px] !rounded-[22px]" />)}</div>
        ) : users.length === 0 ? (
          <div className="py-20 text-center">
            <p className="font-display text-[40px] font-semibold tracking-tighter2 text-black/20 md:text-[56px]">{removedView ? 'Nobody removed.' : 'Nobody here yet.'}</p>
            <p className="mx-auto mt-4 max-w-[46ch] text-[16px] leading-[1.55] text-graphite">
              {removedView
                ? 'Candidates you remove appear here. They return to the main list on their own when they use SkillLens again.'
                : 'Try a different search, another stage, or fewer filters.'}
            </p>
          </div>
        ) : (
          <ul className="mt-2">
            <AnimatePresence initial={false}>
              {users.map((user, i) => (
                <CandidateRow
                  key={user.id} index={i} user={user} selected={selectedUsers.includes(user.id)}
                  onToggle={toggleUserSelection} onView={openDetails} onDownload={downloadUserResume}
                  onStatus={changeStatus} onRemove={setRemoved} removedView={removedView}
                />
              ))}
            </AnimatePresence>
          </ul>
        )}

        <Pager page={page} pages={pagination.pages} onPage={goToPage} />
      </div>

      {/* Analytics */}
      <div ref={analyticsRef} className="mt-24 scroll-mt-20">
        <Section index="01" title="Who is applying" note="Most common current roles and where candidates are based.">
          <div className="grid gap-14 xl:grid-cols-2">
            <RankedLines entries={Object.entries(analytics.job_role_distribution || {}).slice(0, 8)} />
            <CityCloud entries={Object.entries(analytics.location_distribution || {}).slice(0, 10)} />
          </div>
        </Section>
        <Section index="02" title="Resume quality" note={`ATS scores of all ${stats.total_resumes || 0} saved resumes.`}>
          <ScoreArcs distribution={analytics.score_distribution} average={analytics.average_score} />
        </Section>
        <Section index="03" title="Seniority" note="Years of experience, from candidate profiles.">
          <ExperienceSpread distribution={analytics.experience_distribution} />
        </Section>
      </div>

      <BulkBar
        count={selectedUsers.length}
        removedView={removedView}
        onStatus={(status) => bulk('status', status)}
        onRemove={() => bulk(removedView ? 'restore' : 'remove')}
        onExport={exportToCSV}
        onClear={() => setSelectedUsers([])}
      />

      <Drawer open={Boolean(selectedUser)} onClose={closeDetails} label={selectedUser ? `Details for ${nameOf(selectedUser)}` : 'Candidate details'}>
        {selectedUser && (
          <CandidateDetails user={selectedUser} details={userDetails} onSaved={applyReview} onDownload={downloadUserResume} onRemove={setRemoved} />
        )}
      </Drawer>
    </AppShell>
  );
};

export default HRDashboard;
