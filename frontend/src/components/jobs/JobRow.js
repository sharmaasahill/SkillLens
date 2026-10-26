import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Expand, Line, MiniRing, Rise, ratioColor } from '../ui/studio';
import { cx } from '../ui/primitives';
import { lpa } from '../../lib/format';

/** "Posted 3 days ago" from an ISO date. */
export function postedLabel(posted) {
  if (!posted) return '';
  const days = Math.max(0, Math.round((Date.now() - new Date(`${posted}T00:00:00`).getTime()) / 86400000));
  return days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
}

/** Salary as people read it: "₹8.0 LPA to ₹12.0 LPA", or the source's own wording. */
export function salaryLabel(pay) {
  if (!pay) return '';
  if (pay.text) return pay.text;
  if (!pay.min) return '';
  if (pay.currency === 'INR' && (!pay.period || pay.period === 'year')) {
    return pay.max && pay.max !== pay.min ? `${lpa(pay.min)} to ${lpa(pay.max)}` : lpa(pay.min);
  }
  const fmt = (n) => Number(n).toLocaleString('en-IN');
  const range = pay.max && pay.max !== pay.min ? `${fmt(pay.min)}-${fmt(pay.max)}` : fmt(pay.min);
  return `${pay.currency || ''} ${range}${pay.period ? ` a ${pay.period}` : ''}`.trim();
}

function experienceLabel(exp) {
  if (!exp) return '';
  return exp.max && exp.max !== exp.min ? `${exp.min}-${exp.max} yrs` : `${exp.min}+ yrs`;
}

const PART_LABELS = { skills: 'Skills', role: 'Role', experience: 'Experience', freshness: 'Freshness' };
// The resume page needs a real job description to compare against
const MIN_JD_WORDS = 15;

/** One live job as an editorial row. Click to see why it fits and what to add. */
function JobRow({ job, rank, attribution }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [full, setFull] = useState(false);
  const source = attribution?.[job.source] || {};
  const meta = [job.location || (job.remote ? 'Remote' : ''), postedLabel(job.posted), experienceLabel(job.experience)].filter(Boolean);
  const pay = salaryLabel(job.salary);
  const description = job.description || '';
  const shown = full || description.length <= 700 ? description : `${description.slice(0, 700).trim()}...`;
  const canCheck = description.trim().split(/\s+/).length >= MIN_JD_WORDS;
  // Opens the resume page with this job's description already filled in
  const checkResume = () => navigate('/resume-analyzer', {
    state: { jd: { text: `${job.title}${job.company ? ` at ${job.company}` : ''}\n\n${description}`, title: job.title, company: job.company } },
  });

  return (
    <Rise delay={Math.min(rank, 8) * 0.03} amount={0.05}>
      <article className={cx('border-b border-black/[0.07] transition-colors', open && 'bg-white/50')}>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open}
          className="group grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-5 py-6 text-left md:gap-8">
          <span className="w-10 font-display text-[26px] font-semibold tabular-nums text-black/15 transition-colors group-hover:text-purple md:text-[32px]">
            {String(rank + 1).padStart(2, '0')}
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-[21px] font-semibold tracking-tight text-ink md:text-[25px]">{job.title}</h3>
            <p className="mt-1 truncate text-[15px] text-graphite">
              <span className="text-ink">{job.company}</span>{meta.length > 0 && ` · ${meta.join(' · ')}`}
            </p>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
              <span className="font-medium text-purple-ink">via {job.via}</span>
              {job.work_mode && job.work_mode !== 'On-site' && <span className="text-teal-ink">{job.work_mode}</span>}
              {pay && <span className="font-medium tabular-nums text-green-ink">{pay}</span>}
              {job.open_to_india === null && <span className="text-orange-ink">Check if open to India</span>}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="font-display text-[30px] font-semibold leading-none tracking-tight tabular-nums text-ink">{job.match}<span className="text-[15px] text-silver">%</span></p>
              <p className="text-[12px] text-silver">fit</p>
            </div>
            <MiniRing value={job.match} size={46} />
            <span className={cx('text-[22px] text-silver transition-transform duration-500', open ? 'rotate-90' : 'group-hover:translate-x-1')} aria-hidden="true">&rsaquo;</span>
          </div>
        </button>

        <Expand open={open}>
          <div className="grid gap-10 pb-10 md:grid-cols-[1.35fr_1fr] md:pl-[72px]">
            <div>
              <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.14em] text-purple-ink">Why it fits</p>
              <ul className="space-y-2">
                {job.notes.map((note) => (
                  <li key={note} className="flex gap-3 text-[15px] leading-[1.55] text-ink/85">
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-purple" aria-hidden="true" />{note}
                  </li>
                ))}
              </ul>
              {description && (
                <div className="mt-6">
                  <p className="max-w-[70ch] whitespace-pre-line text-[14px] leading-[1.65] text-graphite">{shown}</p>
                  {description.length > 700 && (
                    <button type="button" onClick={() => setFull((v) => !v)} className="mt-2 text-[14px] font-medium text-action-link hover:underline">
                      {full ? 'Show less' : 'Read the full description'}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="space-y-6">
              {Object.entries(job.parts).filter(([, v]) => v !== null).map(([key, value], i) => (
                <div key={key}>
                  <div className="mb-2 flex justify-between text-[14px]"><span className="text-graphite">{PART_LABELS[key]}</span><span className="font-semibold tabular-nums">{value}%</span></div>
                  <Line value={value} color={ratioColor(value / 100)} delay={i * 0.06} />
                </div>
              ))}
              {job.matched_skills.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[13px] font-semibold text-ink">You have</p>
                  <p className="text-[15px] leading-[1.6] text-green-ink">{job.matched_skills.join(' · ')}</p>
                </div>
              )}
              {job.missing_skills.length > 0 && (
                <div>
                  <p className="mb-1.5 text-[13px] font-semibold text-ink">It also asks for</p>
                  <p className="text-[15px] leading-[1.6] text-orange-ink">{job.missing_skills.join(' · ')}</p>
                </div>
              )}
              {job.also_on?.length > 0 && <p className="text-[13px] text-silver">Also listed on {job.also_on.join(', ')}</p>}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2">
                <a href={job.url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-full bg-action px-5 text-[15px] font-medium text-white transition-colors hover:bg-action-hover">
                  Apply <span aria-hidden="true">&rarr;</span>
                </a>
                {canCheck && (
                  <button type="button" onClick={checkResume} className="text-[14px] font-medium text-action-link hover:underline">
                    Check my resume for this job
                  </button>
                )}
                {source.url && (
                  // Job boards such as Remote OK ask for a followed link back, so the referrer is kept here
                  // eslint-disable-next-line react/jsx-no-target-blank
                  <a href={source.url} target="_blank" rel="noopener" className="text-[13px] text-graphite hover:text-ink hover:underline">
                    Listing from {source.name}
                  </a>
                )}
              </div>
            </div>
          </div>
        </Expand>
      </article>
    </Rise>
  );
}

export default JobRow;
