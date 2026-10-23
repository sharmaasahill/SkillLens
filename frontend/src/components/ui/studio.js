/*
 * SkillLens app design language.
 *
 * Instead of grids of boxed cards, pages are editorial: numbered sections with a sticky
 * label column, separated by hairlines, over a slowly drifting colour atmosphere. Data is
 * shown with purpose-built visuals (orbits, segmented dials, curves, waterfalls) rather
 * than generic tiles.
 */
import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useTransform } from 'framer-motion';

export const EASE = [0.28, 0.11, 0.32, 1];
const cx = (...c) => c.filter(Boolean).join(' ');

/* ---------- Page tones ---------- */

export const PAGE_TONES = {
  orange: { a: '#ff9500', b: '#ff2d55', text: 'text-orange-ink', grad: 'from-[#ff9500] to-[#ff2d55]' },
  green: { a: '#34c759', b: '#30b0c7', text: 'text-green-ink', grad: 'from-[#34c759] to-[#30b0c7]' },
  blue: { a: '#007aff', b: '#5856d6', text: 'text-blue-ink', grad: 'from-[#007aff] to-[#5856d6]' },
  purple: { a: '#af52de', b: '#ff2d55', text: 'text-purple-ink', grad: 'from-[#af52de] to-[#ff2d55]' },
  teal: { a: '#30b0c7', b: '#007aff', text: 'text-teal-ink', grad: 'from-[#30b0c7] to-[#007aff]' },
};
export const pageTone = (name) => PAGE_TONES[name] || PAGE_TONES.blue;

/* ---------- Atmosphere ---------- */

const GRAIN = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='160' height='160'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

/** Fixed background: two slow colour fields in the page tone, plus fine film grain for depth. */
export function Atmosphere({ toneName = 'blue' }) {
  const t = pageTone(toneName);
  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#fbfbfd]">
      <div
        className="absolute -left-[12%] -top-[22%] h-[70vh] w-[62vw] animate-drift rounded-full opacity-[0.22] blur-[110px]"
        style={{ background: `radial-gradient(closest-side, ${t.a}, transparent)` }}
      />
      <div
        className="absolute -right-[14%] top-[6%] h-[64vh] w-[52vw] animate-drift-slow rounded-full opacity-[0.16] blur-[120px]"
        style={{ background: `radial-gradient(closest-side, ${t.b}, transparent)` }}
      />
      <div className="absolute inset-x-0 top-[55vh] h-[60vh] bg-gradient-to-b from-transparent to-[#fbfbfd]" />
      <div className="absolute inset-0 opacity-[0.035] mix-blend-multiply" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}

/* ---------- Type ---------- */

/** Headline whose words slide up from behind a mask, one after another. The last `accent` words get the page gradient. */
export function RevealText({ text, as: Tag = 'h1', className = '', accent = 0, toneName = 'blue', delay = 0 }) {
  const reduce = useReducedMotion();
  const words = String(text || '').split(' ');
  const t = pageTone(toneName);
  return (
    <Tag className={className} aria-label={text}>
      {words.map((word, i) => {
        const isAccent = accent > 0 && i >= words.length - accent;
        return (
          <span key={`${word}-${i}`} aria-hidden="true" className="inline-block overflow-hidden pb-[0.12em] align-bottom">
            <motion.span
              className={cx('inline-block', isAccent && `bg-gradient-to-r bg-clip-text text-transparent ${t.grad}`)}
              initial={reduce ? false : { y: '108%' }}
              animate={{ y: 0 }}
              transition={{ duration: 0.9, ease: EASE, delay: delay + i * 0.055 }}
            >
              {word}
            </motion.span>
            {i < words.length - 1 && '\u00a0'}
          </span>
        );
      })}
    </Tag>
  );
}

