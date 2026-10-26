import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, animate, useMotionValue, useTransform } from 'framer-motion';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Button, Notice, Segmented, cx } from '../components/ui/primitives';
import { Combobox, Select } from '../components/ui/Select';
import { EASE, Glass, Rise, Section, SegmentDial } from '../components/ui/studio';
import { lpa, money, signedPercent } from '../lib/format';
import OfferChecker from '../components/salary/OfferChecker';

const EMPTY_FORM = { job_title: '', years_of_experience: '', city: '', work_mode: 'On-site', skills: '' };
const FALLBACK_CITIES = ['Bengaluru', 'Hyderabad', 'Pune', 'Mumbai', 'Chennai', 'Gurugram', 'Noida', 'Delhi', 'Kolkata', 'Ahmedabad', 'Remote'];
const parseSkills = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);
const GREEN = '#34c759';
const TEAL = '#30b0c7';

/** Big LPA figure that counts up to `value` whenever it changes. */
function CountingLpa({ value, className }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => lpa(v));
  useEffect(() => {
    const controls = animate(mv, value, { duration: 1.3, ease: EASE });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span className={cx('tabular-nums', className)}>{text}</motion.span>;
}

/** Inline input styled as part of the sentence. */
function InlineInput({ className = '', ...props }) {
  return (
    <input
      {...props}
      className={cx('inline-block border-b-2 border-black/15 bg-transparent px-0.5 pb-0.5 font-display font-semibold tracking-tight text-ink placeholder:text-black/25 transition-colors hover:border-ink focus:border-action focus:outline-none', className)}
    />
  );
}

/** The form reads as a sentence: "I'm a [title] with [n] years in [city], working [mode]." */
function SentenceForm({ form, setForm, onSubmit, loading, mode, options, resumeSkills }) {
  const set = (name) => (e) => setForm((prev) => ({ ...prev, [name]: e.target.value }));
  const cities = options?.cities?.length ? options.cities : FALLBACK_CITIES;
  return (
    <form onSubmit={onSubmit}>
      <p className="font-display text-[28px] font-semibold leading-[1.75] tracking-tight text-black/35 md:text-[40px] md:leading-[1.7]">
        I&apos;m a{' '}
        <Combobox
          variant="inline" value={form.job_title} onChange={set('job_title')} required minLength={2} maxLength={100}
          suggestions={options?.job_titles || options?.popular_titles || []} placeholder="job title"
        />{' '}
        with{' '}
        <InlineInput
          type="number" min="0" max="40" step="0.5" required value={form.years_of_experience} onChange={set('years_of_experience')}
          placeholder="0" aria-label="Years of experience" className="w-[2.6ch] text-center"
        />{' '}
        years in{' '}
        <Select variant="inline" value={form.city} onChange={set('city')} options={cities} placeholder="any city" />,
        working{' '}
        <Select variant="inline" value={form.work_mode} onChange={set('work_mode')} options={options?.work_modes || ['On-site', 'Hybrid', 'Remote']} />.
      </p>
      <div className="mt-6 grid gap-6 border-t border-black/[0.07] pt-6 md:grid-cols-[1fr_auto] md:items-end">
        <div>
          <label htmlFor="salary-skills" className="text-[13px] font-medium text-graphite">Key skills, optional</label>
          <input
            id="salary-skills" value={form.skills} onChange={set('skills')} placeholder="Python, SQL, Power BI"
            className="mt-1 block w-full border-b border-black/15 bg-transparent py-2 text-[17px] text-ink placeholder:text-silver focus:border-action focus:outline-none"
          />
          {resumeSkills.length > 0 && !form.skills && (
            <button type="button" onClick={() => setForm((p) => ({ ...p, skills: resumeSkills.slice(0, 12).join(', ') }))} className="mt-2 text-[13px] text-action-link hover:underline">
              Use skills from my primary resume
            </button>
          )}
        </div>
        <Button type="submit" size="lg" loading={loading} className="min-w-[220px]">
          {loading ? 'Estimating...' : mode === 'compare' ? 'Compare both estimates' : 'Estimate my salary'}
        </Button>
      </div>
    </form>
  );
}

/** A soft spectrum from low to high with the estimate marked, instead of a progress bar. */
function Spectrum({ min, max, value, wideMin, wideMax }) {
  const lo = Math.min(wideMin ?? min, value) * 0.92;
  const hi = Math.max(wideMax ?? max, value) * 1.06;
  const pos = (v) => ((v - lo) / (hi - lo)) * 100;
  return (
    <div className="pt-10">
      <div className="relative h-16">
        {wideMin != null && (
          <div className="absolute top-1/2 h-px -translate-y-1/2 bg-black/15" style={{ left: `${pos(wideMin)}%`, width: `${pos(wideMax) - pos(wideMin)}%` }} />
        )}
        <motion.div
          className="absolute top-1/2 h-10 -translate-y-1/2 rounded-full opacity-80 blur-[1px]"
          style={{ left: `${pos(min)}%`, width: `${pos(max) - pos(min)}%`, background: `linear-gradient(90deg, ${TEAL}55, ${GREEN}, ${TEAL}55)` }}
          initial={{ scaleX: 0, opacity: 0 }} animate={{ scaleX: 1, opacity: 0.85 }} transition={{ duration: 1.1, ease: EASE }}
        />
        <motion.div className="absolute top-0 flex h-full -translate-x-1/2 flex-col items-center" style={{ left: `${pos(value)}%` }}
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: EASE, delay: 0.7 }}>
          <span className="h-full w-[2px] rounded-full bg-ink" />
          <span className="absolute -top-8 whitespace-nowrap rounded-full bg-ink px-2.5 py-1 text-[12px] font-semibold text-white tabular-nums">{lpa(value)}</span>
        </motion.div>
      </div>
      <div className="mt-3 flex justify-between text-[13px] text-graphite tabular-nums">
        <span>{lpa(wideMin ?? min)}</span>
        <span className="text-silver">{wideMin != null ? 'Likely range glows, wide range is the thin line' : 'Likely range for similar postings'}</span>
        <span>{lpa(wideMax ?? max)}</span>
      </div>
    </div>
  );
}

