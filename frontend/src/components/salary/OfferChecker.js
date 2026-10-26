import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import api, { errorMessage } from '../../api';
import { Button, Notice } from '../ui/primitives';
import { EASE, Rise, Section } from '../ui/studio';
import { lpa } from '../../lib/format';

const VERDICT_COLOR = { low: '#ff3b30', fair_low: '#ff9500', fair: '#30b0c7', good: '#34c759', strong: '#248a3d' };

/** The market spread for this profile, with the offer marked on it. */
function OfferScale({ result }) {
  const reduce = useReducedMotion();
  const lo = Math.min(result.wide_range.min, result.offer) * 0.94;
  const hi = Math.max(result.wide_range.max, result.offer) * 1.04;
  const pos = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  const color = VERDICT_COLOR[result.verdict] || '#1d1d1f';
  return (
    <div className="pt-12">
      <div className="relative h-14">
        <div className="absolute top-1/2 h-px -translate-y-1/2 bg-black/15" style={{ left: pos(result.wide_range.min), right: `calc(100% - ${pos(result.wide_range.max)})` }} />
        <div
          className="absolute top-1/2 h-8 -translate-y-1/2 rounded-full bg-[linear-gradient(90deg,#30b0c755,#34c759,#30b0c755)] opacity-80"
          style={{ left: pos(result.likely_range.min), right: `calc(100% - ${pos(result.likely_range.max)})` }}
        />
        <span className="absolute top-1/2 h-10 w-px -translate-y-1/2 bg-ink/40" style={{ left: pos(result.median) }} aria-hidden="true" />
        <motion.div
          className="absolute top-0 flex h-full -translate-x-1/2 flex-col items-center"
          initial={reduce ? false : { left: pos(result.median), opacity: 0 }}
          animate={{ left: pos(result.offer), opacity: 1 }}
          transition={{ duration: 1.1, ease: EASE }}
        >
          <span className="h-full w-[3px] rounded-full" style={{ background: color }} />
          <span className="absolute -top-9 whitespace-nowrap rounded-full px-2.5 py-1 text-[12px] font-semibold text-white tabular-nums" style={{ background: color }}>
            Your offer {lpa(result.offer)}
          </span>
        </motion.div>
      </div>
      <div className="mt-3 grid grid-cols-3 text-[13px] tabular-nums text-graphite">
        <span>{lpa(result.wide_range.min)}</span>
        <span className="text-center text-silver">Middle {lpa(result.median)}</span>
        <span className="text-right">{lpa(result.wide_range.max)}</span>
      </div>
      <p className="mt-2 text-center text-[12px] text-silver">The glow is the likely range (middle 60% of similar postings); the line runs from the 5th to the 95th percentile.</p>
    </div>
  );
}

/**
 * "I got Rs 12 LPA, is that good?" Places an offer among 2025 postings for the same role,
 * experience, city and skills, and suggests what to ask for.
 */
function OfferChecker({ request, index = '03' }) {
  const [offer, setOffer] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const check = async (e) => {
    e.preventDefault();
    const value = Number(offer);
    if (!value || value <= 0.5) { setError('Type the offer in lakhs per annum, for example 12.5'); return; }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/salary/offer-check', { ...request, offer_lpa: value });
      setResult(data);
    } catch (err) {
      setError(errorMessage(err, 'Could not check the offer'));
    } finally {
      setLoading(false);
    }
  };

  const pct = result?.percentile;
  return (
    <Section index={index} title="Check an offer" note={`Got an offer as a ${request.job_title}? See where it sits among similar postings.`}>
      <form onSubmit={check} className="flex flex-wrap items-end gap-x-6 gap-y-4">
        <label className="font-display text-[28px] font-semibold tracking-tight text-black/35 md:text-[36px]">
          I&apos;ve been offered ₹
          <input
            type="number" inputMode="decimal" min="0.5" max="500" step="0.1" value={offer} onChange={(e) => setOffer(e.target.value)}
            placeholder="12" aria-label="Offer in lakhs per annum"
            className="mx-1 inline-block w-[4.2ch] border-b-2 border-black/15 bg-transparent px-0.5 text-center text-ink placeholder:text-black/25 focus:border-action focus:outline-none"
          />
          LPA
        </label>
        <Button type="submit" variant="dark" loading={loading}>Check it</Button>
      </form>
      {error && <Notice className="mt-5">{error}</Notice>}

      {result && (
        <Rise key={`${result.offer}-${result.percentile}`}>
          <div className="mt-10">
            <p className="font-display text-[32px] font-semibold leading-[1.15] tracking-tight md:text-[40px]" style={{ color: VERDICT_COLOR[result.verdict] }}>
              {result.headline}
            </p>
            <p className="mt-3 max-w-[64ch] text-[17px] leading-[1.55] text-graphite">
              {result.below_range
                ? `${lpa(result.offer)} is below almost every similar posting (under the 5th percentile).`
                : result.above_range
                  ? `${lpa(result.offer)} is above almost every similar posting (over the 95th percentile).`
                  : <>{lpa(result.offer)} pays more than about <span className="font-semibold tabular-nums text-ink">{pct}%</span> of similar postings.</>}
              {' '}{result.advice}
            </p>
            {result.ask_for && (
              <p className="mt-4 text-[17px] text-ink">
                Ask for about <span className="font-display text-[24px] font-semibold tabular-nums">{lpa(result.ask_for)}</span>
              </p>
            )}
            <OfferScale result={result} />
          </div>
        </Rise>
      )}
    </Section>
  );
}

export default OfferChecker;
