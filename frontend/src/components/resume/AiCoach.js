import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import api, { errorMessage } from '../../api';
import { Button, Notice, cx } from '../ui/primitives';
import { useFeedback } from '../ui/overlays';
import { EASE, Rise, Section } from '../ui/studio';

const STEPS = ['Reading your resume', 'Finding the weakest bullets', 'Writing rewrites', 'Thinking of interview questions'];
const STATUS = {
  covered: { label: 'Covered', color: '#34c759' },
  partial: { label: 'Partly', color: '#ff9500' },
  missing: { label: 'Missing', color: '#ff3b30' },
};

/** "[X%]" placeholders stand out, so you know what to fill in. */
export function WithPlaceholders({ text }) {
  return String(text).split(/(\[[^\]]+\])/g).map((part, i) => (
    /^\[[^\]]+\]$/.test(part)
      ? <span key={i} className="rounded-md bg-orange-soft px-1 font-medium text-orange-ink">{part}</span>
      : <span key={i}>{part}</span>
  ));
}

function Thinking() {
  const reduce = useReducedMotion();
  const [step, setStep] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setStep((s) => Math.min(STEPS.length - 1, s + 1)), 6000);
    return () => clearInterval(timer);
  }, []);
  return (
    <div className="flex items-center gap-5 py-10" role="status" aria-live="polite">
      <span className="relative flex h-12 w-12 shrink-0 items-center justify-center" aria-hidden="true">
        <span className={cx('absolute inset-0 rounded-full bg-[conic-gradient(from_0deg,#007aff,#5856d6,#af52de,#007aff)] opacity-80 blur-[2px]', !reduce && 'animate-spin-slow [animation-duration:3s]')} />
        <span className="relative h-9 w-9 rounded-full bg-white" />
      </span>
      <div>
        <AnimatePresence mode="wait">
          <motion.p key={step} className="font-display text-[22px] font-semibold tracking-tight text-ink"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.35, ease: EASE }}>
            {STEPS[step]}...
          </motion.p>
        </AnimatePresence>
        <p className="text-[14px] text-graphite">This takes up to a minute.</p>
      </div>
    </div>
  );
}

function Sub({ title, children, note }) {
  return (
    <div className="border-t border-black/[0.07] pt-8 first:border-0 first:pt-0">
      <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-blue-ink">{title}</p>
      {note && <p className="mt-1 text-[14px] text-graphite">{note}</p>}
      <div className="mt-5">{children}</div>
    </div>
  );
}

function BulletRewrite({ item, index }) {
  const { notify } = useFeedback();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(item.rewrite);
      notify('Rewrite copied. Fill in the [placeholders] before you use it.');
    } catch (err) {
      notify('Could not copy. Select the text and copy it instead.', 'error');
    }
  };
  return (
    <Rise delay={Math.min(index, 6) * 0.05} amount={0.1}>
      <li className="border-b border-black/[0.07] py-6 last:border-0">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="font-display text-[15px] font-semibold tabular-nums text-black/25">{String(index + 1).padStart(2, '0')}</span>
          {item.problems.map((p) => <span key={p} className="text-[12px] font-medium uppercase tracking-[0.08em] text-orange-ink">{p}</span>)}
        </div>
        <p className="mt-3 text-[15px] leading-[1.55] text-graphite"><span className="mr-2 text-[12px] font-semibold uppercase tracking-[0.1em] text-silver">Now</span>{item.original}</p>
        <div className="mt-3 flex items-start gap-4">
          <p className="flex-1 font-display text-[19px] font-medium leading-[1.45] tracking-tight text-ink">
            <span className="mr-2 align-middle font-text text-[12px] font-semibold uppercase tracking-[0.1em] text-green-ink">Try</span>
            <WithPlaceholders text={item.rewrite} />
          </p>
          <button type="button" onClick={copy} className="shrink-0 rounded-full px-3 py-1.5 text-[13px] font-medium text-action-link transition-colors hover:bg-blue-soft">Copy</button>
        </div>
        {item.why && <p className="mt-2 text-[14px] text-silver">{item.why}</p>}
      </li>
    </Rise>
  );
}

const REMOVED_LABEL = { name: 'name', email: 'email', phone: 'phone number', link: 'link' };