/** Number that counts up to `value` when it scrolls into view. */
export function CountNumber({ value, format = (n) => Math.round(n).toLocaleString('en-IN'), duration = 1.4, className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const mv = useMotionValue(reduce ? value : 0);
  const text = useTransform(mv, (v) => format(v));
  useEffect(() => {
    if (!inView) return undefined;
    const controls = animate(mv, Number(value) || 0, { duration: reduce ? 0 : duration, ease: EASE });
    return () => controls.stop();
  }, [inView, value, mv, duration, reduce]);
  return <motion.span ref={ref} className={cx('tabular-nums', className)}>{text}</motion.span>;
}

/* ---------- Layout ---------- */

/** Fade-and-rise when the element first scrolls into view. */
export function Rise({ children, delay = 0, className = '', as = 'div', amount = 0.2 }) {
  const reduce = useReducedMotion();
  const Comp = motion[as];
  return (
    <Comp
      className={className}
      initial={reduce ? false : { opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.8, ease: EASE, delay }}
    >
      {children}
    </Comp>
  );
}

/**
 * Editorial band: a sticky label column (index, title, note) beside the content,
 * separated from the band above by a hairline. Replaces stacks of boxed cards.
 */
export function Section({ index, title, note, aside, children, className = '', contentClassName = '', id }) {
  return (
    <Rise as="section" className={cx('relative grid gap-7 border-t border-black/[0.07] py-12 md:py-16 lg:grid-cols-[230px_minmax(0,1fr)] lg:gap-14', className)}>
      <div className="lg:sticky lg:top-28 lg:self-start" id={id}>
        {index && <p className="text-[12px] font-medium tabular-nums tracking-[0.12em] text-silver">{index}</p>}
        <h2 className="mt-1.5 font-display text-[24px] font-semibold leading-tight tracking-tight text-ink md:text-[26px]">{title}</h2>
        {note && <p className="mt-2 max-w-[30ch] text-[14px] leading-[1.5] text-graphite">{note}</p>}
        {aside && <div className="mt-4">{aside}</div>}
      </div>
      <div className={cx('min-w-0', contentClassName)}>{children}</div>
    </Rise>
  );
}

/** Frosted surface with a soft gradient edge. Used sparingly, for the one thing a page asks you to do. */
export function Glass({ children, className = '', innerClassName = '' }) {
  return (
    <div className={cx('rounded-[32px] bg-gradient-to-br from-white via-black/[0.06] to-white p-px shadow-[0_40px_80px_-48px_rgba(0,0,0,0.35)]', className)}>
      <div className={cx('h-full rounded-[31px] bg-white/75 p-6 backdrop-blur-2xl md:p-9', innerClassName)}>{children}</div>
    </div>
  );
}

/** A big number with a label, no box. Use in rows separated by hairlines. */
export function Metric({ label, value, hint, toneName, format, className = '' }) {
  const isNumber = typeof value === 'number';
  return (
    <div className={cx('min-w-0', className)}>
      <p className={cx('text-[13px] font-medium', toneName ? pageTone(toneName).text : 'text-graphite')}>{label}</p>
      <p className="mt-2 truncate font-display text-[40px] font-semibold leading-none tracking-tighter2 text-ink md:text-[48px]">
        {isNumber ? <CountNumber value={value} format={format} /> : value}
      </p>
      {hint && <p className="mt-2 text-[13px] text-silver">{hint}</p>}
    </div>
  );
}

/** Row of metrics divided by vertical hairlines. */
export function MetricRow({ children, className = '' }) {
  return (
    <div className={cx('grid grid-cols-2 gap-y-8 md:flex md:divide-x md:divide-black/[0.07]', className)}>
      {React.Children.map(children, (child) => child && <div className="md:flex-1 md:px-8 md:first:pl-0 md:last:pr-0">{child}</div>)}
    </div>
  );
}

/* ---------- Visuals ---------- */

const polar = (cx0, cy0, r, deg) => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [cx0 + r * Math.cos(a), cy0 + r * Math.sin(a)];
};
export function arcPath(cx0, cy0, r, start, end) {
  const [x1, y1] = polar(cx0, cy0, r, start);
  const [x2, y2] = polar(cx0, cy0, r, end);
  const large = end - start > 180 ? 1 : 0;
  return `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`;
}

/**
 * Concentric progress arcs, each drawn in its own gradient, with a slow dashed halo.
 * rings: [{ value 0-100, label, a, b }]
 */
