import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

const cx = (...c) => c.filter(Boolean).join(' ');
const EASE = [0.28, 0.11, 0.32, 1];
const FIELD = 'flex w-full items-center rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-left text-[15px] text-ink transition focus:border-action focus:outline-none focus:ring-4 focus:ring-action/15';
const MAX_SHOWN = 80;

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
      className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-2xl bg-white shadow-[0_18px_50px_-12px_rgba(0,0,0,0.28)] ring-1 ring-black/[0.06]"
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
export function Select({ id, name, value, onChange, options, placeholder, disabled, searchable, className = '' }) {
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
    <div ref={ref} className={cx('relative', className)} onKeyDown={onKey}>
      <button
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : openList())}
        className={cx(FIELD, open && 'border-action ring-4 ring-action/15', disabled && 'cursor-not-allowed bg-mist text-graphite')}
      >
        <span className={cx('truncate', (!current || current.value === '') && 'text-silver')}>{current ? current.label : placeholder || 'Select'}</span>
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
export function Combobox({ id, value, onChange, suggestions, placeholder, required, minLength, maxLength }) {
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

  return (
    <div ref={ref} className="relative">
      <input
        id={id}
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
        className="block w-full rounded-xl border border-hairline bg-white px-3.5 py-2.5 text-[15px] text-ink placeholder:text-silver transition focus:border-action focus:outline-none focus:ring-4 focus:ring-action/15"
      />
      <AnimatePresence>
        {open && shown.length > 0 && (
          <OptionList id={listId} items={shown} active={active} selected={value} onPick={pick} onHover={setActive} empty="" />
        )}
      </AnimatePresence>
    </div>
  );
}
