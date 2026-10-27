import React from 'react';
import { motion } from 'framer-motion';

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
              'relative whitespace-nowrap rounded-full px-4 py-1.5 text-[13px] transition-colors',
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

// Red for errors (the default), orange for warnings, blue for information
const NOTICE_TONES = {
  red: 'bg-red-soft text-red-ink',
  orange: 'bg-orange-soft text-orange-ink',
  blue: 'bg-blue-soft text-blue-ink',
};

export function Notice({ toneName = 'red', title, children, className = '' }) {
  return (
    <div className={cx('rounded-2xl px-4 py-3 text-[14px]', NOTICE_TONES[toneName] || NOTICE_TONES.red, className)} role={toneName === 'red' ? 'alert' : 'status'}>
      {title && <p className="font-semibold">{title}</p>}
      {children}
    </div>
  );
}

export function Skeleton({ className = '' }) {
  return (
    <div className={cx('animate-shimmer rounded-xl bg-[linear-gradient(90deg,#f0f0f3_0%,#e6e6ea_40%,#f0f0f3_80%)] bg-[length:800px_100%]', className)} />
  );
}

export { cx };