/**
 * Waterfall: starts at a typical posting, then each factor multiplies it, ending at the estimate.
 * The effects come from the model, so the steps add up exactly (in log space).
 */
function Waterfall({ factors, estimate }) {
  const steps = useMemo(() => {
    const list = (factors || []).filter((f) => Number.isFinite(f.effect_pct));
    const product = list.reduce((acc, f) => acc * (1 + f.effect_pct / 100), 1);
    let running = estimate / (product || 1);
    const out = [{ label: 'Typical posting', from: 0, to: running, base: true }];
    list.forEach((f) => {
      const next = running * (1 + f.effect_pct / 100);
      out.push({ label: f.factor, from: running, to: next, effect: f.effect_pct });
      running = next;
    });
    out.push({ label: 'Your estimate', from: 0, to: estimate, total: true });
    return out;
  }, [factors, estimate]);
  const top = Math.max(...steps.map((s) => Math.max(s.from, s.to))) * 1.08 || 1;
  const pct = (v) => (v / top) * 100;
  return (
    <div className="space-y-3">
      {steps.map((s, i) => {
        const left = Math.min(s.from, s.to);
        const width = Math.abs(s.to - s.from);
        const up = s.effect >= 0;
        const color = s.total ? `linear-gradient(90deg, ${GREEN}, ${TEAL})` : s.base ? '#d2d2d7' : up ? GREEN : '#ff3b30';
        return (
          <div key={s.label} className="grid grid-cols-[130px_1fr_88px] items-center gap-4 md:grid-cols-[170px_1fr_110px]">
            <span className={cx('text-[14px]', s.total ? 'font-semibold text-ink' : 'text-graphite')}>{s.label}</span>
            <div className="relative h-7">
              <div className="absolute inset-y-[13px] left-0 right-0 bg-black/[0.04]" />
              <motion.div
                className="absolute inset-y-0 origin-left rounded-[6px]"
                style={{ left: `${pct(left)}%`, width: `${Math.max(pct(width), 0.6)}%`, background: color }}
                initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }}
                transition={{ duration: 0.7, ease: EASE, delay: 0.15 + i * 0.14 }}
              />
            </div>
            <span className={cx('text-right text-[14px] tabular-nums', s.total || s.base ? 'font-semibold text-ink' : up ? 'text-green-ink' : 'text-red-ink')}>
              {s.total || s.base ? lpa(s.to) : signedPercent(s.effect)}
            </span>
          </div>
        );
      })}
      <p className="pt-2 text-[12px] text-silver">Each bar shows how much that input moves pay compared with an average Indian posting.</p>
    </div>
  );
}

