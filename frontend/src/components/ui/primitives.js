import React, { useId } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { tone } from './tones';

export const EASE = [0.28, 0.11, 0.32, 1];

const cx = (...classes) => classes.filter(Boolean).join(' ');

/* ---------- Buttons ---------- */

const BUTTON_VARIANTS = {
  primary: 'bg-action text-white hover:bg-action-hover',
  secondary: 'bg-mist text-ink hover:bg-[#e8e8ed]',
  outline: 'border border-hairline bg-white text-ink hover:border-silver',
  ghost: 'text-action-link hover:bg-blue-soft',
  danger: 'bg-red-soft text-red-ink hover:bg-[#ffe3e0]',
  dark: 'bg-ink text-white hover:bg-black',
};
const BUTTON_SIZES = {
  sm: 'h-8 px-3.5 text-[13px]',
  md: 'h-10 px-5 text-[15px]',
  lg: 'h-12 px-7 text-[17px]',
};

export function Button({ variant = 'primary', size = 'md', className = '', loading = false, children, disabled, ...props }) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-full font-medium transition-colors duration-200',
        'focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-action/25 disabled:cursor-not-allowed disabled:opacity-50',
        BUTTON_VARIANTS[variant], BUTTON_SIZES[size], className
      )}
      {...props}
    >
      {loading && <Spinner className="h-4 w-4" />}
      {children}
    </button>
  );
}

export function Spinner({ className = 'h-5 w-5' }) {
  return (
    <span className={cx('inline-block animate-spin rounded-full border-2 border-current border-t-transparent', className)} aria-hidden="true" />
  );
}

/* ---------- Surfaces ---------- */

export function Card({ as: Component = 'div', className = '', children, ...props }) {
  return (
    <Component className={cx('rounded-[24px] bg-white p-6 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_8px_28px_-12px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.04] md:p-8', className)} {...props}>
      {children}
    </Component>
  );
}

export function SectionTitle({ eyebrow, title, action, toneName, className = '' }) {
  return (
    <div className={cx('mb-5 flex items-end justify-between gap-4', className)}>
      <div>
        {eyebrow && <p className={cx('text-[13px] font-semibold', toneName ? tone(toneName).text : 'text-graphite')}>{eyebrow}</p>}
        <h2 className="font-display text-[22px] font-semibold tracking-tight text-ink md:text-[24px]">{title}</h2>
      </div>
      {action}
    </div>
  );
}

/** Fade-up entrance for page sections. */
export function Appear({ children, delay = 0, className = '' }) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}

/* ---------- Badges, chips, meters ---------- */

export function Badge({ toneName = 'gray', className = '', children }) {
  const t = tone(toneName);
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[12px] font-medium', t.soft, t.text, className)}>
      {children}
    </span>
  );
}

export function Chip({ children, toneName, className = '' }) {
  const t = toneName ? tone(toneName) : null;
  return (
    <span className={cx(
      'inline-flex items-center rounded-full px-3 py-1 text-[13px]',
      t ? `${t.soft} ${t.text}` : 'bg-mist text-ink',
      className
    )}>
      {children}
    </span>
  );
}

/** Horizontal bar that grows to `value` (0-100). */
export function Meter({ value, toneName = 'blue', className = 'h-2', delay = 0 }) {
  const reduce = useReducedMotion();
  const width = Math.max(0, Math.min(100, value || 0));
  return (
    <div className={cx('overflow-hidden rounded-full bg-[#e8e8ed]', className)} role="presentation">
      <motion.div
        className={cx('h-full origin-left rounded-full', tone(toneName).bg)}
        style={{ width: `${width}%` }}
        initial={reduce ? false : { scaleX: 0 }}
        animate={{ scaleX: 1 }}
        transition={{ duration: 1, ease: EASE, delay }}
      />
    </div>
  );
}

/** Circular progress ring with a number in the middle. */
export function ScoreRing({ value, max = 100, size = 120, stroke = 10, toneName = 'blue', label, children }) {
  const reduce = useReducedMotion();
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const ratio = Math.max(0, Math.min(1, (value || 0) / max));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e8e8ed" strokeWidth={stroke} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={tone(toneName).stroke} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circumference}
          initial={reduce ? false : { strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - ratio) }}
          transition={{ duration: 1.3, ease: EASE }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        {children ?? (
          <span className="font-display text-[30px] font-semibold leading-none tracking-tight text-ink tabular-nums">{Math.round(value || 0)}</span>
        )}
        {label && <span className="mt-1 text-[11px] text-silver">{label}</span>}
      </div>
    </div>
  );
}

