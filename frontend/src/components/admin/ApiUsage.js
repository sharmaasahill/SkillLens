import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { Skeleton, cx } from '../ui/primitives';
import { EASE, Line, ratioColor } from '../ui/studio';
import { dateLabel } from '../../lib/format';

const fmt = (n) => Number(n || 0).toLocaleString('en-IN');
const usd = (n) => `$${Number(n || 0).toFixed(2)}`;

function Meter({ label, used, limit, note, tone }) {
  const ratio = limit ? used / limit : 0;
  return (
    <div className="min-w-0">
      <p className="text-[13px] font-medium text-graphite">{label}</p>
      <p className="mt-2 font-display text-[40px] font-semibold leading-none tracking-tighter2 tabular-nums text-ink">
        {typeof used === 'string' ? used : fmt(used)}
        {limit ? <span className="text-[18px] text-silver">{` / ${typeof limit === 'string' ? limit : fmt(limit)}`}</span> : null}
      </p>
      {limit ? <Line value={Math.min(100, ratio * 100)} color={tone || (ratio >= 0.9 ? '#ff3b30' : ratio >= 0.6 ? '#ff9500' : '#30b0c7')} className="mt-4" /> : null}
      {note && <p className="mt-3 text-[13px] leading-[1.5] text-silver">{note}</p>}
    </div>
  );
}

/** Calls per day for the last two weeks: Gemini and job sources side by side. */
function DailyBars({ daily }) {
  const reduce = useReducedMotion();
  const max = Math.max(1, ...daily.map((d) => d.gemini + d.job_sources));
  return (
    <div>
      <div className="flex h-[140px] items-end gap-1.5 md:gap-2.5" role="img" aria-label="Calls per day over the last 14 days">
        {daily.map((d, i) => {
          const total = d.gemini + d.job_sources;
          return (
            <div key={d.day} className="flex h-full min-w-0 flex-1 flex-col justify-end" title={`${dateLabel(d.day)}: ${d.gemini} Gemini, ${d.job_sources} job source calls`}>
              <motion.div
                className="flex w-full origin-bottom flex-col overflow-hidden rounded-[6px]"
                style={{ height: `${Math.max(total ? 6 : 2, (total / max) * 100)}%` }}
                initial={reduce ? false : { scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }}
                transition={{ duration: 0.8, ease: EASE, delay: i * 0.03 }}
              >
                {total === 0 ? <span className="h-full bg-black/[0.06]" /> : (
                  <>
                    <span className="bg-[#af52de]" style={{ height: `${(d.gemini / total) * 100}%` }} />
                    <span className="flex-1 bg-teal" />
                  </>
                )}
              </motion.div>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between text-[12px] text-silver">
        <span>{dateLabel(daily[0]?.day)}</span>
        <span className="flex items-center gap-4">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#af52de]" />Gemini</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-teal" />Job sources</span>
        </span>
        <span>Today</span>
      </div>
    </div>
  );
}

function SourceRow({ src }) {
  const ratio = src.daily_limit ? src.today / src.daily_limit : 0;
  const state = !src.configured
    ? { text: src.disabled ? 'Turned off' : `Needs ${src.needs.join(', ')}`, cls: 'text-silver' }
    : src.last_error ? { text: 'Failing', cls: 'text-red-ink' } : { text: 'Working', cls: 'text-green-ink' };
  return (
    <li className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1 border-b border-black/[0.06] py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_110px_90px]">
      <div className="min-w-0">
        <p className="text-[16px] font-medium text-ink">{src.label}</p>
        <p className="truncate text-[13px] text-silver">{src.group} · {src.cost}</p>
      </div>
      <p className={cx('text-right text-[13px] font-medium md:order-last', state.cls)}>{state.text}</p>
      <div className="col-span-2 md:col-span-1">
        {src.configured ? (
          <>
            <div className="mb-1.5 flex justify-between text-[12px] tabular-nums text-graphite">
              <span>{fmt(src.today)} of {fmt(src.daily_limit)} today</span>
            </div>
            <Line value={Math.min(100, ratio * 100)} color={ratioColor(1 - ratio)} />
          </>
        ) : <p className="text-[13px] text-silver">Not set up</p>}
        {src.last_error && (
          <p className="mt-2 text-[12px] leading-[1.45] text-red-ink">{src.last_error.message}{src.last_error.at ? ` (${dateLabel(src.last_error.at)})` : ''}</p>
        )}
      </div>
      <p className="hidden text-right text-[14px] tabular-nums text-ink md:block">{fmt(src.month)} <span className="text-[12px] text-silver">this month</span></p>
    </li>
  );
}

/** Paid and quota-limited services: how much was used today and this month, and what it cost. */
function ApiUsage({ usage }) {
  if (!usage) return <div className="grid gap-8 md:grid-cols-3"><Skeleton className="h-28" /><Skeleton className="h-28" /><Skeleton className="h-28" /></div>;
  const { gemini, apify, job_searches: searches } = usage;
  const apifyNote = !apify.configured ? 'APIFY_TOKEN is not set.'
    : apify.error ? apify.error
      : `${fmt(apify.runs_this_month)} scraper runs this month, at most ${usd(apify.max_usd_per_run)} each.${apify.cycle_end ? ` Resets ${dateLabel(apify.cycle_end)}.` : ''}`;
  const sources = [...usage.sources].sort((a, b) => Number(b.configured) - Number(a.configured));

  return (
    <div>
      <div className="grid gap-12 md:grid-cols-3 md:gap-10">
        <Meter
          label="Gemini AI uses today" used={gemini.today} limit={gemini.configured ? gemini.daily_limit : 0}
          note={gemini.configured
            ? `${fmt(gemini.month)} this month. Each user can use ${gemini.user_daily_limit} a day. Free tier, so no cost.`
            : 'GEMINI_API_KEY is not set, so the AI coach and cover letters are hidden.'}
          tone="#af52de"
        />
        <Meter
          label="Apify spend this month"
          used={apify.configured && apify.used_usd != null ? usd(apify.used_usd) : '-'}
          limit={apify.limit_usd ? usd(apify.limit_usd) : 0}
          note={apifyNote}
        />
        <Meter
          label="Job searches by users today" used={searches.today}
          note={`${fmt(searches.month)} this month. Each user can run ${searches.user_daily_limit} a day; repeats of the same search are free.`}
        />
      </div>

      <div className="mt-14">
        <p className="mb-4 text-[13px] font-semibold uppercase tracking-[0.14em] text-silver">Calls per day</p>
        <DailyBars daily={usage.daily} />
      </div>

      <div className="mt-14">
        <p className="mb-2 text-[13px] font-semibold uppercase tracking-[0.14em] text-silver">Job sources</p>
        <ul>{sources.map((src) => <SourceRow key={src.name} src={src} />)}</ul>
        <p className="mt-4 text-[13px] text-silver">Calls are counted only when a source is really asked; cached results are free. Failing means its last search this week returned an error.</p>
      </div>
    </div>
  );
}

export default ApiUsage;
