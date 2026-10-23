import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const cx = (...c) => c.filter(Boolean).join(' ');
const EASE = [0.28, 0.11, 0.32, 1];
const FIELD = 'flex w-full items-center rounded-2xl border border-black/[0.08] bg-white/70 px-4 py-3 text-left text-[15px] text-ink backdrop-blur transition hover:border-black/[0.16] focus:border-action/60 focus:outline-none focus:ring-4 focus:ring-action/10';
const MAX_SHOWN = 80;
// Inline variant: sits inside a sentence, underlined, in display type
const INLINE = 'inline-flex max-w-full items-center gap-1 border-b-2 border-black/15 bg-transparent px-0.5 pb-0.5 text-left font-display font-semibold tracking-tight text-ink transition-colors hover:border-ink focus:border-action focus:outline-none';

const norm = (options) => options.map((o) => (typeof o === 'object' ? o : { value: o, label: String(o) }));

function Chevron({ open }) {
  return (
    <svg className={cx('ml-auto h-4 w-4 shrink-0 text-silver transition-transform', open && 'rotate-180')} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function useOutside(ref, onOutside) {
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onOutside(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [ref, onOutside]);
}

function OptionList({ id, items, active, selected, onPick, onHover, empty, header }) {
  const listRef = useRef(null);
  useEffect(() => {
    listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);
  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.18, ease: EASE }}
      className="absolute left-0 top-[calc(100%+6px)] z-50 w-full min-w-[240px] overflow-hidden rounded-2xl bg-white font-text text-[15px] font-normal tracking-normal shadow-[0_18px_50px_-12px_rgba(0,0,0,0.28)] ring-1 ring-black/[0.06]"
    >
    {header}
    <ul ref={listRef} id={id} role="listbox" className="max-h-64 overflow-y-auto p-1.5">
      {items.length === 0 && <li className="px-3 py-2.5 text-[14px] text-silver">{empty}</li>}
      {items.map((item, i) => (
        <li
          key={`${item.value}-${i}`}
          id={`${id}-${i}`}
          data-index={i}
          role="option"
          aria-selected={item.value === selected}
          onMouseDown={(e) => { e.preventDefault(); onPick(item); }}
          onMouseEnter={() => onHover(i)}
          className={cx(
            'flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-[15px]',
            i === active ? 'bg-mist text-ink' : 'text-ink/90',
            item.value === selected && 'font-medium'
          )}
        >
          <span className="truncate">{item.label}</span>
          {item.value === selected && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-action" aria-hidden="true" />}
        </li>
      ))}
    </ul>
    </motion.div>
  );
}

/**
 * Dropdown in the SkillLens style. Drop-in for a native <select>: onChange receives
 * { target: { name, value } }. Long lists get a search box automatically.
 */
export function Select({ id, name, value, onChange, options, placeholder, disabled, searchable, className = '', variant }) {
  const items = useMemo(() => norm(options || []), [options]);
  const all = useMemo(() => (placeholder !== undefined ? [{ value: '', label: placeholder }, ...items] : items), [items, placeholder]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef(null);
  const searchRef = useRef(null);
  const listId = useId();
  const withSearch = searchable ?? items.length > 12;
  useOutside(ref, () => setOpen(false));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? all.filter((o) => o.label.toLowerCase().includes(q)) : all;
    return list.slice(0, MAX_SHOWN);
  }, [all, query]);

  const current = all.find((o) => o.value === (value ?? ''));
  const pick = (item) => {
    onChange?.({ target: { name, value: item.value } });
    setOpen(false);
    setQuery('');
  };
  const openList = () => {
    if (disabled) return;
    setOpen(true);
    setActive(Math.max(0, all.findIndex((o) => o.value === (value ?? ''))));
    setTimeout(() => searchRef.current?.focus(), 0);
  };
  const onKey = (e) => {
    if (!open && ['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); return; }
    if (!open) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[active]) pick(shown[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
    else if (e.key === 'Tab') { setOpen(false); }
  };

  return (
    <div ref={ref} className={cx('relative', variant === 'inline' && 'inline-block max-w-full align-baseline', className)} onKeyDown={onKey}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : openList())}
        className={variant === 'inline'
          ? cx(INLINE, open && 'border-action', disabled && 'cursor-not-allowed opacity-50')
          : cx(FIELD, open && 'border-action ring-4 ring-action/15', disabled && 'cursor-not-allowed bg-mist text-graphite')}
      >
        {/* Inline labels wrap inside their own box (never past the line) instead of overlapping what follows */}
        <span className={cx(
          variant === 'inline' ? 'min-w-0 [overflow-wrap:anywhere]' : 'truncate',
          (!current || current.value === '') && (variant === 'inline' ? 'text-black/25' : 'text-silver')
        )}>{current ? current.label : placeholder || 'Select'}</span>
        <Chevron open={open} />
      </button>
      <AnimatePresence>
        {open && (
          <OptionList
            id={listId} items={shown} active={active} selected={value ?? ''} onPick={pick} onHover={setActive} empty="No matches"
            header={withSearch && (
              <div className="border-b border-black/[0.06] p-1.5">
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setActive(0); }}
                  placeholder="Search"
                  aria-label="Search options"
                  aria-controls={listId}
                  className="w-full rounded-lg bg-mist px-3 py-2 text-[14px] text-ink placeholder:text-silver focus:outline-none focus:ring-2 focus:ring-action/30"
                />
              </div>
            )}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

/** Free-text input with filtered suggestions in the SkillLens style (used for job titles). */
export function Combobox({ id, value, onChange, suggestions, placeholder, required, minLength, maxLength, variant, className = '' }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const ref = useRef(null);
  const listId = useId();
  useOutside(ref, () => setOpen(false));

  const shown = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) return (suggestions || []).slice(0, 40).map((s) => ({ value: s, label: s }));
    const starts = [];
    const contains = [];
    for (const s of suggestions || []) {
      const l = s.toLowerCase();
      if (l === q) continue;
      if (l.startsWith(q)) starts.push(s);
      else if (l.includes(q)) contains.push(s);
      if (starts.length >= MAX_SHOWN) break;
    }
    return [...starts, ...contains].slice(0, MAX_SHOWN).map((s) => ({ value: s, label: s }));
  }, [value, suggestions]);

  const pick = (item) => { onChange({ target: { value: item.value } }); setOpen(false); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(shown.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
    else if (e.key === 'Enter' && open && active >= 0 && shown[active]) { e.preventDefault(); pick(shown[active]); }
    else if (e.key === 'Escape') setOpen(false);
  };

  const inline = variant === 'inline';
  return (
    // Inline: a hidden copy of the text sits in the same grid cell as the input, so the field is
    // exactly as wide as what is typed. Words after it move along (and wrap) instead of being covered.
    <div ref={ref} className={cx('relative', inline && 'inline-grid max-w-full grid-cols-[minmax(0,1fr)] align-baseline', className)}>
      {inline && (
        <span aria-hidden="true" className={cx(INLINE, 'invisible col-start-1 row-start-1 overflow-hidden whitespace-pre')}>
          {`${value || placeholder || ''}\u00a0`}
        </span>
      )}
      <input
        id={id}
        size={inline ? 1 : undefined}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        onChange={(e) => { onChange(e); setOpen(true); setActive(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={onKey}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        maxLength={maxLength}
        className={inline
          ? cx(INLINE, 'col-start-1 row-start-1 w-full min-w-0 placeholder:text-black/25')
          : 'block w-full rounded-2xl border border-black/[0.08] bg-white/70 px-4 py-3 text-[15px] text-ink placeholder:text-silver backdrop-blur transition focus:border-action/60 focus:bg-white focus:outline-none focus:ring-4 focus:ring-action/10'}
      />
      <AnimatePresence>
        {open && shown.length > 0 && (
          <OptionList id={listId} items={shown} active={active} selected={value} onPick={pick} onHover={setActive} empty="" />
        )}
      </AnimatePresence>
    </div>
  );
}
