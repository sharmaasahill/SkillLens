import React from 'react';
import { cx } from '../ui/primitives';

const GROUP_COLORS = {
  'Job boards': '#007aff', 'Apify scrapers': '#ff9500', 'Company career pages': '#34c759', 'Remote job boards': '#30b0c7',
};

/** Sources grouped by kind. Sources that are not set up are shown, dimmed, with what they need. */
function SourcePicker({ sources, selected, onToggle, onGroup }) {
  const groups = sources.reduce((acc, s) => ({ ...acc, [s.group]: [...(acc[s.group] || []), s] }), {});
  return (
    <div className="divide-y divide-black/[0.06]">
      {Object.entries(groups).map(([group, items]) => {
        const usable = items.filter((s) => s.configured && s.remaining_today > 0);
        const allOn = usable.length > 0 && usable.every((s) => selected.includes(s.name));
        return (
          <div key={group} className="grid gap-3 py-5 first:pt-0 last:pb-0 md:grid-cols-[200px_minmax(0,1fr)] md:gap-8">
            <div className="flex items-baseline justify-between gap-3 md:block">
              <p className="flex items-center gap-2.5 text-[13px] font-semibold text-ink">
                <span className="h-2 w-2 rounded-full" style={{ background: GROUP_COLORS[group] || '#86868b' }} aria-hidden="true" />{group}
              </p>
              {usable.length > 1 && (
                <button type="button" onClick={() => onGroup(usable.map((s) => s.name), !allOn)}
                  className="text-[13px] font-medium text-action-link hover:underline md:mt-1">
                  {allOn ? 'None' : 'All'}
                </button>
              )}
            </div>
            <ul className="flex flex-wrap gap-2">
              {items.map((s) => {
                const ready = s.configured && s.remaining_today > 0;
                const on = ready && selected.includes(s.name);
                const hint = !s.configured
                  ? (s.needs.length ? `Add ${s.needs.join(' and ')} to backend/.env` : 'Turned off')
                  : s.remaining_today <= 0 ? "Today's searches are used up" : `${s.covers}. ${s.cost}. ${s.remaining_today} of ${s.daily_limit} left today.`;
                return (
                  <li key={s.name}>
                    <button
                      type="button" role="switch" aria-checked={on} disabled={!ready} title={hint}
                      onClick={() => onToggle(s.name)}
                      className={cx(
                        'group inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-[14px] transition-all duration-300',
                        on ? 'bg-ink text-white shadow-[0_8px_20px_-12px_rgba(0,0,0,0.6)]' : ready ? 'bg-black/[0.05] text-ink hover:bg-black/[0.09]' : 'cursor-not-allowed bg-transparent text-black/30 ring-1 ring-inset ring-black/10'
                      )}
                    >
                      <span className={cx('h-1.5 w-1.5 rounded-full transition-colors', on ? 'bg-green' : ready ? 'bg-black/25' : 'bg-black/15')} aria-hidden="true" />
                      {s.label}
                      {s.configured && s.daily_limit < 100 && (
                        <span className={cx('text-[12px] tabular-nums', on ? 'text-white/60' : 'text-silver')}>{s.remaining_today}</span>
                      )}
                      {!s.configured && s.needs.length > 0 && <span className="text-[11px] font-medium uppercase tracking-[0.06em]">key needed</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default SourcePicker;