function QuickResult({ result }) {
  return (
    <>
      <Rise>
        <div className="py-6">
          <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-green-ink">Estimated annual CTC</p>
          <CountingLpa value={result.predicted_salary} className="mt-4 block font-display text-[72px] font-semibold leading-none tracking-tighter2 text-ink md:text-[136px]" />
          <p className="mt-5 text-[17px] text-graphite tabular-nums">
            {money(result.predicted_salary)} a year, about <span className="text-ink">{money(result.predicted_salary / 12)}</span> a month before tax
          </p>
          <Spectrum min={result.salary_range.min} max={result.salary_range.max} value={result.predicted_salary} />
        </div>
      </Rise>
      {result.top_influential_factors?.length > 0 && (
        <Section index="02" title="What moved the number" note="From a typical posting to your estimate, one input at a time.">
          <Waterfall factors={result.top_influential_factors} estimate={result.predicted_salary} />
        </Section>
      )}
    </>
  );
}

function CompareResult({ results, metrics }) {
  const { basic, advanced, comparison } = results;
  const confidence = Math.round(advanced?.prediction_confidence || 0);
  return (
    <>
      <Rise>
        <div className="grid gap-10 py-6 md:grid-cols-2 md:gap-0 md:divide-x md:divide-black/[0.07]">
          {[['Quick estimate', 'Ridge regression', basic, 'basic'], ['Advanced estimate', 'Ridge + gradient-boosted trees', advanced, 'advanced']].map(([label, detail, r, key], i) => r && (
            <div key={key} className={i ? 'md:pl-12' : 'md:pr-12'}>
              <div className="flex items-center gap-3">
                <p className={cx('text-[13px] font-semibold uppercase tracking-[0.14em]', i ? 'text-green-ink' : 'text-graphite')}>{label}</p>
                {comparison?.higher_prediction === key && <span className="text-[12px] font-medium text-orange-ink">Higher</span>}
              </div>
              <CountingLpa value={r.predicted_salary} className="mt-4 block font-display text-[60px] font-semibold leading-none tracking-tighter2 text-ink md:text-[88px]" />
              <p className="mt-3 text-[15px] text-graphite">Likely {lpa(r.salary_range?.min)} to {lpa(r.salary_range?.max)}</p>
              <p className="text-[13px] text-silver">{detail}</p>
            </div>
          ))}
        </div>
        {advanced && (
          <Spectrum
            min={advanced.salary_range.min} max={advanced.salary_range.max} value={advanced.predicted_salary}
            wideMin={advanced.confidence_interval?.lower} wideMax={advanced.confidence_interval?.upper}
          />
        )}
      </Rise>

      {advanced && (
        <Section index="02" title="How sure is it" note={metrics?.interval_coverage_pct ? `The wide range held ${Math.round(metrics.interval_coverage_pct)}% of real postings in testing.` : 'Narrower ranges give higher confidence.'}>
          <div className="flex flex-col items-start gap-10 md:flex-row md:items-center">
            <SegmentDial
              size={220}
              parts={[{ key: 'c', label: 'Confidence', score: confidence, max: 100 }]}
              toneFor={() => (confidence >= 75 ? GREEN : '#ff9500')}
            >
              <p className="font-display text-[48px] font-semibold leading-none tracking-tighter2 tabular-nums">{confidence}<span className="text-[22px] text-silver">%</span></p>
              <p className="mt-1 text-[12px] text-graphite">confidence</p>
            </SegmentDial>
            <dl className="grid flex-1 gap-6 sm:grid-cols-3">
              {[
                ['Difference', lpa(Math.abs(comparison?.difference || 0))],
                ['In percent', `${Math.abs(comparison?.difference_percentage || 0).toFixed(1)}%`],
                ['Higher estimate', comparison?.higher_prediction === 'advanced' ? 'Advanced' : comparison?.higher_prediction === 'basic' ? 'Quick' : 'Equal'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[13px] text-graphite">{k}</dt>
                  <dd className="mt-1 font-display text-[30px] font-semibold tracking-tight text-ink tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </Section>
      )}

      {advanced?.top_influential_factors?.length > 0 && (
        <Section index="03" title="What moved the number" note="From a typical posting to the advanced estimate, one input at a time.">
          <Waterfall factors={advanced.top_influential_factors} estimate={advanced.predicted_salary} />
        </Section>
      )}
    </>
  );
}

/** Indian salary estimates from 2025 Naukri.com postings, with a quick and an advanced model. */
function SalaryPredictor() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = location.pathname === '/advanced-salary-predictor' ? 'compare' : 'quick';
  const [form, setForm] = useState(EMPTY_FORM);
  const [options, setOptions] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [resumeSkills, setResumeSkills] = useState([]);
  const [result, setResult] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  // The inputs behind the shown estimate, so an offer is checked against the same profile
  const [lastRequest, setLastRequest] = useState(null);

  useEffect(() => {
    api.get('/salary-options').then((res) => setOptions(res.data)).catch(() => {});
    api.get('/model-info').then((res) => setMetrics(res.data.metrics)).catch(() => {});
    api.get('/resume-history').then((res) => {
      const primary = res.data.resumes?.find((r) => r.is_primary);
      setResumeSkills((Array.isArray(primary?.skills) ? primary.skills : []).map(String));
      const years = res.data.primary_experience_years;
      if (years) setForm((prev) => (prev.years_of_experience ? prev : { ...prev, years_of_experience: String(years) }));
    }).catch(() => {});
  }, []);

  const changeMode = (next) => {
    setError('');
    navigate(next === 'compare' ? '/advanced-salary-predictor' : '/salary-predictor', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const requestData = {
      job_title: form.job_title.trim(),
      years_of_experience: Number(form.years_of_experience),
      city: form.city || null,
      work_mode: form.city === 'Remote' ? 'Remote' : form.work_mode,
      skills: parseSkills(form.skills),
    };
    try {
      if (mode === 'compare') {
        const res = await api.post('/compare-predictions', requestData);
        setComparison({ basic: res.data.basic_model, advanced: res.data.advanced_model, comparison: res.data.comparison });
      } else {
        setResult(null);
        const res = await api.post('/predict', requestData);
        setResult(res.data);
      }
      setLastRequest(requestData);
    } catch (err) {
      setError(errorMessage(err, mode === 'compare' ? 'Comparison failed' : 'Estimate failed'));
    } finally {
      setLoading(false);
    }
  };

  const shown = mode === 'compare' ? comparison : result;
  const accuracy = metrics?.quick;

  return (
    <AppShell toneName="green">
      <PageHeader
        eyebrow="Salary"
        title={mode === 'compare' ? 'Two estimates. One honest range.' : 'Know what you are worth in India.'}
        accent={mode === 'compare' ? 2 : 1}
        subtitle={mode === 'compare'
          ? 'A quick linear model beside an advanced blend of gradient-boosted trees, with a range drawn from similar postings.'
          : 'Annual CTC from your role, experience, city and skills, learned from real 2025 Indian job postings.'}
        actions={(
          <Segmented
            label="Estimate mode"
            value={mode}
            onChange={changeMode}
            options={[{ value: 'quick', label: 'Quick estimate' }, { value: 'compare', label: 'Compare models' }]}
          />
        )}
      />

      <Glass>
        <SentenceForm form={form} setForm={setForm} onSubmit={handleSubmit} loading={loading} mode={mode} options={options} resumeSkills={resumeSkills} />
        {error && <Notice className="mt-5">{error}</Notice>}
      </Glass>
      <p className="mt-4 max-w-[80ch] text-[13px] leading-[1.5] text-silver">
        Trained on {metrics?.trained_on_rows ? metrics.trained_on_rows.toLocaleString('en-IN') : '31,000+'} Naukri.com postings with disclosed pay (Sep to Oct 2025).
        {accuracy ? ` On companies it never saw, half of its estimates were within ${Math.round(accuracy.median_error_pct)}% of the posted salary.` : ''}
        {' '}Posted ranges are a guide, not an offer.
      </p>

      <div className="mt-16">
        <AnimatePresence mode="wait">
          <motion.div key={`${mode}-${shown ? 'r' : 'e'}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
            {shown ? (
              <>
                {mode === 'compare' ? <CompareResult results={comparison} metrics={metrics} /> : <QuickResult result={result} />}
                {lastRequest && <OfferChecker key={JSON.stringify(lastRequest)} request={lastRequest} index={mode === 'compare' ? '04' : '03'} />}
              </>
            ) : (
              <div className="relative overflow-hidden py-20 text-center">
                <p aria-hidden="true" className="select-none font-display text-[96px] font-semibold leading-none tracking-tighter2 text-transparent md:text-[180px]" style={{ backgroundImage: 'linear-gradient(180deg, rgba(52,199,89,0.16), rgba(48,176,199,0.04))', WebkitBackgroundClip: 'text', backgroundClip: 'text' }}>₹ ? LPA</p>
                <p className="mt-6 text-[17px] text-graphite">Complete the sentence above to see your estimate.</p>
                {mode === 'quick' && (
                  <button type="button" onClick={() => changeMode('compare')} className="mt-3 text-[15px] text-action-link hover:underline">Or compare both models</button>
                )}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </AppShell>
  );
}

export default SalaryPredictor;