function Review({ data, hasJd }) {
  const r = data.review;
  const view = r.recruiter_view || {};
  const removed = Object.entries(data.removed || {})
    .map(([k, n]) => `${n} ${REMOVED_LABEL[k] || k}${n === 1 ? '' : 's'}`);
  return (
    <div className="space-y-12">
      <Sub title="What a recruiter sees in 6 seconds">
        <p className="max-w-[40ch] font-display text-[26px] font-semibold leading-[1.25] tracking-tight text-ink md:text-[32px]">{view.headline}</p>
        <ul className="mt-6 space-y-3">
          {(view.points || []).map((p) => (
            <li key={p} className="flex gap-3 text-[16px] leading-[1.55] text-ink">
              <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-blue" aria-hidden="true" />{p}
            </li>
          ))}
        </ul>
        {view.best_fit_roles?.length > 0 && (
          <p className="mt-6 text-[15px] text-graphite">
            Fits best right now: <span className="font-medium text-ink">{view.best_fit_roles.join(' · ')}</span>
          </p>
        )}
      </Sub>

      {r.strengths?.length > 0 && (
        <Sub title="Your strengths">
          <ul className="grid gap-6 md:grid-cols-3">
            {r.strengths.map((s, i) => (
              <li key={s} className="text-[16px] leading-[1.55] text-ink">
                <span className="mb-2 block font-display text-[28px] font-semibold tabular-nums text-green">{String(i + 1).padStart(2, '0')}</span>{s}
              </li>
            ))}
          </ul>
        </Sub>
      )}

      {hasJd && r.jd && (
        <Sub title="Against this job description" note={r.jd.fit_summary}>
          <ul>
            {r.jd.requirements.map((req) => {
              const st = STATUS[req.status] || STATUS.missing;
              return (
                <li key={req.requirement} className="grid gap-2 border-b border-black/[0.07] py-5 last:border-0 md:grid-cols-[120px_minmax(0,1fr)] md:gap-6">
                  <span className="flex items-center gap-2 text-[14px] font-medium" style={{ color: st.color }}>
                    <span className="h-2 w-2 rounded-full" style={{ background: st.color }} aria-hidden="true" />{st.label}
                  </span>
                  <div>
                    <p className="text-[16px] font-medium text-ink">{req.requirement}</p>
                    {req.evidence && <p className="mt-1 text-[14px] italic leading-[1.5] text-graphite">&ldquo;{req.evidence}&rdquo;</p>}
                    {req.suggestion && <p className="mt-1 text-[14px] leading-[1.5] text-ink/80">{req.suggestion}</p>}
                  </div>
                </li>
              );
            })}
          </ul>
        </Sub>
      )}

      {r.bullets?.length > 0 && (
        <Sub title="Bullet coach" note="Rewrites keep your facts. Fill in each [placeholder] with your real number, or leave that part out.">
          <ol>{r.bullets.map((item, i) => <BulletRewrite key={item.original} item={item} index={i} />)}</ol>
        </Sub>
      )}

      {r.interview_questions?.length > 0 && (
        <Sub title="Questions to prepare for" note="Taken from what your resume claims. Practise a two-minute answer for each.">
          <ol>
            {r.interview_questions.map((q, i) => (
              <li key={q.question} className="grid grid-cols-[auto_1fr] gap-5 border-b border-black/[0.07] py-5 last:border-0">
                <span className="font-display text-[22px] font-semibold tabular-nums text-black/15">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <p className="text-[17px] leading-[1.5] text-ink">{q.question}</p>
                  {q.about && <p className="mt-1 text-[13px] text-silver">{q.about}</p>}
                </div>
              </li>
            ))}
          </ol>
        </Sub>
      )}

      <p className="border-t border-black/[0.07] pt-6 text-[13px] leading-[1.6] text-silver">
        Written by {data.model} and checked against your resume{r.dropped ? `: ${r.dropped} suggestion${r.dropped === 1 ? ' was' : 's were'} removed because ${r.dropped === 1 ? 'it' : 'they'} did not match your resume or added numbers you never wrote` : ''}.
        {' '}{data.cached ? 'Saved earlier, so this did not use a review.' : 'Saved, so asking again is free.'}
        {removed.length > 0 && ` Removed before sending: ${removed.join(', ')}.`}
      </p>
    </div>
  );
}

/**
 * AI review by Google Gemini. Hidden when the server has no Gemini key.
 * Sends the saved resume (name, phone, email and links removed) and the same job description as the analysis.
 */
function AiCoach({ resumeId, jd, status }) {
  const [ai, setAi] = useState(status);
  const [state, setState] = useState({ loading: false, error: '', data: null });

  if (!ai?.enabled || !resumeId) return null;
  const hasJd = Boolean(jd?.text || jd?.file);

  const run = async () => {
    setState({ loading: true, error: '', data: null });
    const form = new FormData();
    if (jd?.text) form.append('jd_text', jd.text);
    if (jd?.file) form.append('jd_file', jd.file);
    try {
      const { data } = await api.post(`/resumes/${resumeId}/ai-review`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 150000 });
      setAi(data.ai || ai);
      setState({ loading: false, error: '', data });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err, 'The AI review did not work. Try again in a minute.'), data: null });
    }
  };

  const left = ai.remaining_today ?? 0;
  return (
    <Section
      index="AI"
      title="AI coach"
      note="Google Gemini reads your resume like a recruiter. Your name, phone, email and links are removed before it is sent."
      aside={!state.data && !state.loading && (
        <div>
          <Button onClick={run} disabled={left <= 0}>{hasJd ? 'Review against this JD' : 'Run AI review'}</Button>
          <p className="mt-2 text-[13px] text-silver">{left} of {ai.daily_limit} left today</p>
        </div>
      )}
    >
      {state.error && <Notice toneName="orange" className="mb-6">{state.error}</Notice>}
      {state.loading ? <Thinking /> : state.data ? <Review data={state.data} hasJd={hasJd} /> : (
        <ul className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
          {[
            ['What a recruiter sees', 'Your resume in one line and three points, as a recruiter reads it in 6 seconds.'],
            ['Bullet coach', 'Rewrites of your weakest bullets that keep your facts and mark missing numbers.'],
            [hasJd ? 'Requirement by requirement' : 'Strengths', hasJd ? 'Each part of the job description, with the line of your resume that proves it.' : 'What already works, so you keep it.'],
            ['Interview questions', 'What an interviewer is likely to ask about the claims you make.'],
          ].map(([title, line]) => (
            <li key={title}>
              <p className="font-display text-[19px] font-semibold tracking-tight text-ink">{title}</p>
              <p className="mt-1 text-[15px] leading-[1.5] text-graphite">{line}</p>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

export default AiCoach;