export function Orbit({ rings, size = 300, children }) {
  const reduce = useReducedMotion();
  const c = size / 2;
  const stroke = Math.round(size * 0.042);
  const gap = stroke * 1.9;
  const id = useMemo(() => `orb${Math.random().toString(36).slice(2, 8)}`, []);
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <div aria-hidden="true" className="absolute inset-[8%] rounded-full opacity-50 blur-3xl" style={{ background: `conic-gradient(from 210deg, ${rings.map((r) => r.a).join(', ')}, ${rings[0]?.a})` }} />
      <svg viewBox={`0 0 ${size} ${size}`} className="relative h-full w-full" role="img" aria-label={rings.map((r) => `${r.label} ${Math.round(r.value)}%`).join(', ')}>
        <defs>
          {rings.map((r, i) => (
            <linearGradient key={i} id={`${id}-${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor={r.a} />
              <stop offset="100%" stopColor={r.b} />
            </linearGradient>
          ))}
        </defs>
        <circle cx={c} cy={c} r={c - 4} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1" strokeDasharray="2 7" className="origin-center animate-spin-slow" />
        {rings.map((r, i) => {
          const radius = c - 18 - i * gap;
          const len = 2 * Math.PI * radius;
          const ratio = Math.max(0, Math.min(1, (r.value || 0) / 100));
          return (
            <g key={r.label} transform={`rotate(-90 ${c} ${c})`}>
              <circle cx={c} cy={c} r={radius} fill="none" stroke="#ececf0" strokeWidth={stroke} />
              <motion.circle
                cx={c} cy={c} r={radius} fill="none" stroke={`url(#${id}-${i})`} strokeWidth={stroke} strokeLinecap="round"
                strokeDasharray={len}
                initial={reduce ? false : { strokeDashoffset: len }}
                animate={{ strokeDashoffset: len * (1 - ratio) }}
                transition={{ duration: 1.6, ease: EASE, delay: 0.25 + i * 0.18 }}
              />
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/**
 * Segmented dial: one arc per part, sized by its maximum points and filled by its score.
 * parts: [{ key, label, score, max }]
 */
export function SegmentDial({ parts, size = 300, children, toneFor }) {
  const reduce = useReducedMotion();
  const c = size / 2;
  const r = c - 22;
  const total = parts.reduce((s, p) => s + (p.max || 0), 0) || 1;
  const gapDeg = 3.2;
  let cursor = 0;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full" role="img" aria-label={parts.map((p) => `${p.label} ${p.score} of ${p.max}`).join(', ')}>
        {parts.map((p, i) => {
          const span = (p.max / total) * 360;
          const start = cursor + gapDeg / 2;
          const end = cursor + span - gapDeg / 2;
          cursor += span;
          const ratio = p.max ? Math.max(0, Math.min(1, p.score / p.max)) : 0;
          const color = toneFor(ratio);
          const fillEnd = start + (end - start) * ratio;
          return (
            <g key={p.key}>
              <path d={arcPath(c, c, r, start, end)} fill="none" stroke="#ececf0" strokeWidth="18" strokeLinecap="round" />
              {ratio > 0.01 && (
                <motion.path
                  d={arcPath(c, c, r, start, Math.max(start + 0.6, fillEnd))} fill="none" stroke={color} strokeWidth="18" strokeLinecap="round"
                  initial={reduce ? false : { pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.9, ease: EASE, delay: 0.3 + i * 0.12 }}
                />
              )}
            </g>
          );
        })}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">{children}</div>
    </div>
  );
}

/** Wide, endlessly scrolling line of words (e.g. a person's top skills). */
export function Marquee({ items, className = '' }) {
  const reduce = useReducedMotion();
  if (!items?.length) return null;
  const row = [...items, ...items, ...items];
  return (
    <div className={cx('relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]', className)}>
      <div className={cx('flex w-max gap-12 whitespace-nowrap', !reduce && 'animate-marquee')}>
        {[0, 1].map((copy) => (
          <div key={copy} className="flex gap-12" aria-hidden={copy === 1}>
            {row.map((item, i) => (
              // Solid low-contrast fill: an outline stroke shows the variable font's overlapping contours
              <span key={`${copy}-${i}`} className="font-display text-[56px] font-semibold tracking-tighter2 text-black/[0.07] md:text-[80px]">
                {item}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Thin animated rule that fills to `value` percent. */
export function Line({ value, color = '#1d1d1f', className = '', delay = 0 }) {
  const reduce = useReducedMotion();
  return (
    <div className={cx('relative h-[3px] overflow-hidden rounded-full bg-black/[0.07]', className)}>
      <motion.div
        className="absolute inset-y-0 left-0 origin-left rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value || 0))}%`, background: color }}
        initial={reduce ? false : { scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 1.1, ease: EASE, delay }}
      />
    </div>
  );
}

/** Colour for a 0-1 ratio, as a hex (for SVG and inline styles). */
export const ratioColor = (ratio) => (ratio >= 0.8 ? '#34c759' : ratio >= 0.55 ? '#ff9500' : '#ff3b30');
export const scoreColor = (score) => ratioColor((score || 0) / 100);

/** Small circular score, for list rows. */
export function MiniRing({ value, size = 44, stroke = 4, label }) {
  const r = (size - stroke) / 2;
  const len = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, (value || 0) / 100));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} title={label}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#ececf0" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={ratioColor(ratio)} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={len} initial={{ strokeDashoffset: len }} animate={{ strokeDashoffset: len * (1 - ratio) }}
          transition={{ duration: 1, ease: EASE }}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[12px] font-semibold tabular-nums text-ink">
        {value === null || value === undefined ? '-' : Math.round(value)}
      </span>
    </div>
  );
}

/** Tag rendered as plain text with a coloured dot, instead of a filled pill. */
export function Tag({ children, color = '#86868b', className = '' }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-[13px] text-ink/80', className)}>
      <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: color }} aria-hidden="true" />
      {children}
    </span>
  );
}

/** Words that fade in one by one, for skill clouds. */
export function WordCloud({ words, colorFor = () => '#1d1d1f', className = '' }) {
  const reduce = useReducedMotion();
  return (
    <div className={cx('flex flex-wrap gap-x-5 gap-y-2', className)}>
      {words.map((w, i) => (
        <motion.span
          key={`${w}-${i}`}
          className="font-display text-[19px] font-medium tracking-tight md:text-[21px]"
          style={{ color: colorFor(w, i) }}
          initial={reduce ? false : { opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, ease: EASE, delay: Math.min(i, 40) * 0.025 }}
        >
          {w}
        </motion.span>
      ))}
    </div>
  );
}

/** Expandable content with a smooth height animation. */
export function Expand({ open, children }) {
  const ref = useRef(null);
  const [height, setHeight] = useState(0);
  useEffect(() => {
    if (!ref.current) return undefined;
    const ro = new ResizeObserver(() => setHeight(ref.current?.offsetHeight || 0));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  return (
    <motion.div initial={false} animate={{ height: open ? height : 0, opacity: open ? 1 : 0 }} transition={{ duration: 0.45, ease: EASE }} className="overflow-hidden">
      <div ref={ref}>{children}</div>
    </motion.div>
  );
}

/** Small check mark circle used in checklists. */
export function Check({ done }) {
  return (
    <span className={cx('flex h-5 w-5 shrink-0 items-center justify-center rounded-full', done ? 'bg-green text-white' : 'ring-[1.5px] ring-inset ring-black/15')} aria-hidden="true">
      {done && (
        <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2.5 6.2l2.3 2.3 4.7-5" strokeLinecap="round" strokeLinejoin="round" /></svg>
      )}
    </span>
  );
}

/** Lens mark used as the logo. Each copy gets its own gradient id, so several on one page never clash. */
export function LensMark({ className = 'h-6 w-6' }) {
  const gid = `lens-mark-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <defs>
        <linearGradient id={gid} x1="8" y1="6" x2="56" y2="58" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#ff9500" /><stop offset="0.35" stopColor="#ff2d55" />
          <stop offset="0.68" stopColor="#af52de" /><stop offset="1" stopColor="#007aff" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="30" fill={`url(#${gid})`} />
      <circle cx="32" cy="32" r="13" fill="#fff" />
      <circle cx="27.5" cy="27.5" r="4.2" fill={`url(#${gid})`} opacity=".9" />
    </svg>
  );
}