/** Small coloured tile for a single statistic. */
export function StatTile({ label, value, hint, toneName = 'blue', icon: Icon }) {
  const t = tone(toneName);
  return (
    <div className="rounded-[20px] bg-white p-5 ring-1 ring-black/[0.05]">
      <div className="flex items-center gap-2">
        {Icon && (
          <span className={cx('flex h-7 w-7 items-center justify-center rounded-full', t.soft)}>
            <Icon className={cx('h-4 w-4', t.text)} aria-hidden="true" />
          </span>
        )}
        <p className="text-[13px] text-graphite">{label}</p>
      </div>
      <p className="mt-3 truncate font-display text-[28px] font-semibold leading-none tracking-tight text-ink tabular-nums">{value}</p>
      {hint && <p className="mt-2 text-[12px] text-silver">{hint}</p>}
    </div>
  );
}

/* ---------- Form fields ---------- */

const FIELD = 'block w-full rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-silver transition focus:border-action focus:outline-none focus:ring-4 focus:ring-action/15 disabled:bg-mist disabled:text-graphite';

function FieldWrap({ id, label, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      {label && <label htmlFor={id} className="mb-1.5 block text-[13px] font-medium text-ink">{label}</label>}
      {children}
      {error ? (
        <p className="mt-1.5 text-[12px] text-red-ink">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[12px] text-silver">{hint}</p>
      ) : null}
    </div>
  );
}

export function TextField({ label, hint, error, className, inputClassName = '', ...props }) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error} className={className}>
      <input id={id} className={cx(FIELD, inputClassName)} {...props} />
    </FieldWrap>
  );
}

export function TextArea({ label, hint, error, className, rows = 3, ...props }) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error} className={className}>
      <textarea id={id} rows={rows} className={cx(FIELD, 'resize-y')} {...props} />
    </FieldWrap>
  );
}

export function SelectField({ label, hint, error, className, options, placeholder, ...props }) {
  const id = useId();
  return (
    <FieldWrap id={id} label={label} hint={hint} error={error} className={className}>
      <div className="relative">
        <select id={id} className={cx(FIELD, 'appearance-none pr-10')} {...props}>
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((option) => {
            const value = typeof option === 'object' ? option.value : option;
            const text = typeof option === 'object' ? option.label : option;
            return <option key={value} value={value}>{text}</option>;
          })}
        </select>
        <svg className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-silver" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </FieldWrap>
  );
}

/** Apple-style segmented control. */
export function Segmented({ value, onChange, options, label, className = '' }) {
  return (
    <div className={cx('inline-flex rounded-full bg-mist p-1', className)} role="radiogroup" aria-label={label}>
      {options.map((option) => {
        const optValue = typeof option === 'object' ? option.value : option;
        const text = typeof option === 'object' ? option.label : option;
        const active = optValue === value;
        return (
          <button
            key={optValue}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(optValue)}
            className={cx(
              'relative rounded-full px-4 py-1.5 text-[13px] transition-colors',
              active ? 'text-ink' : 'text-graphite hover:text-ink'
            )}
          >
            {active && (
              <motion.span layoutId={`seg-${label}`} className="absolute inset-0 rounded-full bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]" transition={{ duration: 0.35, ease: EASE }} />
            )}
            <span className="relative">{text}</span>
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Feedback ---------- */

export function Notice({ toneName = 'red', title, children, className = '' }) {
  const t = tone(toneName);
  return (
    <div className={cx('rounded-2xl px-4 py-3 text-[14px]', t.soft, t.text, className)} role={toneName === 'red' ? 'alert' : 'status'}>
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children, action, toneName = 'blue' }) {
  const t = tone(toneName);
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      {Icon && (
        <span className={cx('flex h-14 w-14 items-center justify-center rounded-full', t.soft)}>
          <Icon className={cx('h-7 w-7', t.text)} aria-hidden="true" />
        </span>
      )}
      <h3 className="mt-5 font-display text-[21px] font-semibold tracking-tight text-ink">{title}</h3>
      {children && <p className="mt-2 max-w-[42ch] text-[15px] leading-[1.5] text-graphite">{children}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return (
    <div className={cx('animate-shimmer rounded-xl bg-[linear-gradient(90deg,#f0f0f3_0%,#e6e6ea_40%,#f0f0f3_80%)] bg-[length:800px_100%]', className)} />
  );
}

export { cx };
