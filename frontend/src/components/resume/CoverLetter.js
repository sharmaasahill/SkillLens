import React, { useState } from 'react';
import api, { errorMessage } from '../../api';
import { Button, Notice } from '../ui/primitives';
import { useFeedback } from '../ui/overlays';
import { Rise, Section } from '../ui/studio';
import { downloadBlob } from '../../lib/format';
import { WithPlaceholders } from './AiCoach';

/** Gentle line-by-line shimmer while the letter is being written. */
function Writing() {
  return (
    <div className="space-y-3" role="status" aria-label="Writing your cover letter">
      {['w-1/3', 'w-full', 'w-11/12', 'w-4/5', 'w-full', 'w-2/3'].map((w, i) => (
        <div key={i} className={`h-4 animate-pulse rounded-full bg-black/[0.06] ${w}`} style={{ animationDelay: `${i * 0.12}s` }} />
      ))}
      <p className="pt-2 text-[14px] text-graphite">Matching your resume to the job. This takes up to a minute.</p>
    </div>
  );
}

/**
 * Cover letter draft by Google Gemini, for this resume and the job description used in the analysis.
 * Only facts from the resume and the job are used; a sentence with a number from neither is dropped.
 */
function CoverLetter({ resumeId, jd, status }) {
  const { notify } = useFeedback();
  const [ai, setAi] = useState(status);
  const [state, setState] = useState({ loading: false, error: '', data: null });

  if (!ai?.enabled || !resumeId) return null;
  const hasJd = Boolean(jd?.text || jd?.file);
  const left = ai.remaining_today ?? 0;

  const write = async () => {
    setState({ loading: true, error: '', data: null });
    const form = new FormData();
    if (jd?.text) form.append('jd_text', jd.text);
    if (jd?.file) form.append('jd_file', jd.file);
    try {
      const { data } = await api.post(`/resumes/${resumeId}/cover-letter`, form, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 150000 });
      setAi(data.ai || ai);
      setState({ loading: false, error: '', data });
    } catch (err) {
      setState({ loading: false, error: errorMessage(err, 'The cover letter did not work. Try again in a minute.'), data: null });
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(state.data.text);
      notify('Cover letter copied');
    } catch (err) {
      notify('Select the letter and copy it yourself', 'info');
    }
  };
  const download = () => {
    const name = (state.data.letter.company || 'job').replace(/[^\w-]+/g, '_').slice(0, 40);
    downloadBlob(state.data.text, `cover_letter_${name}.txt`, 'text/plain;charset=utf-8');
  };

  const letter = state.data?.letter;
  return (
    <Section
      index="AI"
      title="Cover letter"
      note={<>A short draft from your resume and this job description. Your name, phone, email and links are removed before it is sent to Google Gemini. <a href="/privacy" target="_blank" rel="noopener noreferrer" className="text-action-link hover:underline">Privacy</a></>}
      aside={hasJd && !state.data && !state.loading && (
        <div>
          <Button onClick={write} disabled={left <= 0}>Write cover letter</Button>
          <p className="mt-2 text-[13px] text-silver">Uses 1 of {left} AI reviews left today</p>
        </div>
      )}
    >
      {!hasJd ? (
        <p className="max-w-[62ch] text-[16px] leading-[1.6] text-graphite">
          Add the job description above (paste or upload) and analyze again. The letter is written for that exact role,
          using only what your resume shows. From the Jobs page, <span className="text-ink">Check my resume for this job</span> fills it in for you.
        </p>
      ) : (
        <>
          {state.error && <Notice toneName="orange" className="mb-6">{state.error}</Notice>}
          {state.loading ? <Writing /> : letter ? (
            <Rise>
              <article className="max-w-[68ch] rounded-[28px] bg-white/80 p-7 text-[16px] leading-[1.75] text-ink shadow-[0_24px_60px_-30px_rgba(0,0,0,0.25)] ring-1 ring-black/[0.05] md:p-10">
                {(letter.role || letter.company) && (
                  <p className="mb-6 text-[13px] font-semibold uppercase tracking-[0.12em] text-blue-ink">
                    {[letter.role, letter.company].filter(Boolean).join(' · ')}
                  </p>
                )}
                <p><WithPlaceholders text={letter.greeting} /></p>
                {letter.paragraphs.map((p) => <p key={p} className="mt-4"><WithPlaceholders text={p} /></p>)}
                <p className="mt-6">{letter.sign_off}<br /><WithPlaceholders text={letter.signature} /></p>
              </article>
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <Button variant="dark" onClick={copy}>Copy</Button>
                <Button variant="outline" onClick={download}>Download .txt</Button>
                <p className="text-[13px] text-silver">Fill in each [placeholder] before you send it.</p>
              </div>
              <p className="mt-6 border-t border-black/[0.07] pt-6 text-[13px] leading-[1.6] text-silver">
                Written by {state.data.model} and checked against your resume and the job
                {letter.dropped ? `: ${letter.dropped} sentence${letter.dropped === 1 ? ' was' : 's were'} removed for numbers neither of them gives` : ''}.
                {' '}{state.data.cached ? 'Saved earlier, so this did not use a review.' : 'Saved, so asking again is free.'}
              </p>
            </Rise>
          ) : (
            <p className="max-w-[62ch] text-[16px] leading-[1.6] text-graphite">
              Three or four short paragraphs: why this role, two or three things from your resume that match what it asks for,
              and a polite close. Missing details become [placeholders] for you to fill in, never invented facts.
            </p>
          )}
        </>
      )}
    </Section>
  );
}

export default CoverLetter;
