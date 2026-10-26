import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE, scoreColor } from '../ui/studio';
import { breakable, dateLabel } from '../../lib/format';

const W = 600;
const H = 180;
const PAD = 14;

/**
 * ATS scores over time as a line: every upload, and every re-analysis that changed a score.
 * For example 58 -> 71 -> 82 shows the resume getting better with each version.
 */
function ScoreTrend({ points }) {
  const reduce = useReducedMotion();
  if (!points?.length) {
    return <p className="text-[16px] text-graphite">Your scores appear here after your first upload, so you can watch them climb.</p>;
  }

  const first = points[0].score;
  const last = points[points.length - 1].score;
  const change = last - first;
  const best = Math.max(...points.map((p) => p.score));
  const lo = Math.max(0, Math.min(...points.map((p) => p.score)) - 10);
  const hi = Math.min(100, best + 10);
  const x = (i) => (points.length === 1 ? W / 2 : PAD + (i * (W - PAD * 2)) / (points.length - 1));
  const y = (s) => H - PAD - ((s - lo) / Math.max(1, hi - lo)) * (H - PAD * 2);
  const line = points.map((p, i) => `${i ? 'L' : 'M'} ${x(i).toFixed(1)} ${y(p.score).toFixed(1)}`).join(' ');
  const area = `${line} L ${x(points.length - 1).toFixed(1)} ${H} L ${x(0).toFixed(1)} ${H} Z`;

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-baseline gap-x-10 gap-y-3">
        <p className="font-display text-[44px] font-semibold leading-none tracking-tighter2 tabular-nums text-ink">
          {points.length > 1 ? <>{first}<span className="mx-2 text-[26px] text-silver">&rarr;</span>{last}</> : last}
        </p>
        {points.length > 1 && (
          <p className={`text-[17px] font-medium tabular-nums ${change > 0 ? 'text-green-ink' : change < 0 ? 'text-red-ink' : 'text-graphite'}`}>
            {change > 0 ? `+${change} points` : change < 0 ? `${change} points` : 'No change yet'}
          </p>
        )}
        <p className="text-[15px] text-graphite">Best {best} · {points.length} score{points.length === 1 ? '' : 's'}</p>
      </div>

      <div className="relative h-[180px]" role="img" aria-label={`ATS score history from ${first} to ${last}`}>
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs>
            <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff9500" stopOpacity="0.22" />
              <stop offset="100%" stopColor="#ff9500" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="trend-line" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#ff9500" />
              <stop offset="100%" stopColor="#ff2d55" />
            </linearGradient>
          </defs>
          {[0.25, 0.5, 0.75].map((f) => (
            <line key={f} x1="0" x2={W} y1={H * f} y2={H * f} stroke="rgba(0,0,0,0.06)" strokeDasharray="2 6" vectorEffect="non-scaling-stroke" />
          ))}
          {points.length > 1 && (
            <>
              <motion.path d={area} fill="url(#trend-fill)" initial={reduce ? false : { opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 1, delay: 0.4 }} />
              <motion.path
                d={line} fill="none" stroke="url(#trend-line)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke"
                initial={reduce ? false : { pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 1.4, ease: EASE }}
              />
            </>
          )}
        </svg>
        {points.map((p, i) => (
          <motion.span
            key={`${p.created_at}-${i}`}
            className="group absolute -ml-[7px] -mt-[7px] h-[14px] w-[14px] rounded-full bg-white"
            style={{ left: `${(x(i) / W) * 100}%`, top: `${(y(p.score) / H) * 100}%`, boxShadow: `0 0 0 3px ${scoreColor(p.score)}` }}
            initial={reduce ? false : { scale: 0 }} whileInView={{ scale: 1 }} viewport={{ once: true }}
            transition={{ duration: 0.4, ease: EASE, delay: 0.3 + i * 0.08 }}
            tabIndex={0}
            aria-label={`${p.score} on ${dateLabel(p.created_at)} for ${p.filename || 'a resume'}`}
          >
            <span className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-10 hidden w-max max-w-[220px] -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-[12px] leading-[1.4] text-white shadow-lg group-hover:block group-focus:block">
              <span className="font-semibold tabular-nums">{p.score}</span> · {dateLabel(p.created_at)}
              {p.filename && <span className="block break-words text-white/70">{breakable(p.filename)}</span>}
            </span>
          </motion.span>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-[12px] text-silver">
        <span>{dateLabel(points[0].created_at)}</span>
        {points.length > 1 && <span>{dateLabel(points[points.length - 1].created_at)}</span>}
      </div>
    </div>
  );
}

export default ScoreTrend;
