import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, Skeleton, cx } from '../ui/primitives';
import { EASE, Expand } from '../ui/studio';
import { dateTimeLabel } from '../../lib/format';

export const KIND_LABELS = {
  server: { label: 'Server', color: '#ff3b30', note: 'A request crashed in the API' },
  client: { label: 'Browser', color: '#ff9500', note: 'A page crashed in someone\'s browser' },
  service: { label: 'Service', color: '#af52de', note: 'A job source, Gemini or Apify failed' },
};

function ErrorRow({ item, onResolve, fixedView }) {
  const [open, setOpen] = useState(false);
  const kind = KIND_LABELS[item.kind] || KIND_LABELS.server;
  return (
    <motion.li
      layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -40 }}
      transition={{ duration: 0.4, ease: EASE }} className="border-b border-black/[0.07]"
    >
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-4 py-5">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="min-w-0 text-left">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
            <span className="flex items-center gap-1.5 font-semibold" style={{ color: kind.color }}>
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: kind.color }} aria-hidden="true" />{kind.label}
            </span>
            {item.level === 'warning' && <span className="text-orange-ink">Warning</span>}
            <span className="font-mono text-[12px] text-graphite">{item.source}</span>
            {item.count > 1 && <span className="rounded-full bg-black/[0.06] px-2 py-0.5 text-[12px] font-semibold tabular-nums text-ink">{item.count} times</span>}
          </span>
          <span className="mt-1.5 block break-words text-[16px] leading-[1.45] text-ink">{item.message}</span>
          <span className="mt-1 block text-[13px] text-silver">
            Last {dateTimeLabel(item.last_seen)}{item.count > 1 ? ` · first ${dateTimeLabel(item.first_seen)}` : ''}
            {item.user_id ? ` · user #${item.user_id}` : ''}{item.path ? ` · ${item.path}` : ''}
          </span>
        </button>
        {!fixedView && <Button size="sm" variant="secondary" onClick={() => onResolve(item)}>Mark fixed</Button>}
      </div>
      <Expand open={open}>
        <pre className="mb-5 max-h-[340px] overflow-auto whitespace-pre-wrap break-words rounded-2xl bg-ink/[0.04] p-4 font-mono text-[12px] leading-[1.6] text-ink/80">
          {item.detail || 'No more detail was recorded.'}
        </pre>
      </Expand>
    </motion.li>
  );
}

/**
 * Errors from the API, browsers and outside services, grouped so a repeat raises a count.
 * Mark one fixed when it is handled; if it happens again it comes back as new.
 */
function ErrorLog({ data, view, kind, onView, onKind, onResolve, onResolveAll, onClearFixed }) {
  const fixedView = view === 'fixed';
  const counts = data?.open_counts || {};
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-[14px]">
          {[['open', `Open${data ? ` (${data.open_total})` : ''}`], ['fixed', 'Fixed']].map(([key, label]) => (
            <button key={key} type="button" onClick={() => onView(key)} aria-pressed={view === key}
              className={cx('relative pb-1.5', view === key ? 'font-medium text-ink' : 'text-graphite hover:text-ink')}>
              {label}
              {view === key && <motion.span layoutId="error-view" className="absolute inset-x-0 bottom-0 h-[2px] rounded-full bg-ink" />}
            </button>
          ))}
          <span className="hidden h-5 w-px bg-black/10 sm:block" aria-hidden="true" />
          {[['', 'All kinds'], ...Object.entries(KIND_LABELS).map(([k, v]) => [k, `${v.label}${counts[k] && !fixedView ? ` ${counts[k]}` : ''}`])].map(([key, label]) => (
            <button key={key || 'all'} type="button" onClick={() => onKind(key)} aria-pressed={kind === key}
              className={cx(kind === key ? 'font-medium text-ink' : 'text-silver hover:text-ink')}>
              {label}
            </button>
          ))}
        </div>
        {data?.errors?.length > 0 && (
          fixedView
            ? <Button size="sm" variant="outline" onClick={onClearFixed}>Delete fixed errors</Button>
            : <Button size="sm" variant="outline" onClick={onResolveAll}>Mark all fixed</Button>
        )}
      </div>

      {!data ? (
        <div className="mt-6 space-y-3"><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
      ) : data.errors.length === 0 ? (
        <div className="py-14 text-center">
          <p className="font-display text-[36px] font-semibold tracking-tighter2 text-black/20 md:text-[48px]">{fixedView ? 'Nothing fixed yet.' : 'No errors.'}</p>
          <p className="mt-3 text-[15px] text-graphite">{fixedView ? 'Errors you mark fixed are kept here for 30 days.' : 'Crashes and failing services show up here as they happen.'}</p>
        </div>
      ) : (
        <ul className="mt-4">
          <AnimatePresence initial={false}>
            {data.errors.map((item) => <ErrorRow key={item.id} item={item} onResolve={onResolve} fixedView={fixedView} />)}
          </AnimatePresence>
        </ul>
      )}
    </div>
  );
}

export default ErrorLog;
