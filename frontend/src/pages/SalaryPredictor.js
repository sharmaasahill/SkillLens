import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, animate, useMotionValue, useTransform } from 'framer-motion';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Badge, Button, Card, ComboboxField, Meter, Notice, ScoreRing, Segmented, SelectField, TextField, EASE, cx } from '../components/ui/primitives';
import { lpa, money, signedPercent } from '../lib/format';

const EMPTY_FORM = { job_title: '', years_of_experience: '', city: '', work_mode: 'On-site', skills: '' };
const FALLBACK_CITIES = ['Bengaluru', 'Hyderabad', 'Pune', 'Mumbai', 'Chennai', 'Gurugram', 'Noida', 'Delhi', 'Kolkata', 'Ahmedabad', 'Remote'];

const parseSkills = (text) => text.split(',').map((s) => s.trim()).filter(Boolean);

/** Big LPA figure that counts up to `value` whenever it changes. */
function CountingLpa({ value, className }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => lpa(v));
  React.useEffect(() => {
    const controls = animate(mv, value, { duration: 1.2, ease: EASE });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span className={cx('tabular-nums', className)}>{text}</motion.span>;
}

/** Where `value` sits between min and max, drawn as a track with a marker. */
function RangeTrack({ min, max, value, toneName = 'green' }) {
  const lo = Math.min(min, value) * 0.9;
  const hi = Math.max(max, value) * 1.1;
  const pos = (v) => `${((v - lo) / (hi - lo)) * 100}%`;
  const fill = toneName === 'green' ? 'bg-green' : 'bg-blue';
  return (
    <div>
      <div className="relative h-3 rounded-full bg-[#e8e8ed]">
        <motion.div
          className={cx('absolute inset-y-0 origin-left rounded-full', fill)}
          style={{ left: pos(min), width: `calc(${pos(max)} - ${pos(min)})` }}
          initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1, ease: EASE }}
        />
        <motion.span
          className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.3)] ring-2 ring-ink"
          style={{ left: pos(value) }}
          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.4, delay: 0.8 }}
        />
      </div>
      <div className="mt-2 flex justify-between text-[13px] text-graphite tabular-nums">
        <span>{lpa(min)}</span>
        <span>{lpa(max)}</span>
      </div>
    </div>
  );
}

/** What moved the estimate, as signed percentages against an average posting. */
function Factors({ factors }) {
  if (!factors?.length) return null;
  return (
    <div className="space-y-4">
      {factors.map((factor, i) => (
        <div key={factor.factor}>
          <div className="mb-1.5 flex justify-between text-[14px]">
            <span className="text-ink">{factor.factor}</span>
            <span className={cx('tabular-nums font-medium', factor.effect_pct >= 0 ? 'text-green-ink' : 'text-red-ink')}>
              {signedPercent(factor.effect_pct)}
            </span>
          </div>
          <Meter value={factor.importance * 100} toneName={factor.effect_pct >= 0 ? 'green' : 'red'} delay={i * 0.1} />
        </div>
      ))}
      <p className="text-[12px] text-silver">Compared with an average posting in the dataset.</p>
    </div>
  );
}

function SalaryForm({ form, setForm, onSubmit, loading, mode, options, resumeSkills }) {
  const set = (name) => (e) => setForm((prev) => ({ ...prev, [name]: e.target.value }));
  const cities = options?.cities?.length ? options.cities : FALLBACK_CITIES;
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <ComboboxField
        label="Job title" placeholder="e.g. Data Scientist, Accountant, Sales Manager" value={form.job_title}
        onChange={set('job_title')} required minLength={2} maxLength={100} className="sm:col-span-2"
        suggestions={options?.job_titles || options?.popular_titles || []}
        hint={`Type any title. ${options?.job_titles ? `${options.job_titles.length.toLocaleString('en-IN')} titles` : 'Suggestions'} from Indian job postings.`}
      />
      <TextField label="Years of experience" type="number" min="0" max="40" step="0.5" placeholder="Years" value={form.years_of_experience} onChange={set('years_of_experience')} required />
      <SelectField label="City" value={form.city} onChange={set('city')} options={cities} placeholder="Any city" />
      <SelectField label="Work mode" value={form.work_mode} onChange={set('work_mode')} options={options?.work_modes || ['On-site', 'Hybrid', 'Remote']} className="sm:col-span-2" />
      <div className="sm:col-span-2">
        <TextField
          label="Key skills (optional)" placeholder="Python, SQL, Power BI" value={form.skills} onChange={set('skills')}
          hint="Comma separated. Skills such as SAP or cloud platforms can move pay a lot."
        />
        {resumeSkills.length > 0 && !form.skills && (
          <button
            type="button"
            onClick={() => setForm((prev) => ({ ...prev, skills: resumeSkills.slice(0, 12).join(', ') }))}
            className="mt-2 text-[13px] text-action-link hover:underline"
          >
            Use skills from my primary resume
          </button>
        )}
      </div>
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? (mode === 'compare' ? 'Analyzing...' : 'Estimating...') : (mode === 'compare' ? 'Compare both estimates' : 'Estimate my salary')}
        </Button>
      </div>
    </form>
  );
}

function BasicResult({ result }) {
  return (
    <div className="space-y-5">
      <Card className="relative overflow-hidden !p-8">
        <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(52,199,89,0.25),transparent_70%)]" />
        <Badge toneName="green">Quick estimate</Badge>
        <p className="mt-6 text-[15px] text-graphite">Estimated annual CTC</p>
        <CountingLpa value={result.predicted_salary} className="mt-1 block font-display text-[56px] font-semibold leading-none tracking-tighter2 text-ink md:text-[72px]" />
        <p className="mt-3 text-[15px] text-graphite tabular-nums">
          {money(result.predicted_salary)} a year, about {money(result.predicted_salary / 12)} a month before tax
        </p>
        <div className="mt-10">
          <p className="mb-3 text-[13px] font-medium text-graphite">Likely range for similar postings</p>
          <RangeTrack min={result.salary_range.min} max={result.salary_range.max} value={result.predicted_salary} />
        </div>
      </Card>
      {result.top_influential_factors?.length > 0 && (
        <Card className="!p-7">
          <h3 className="mb-5 font-display text-[19px] font-semibold tracking-tight">What moved the number</h3>
          <Factors factors={result.top_influential_factors} />
        </Card>
      )}
    </div>
  );
}

function CompareResult({ results, metrics }) {
  const { basic, advanced, comparison } = results;
  const top = Math.max(basic?.predicted_salary || 0, advanced?.predicted_salary || 0) || 1;
  const higher = comparison?.higher_prediction;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        {basic && (
          <Card className="!p-7">
            <div className="flex items-center justify-between">
              <Badge toneName="gray">Quick estimate</Badge>
              {higher === 'basic' && <Badge toneName="orange">Higher</Badge>}
            </div>
            <CountingLpa value={basic.predicted_salary} className="mt-5 block font-display text-[44px] font-semibold leading-none tracking-tight" />
            <p className="mt-2 text-[14px] text-graphite">Likely {lpa(basic.salary_range?.min)} to {lpa(basic.salary_range?.max)}</p>
            <p className="mt-1 text-[13px] text-silver">Ridge regression</p>
            <Meter value={(basic.predicted_salary / top) * 100} toneName="gray" className="mt-6 h-2.5" />
          </Card>
        )}
        {advanced && (
          <Card className="relative overflow-hidden !p-7">
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(52,199,89,0.22),transparent_70%)]" />
            <div className="relative flex items-center justify-between">
              <Badge toneName="green">Advanced estimate</Badge>
              {higher === 'advanced' && <Badge toneName="orange">Higher</Badge>}
            </div>
            <CountingLpa value={advanced.predicted_salary} className="relative mt-5 block font-display text-[44px] font-semibold leading-none tracking-tight" />
            <p className="relative mt-2 text-[14px] text-graphite">Likely {lpa(advanced.salary_range?.min)} to {lpa(advanced.salary_range?.max)}</p>
            {advanced.confidence_interval && (
              <p className="relative mt-1 text-[13px] text-silver">
                Wide range {lpa(advanced.confidence_interval.lower)} to {lpa(advanced.confidence_interval.upper)}
                {metrics?.interval_coverage_pct ? ` (held ${Math.round(metrics.interval_coverage_pct)}% of real postings in testing)` : ''}
              </p>
            )}
            <Meter value={(advanced.predicted_salary / top) * 100} toneName="green" className="relative mt-6 h-2.5" delay={0.1} />
          </Card>
        )}
      </div>

      {advanced && (
        <div className="grid gap-5 md:grid-cols-[280px_1fr]">
          <Card className="flex flex-col items-center justify-center !p-7 text-center">
            {advanced.prediction_confidence && (
              <ScoreRing value={advanced.prediction_confidence} size={128} toneName={advanced.prediction_confidence >= 75 ? 'green' : 'orange'} label="confidence">
                <span className="font-display text-[28px] font-semibold leading-none tabular-nums">{Math.round(advanced.prediction_confidence)}%</span>
              </ScoreRing>
            )}
            <p className="mt-4 text-[13px] text-silver">Narrower ranges give higher confidence</p>
          </Card>
          <Card className="!p-7">
            <h3 className="mb-5 font-display text-[19px] font-semibold tracking-tight">What moved the number</h3>
            <Factors factors={advanced.top_influential_factors} />
          </Card>
        </div>
      )}

      {comparison && (
        <Card className="!p-7">
          <h3 className="font-display text-[19px] font-semibold tracking-tight">How the two estimates differ</h3>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-orange-soft p-5">
              <p className="text-[13px] text-orange-ink">Difference</p>
              <p className="mt-1 font-display text-[28px] font-semibold tracking-tight">{lpa(Math.abs(comparison.difference))}</p>
            </div>
            <div className="rounded-2xl bg-orange-soft p-5">
              <p className="text-[13px] text-orange-ink">Percentage difference</p>
              <p className="mt-1 font-display text-[28px] font-semibold tracking-tight">{Math.abs(comparison.difference_percentage).toFixed(1)}%</p>
            </div>
            <div className="rounded-2xl bg-mist p-5">
              <p className="text-[13px] text-graphite">Higher estimate</p>
              <p className="mt-1 font-display text-[28px] font-semibold tracking-tight">
                {higher === 'advanced' ? 'Advanced' : higher === 'basic' ? 'Quick' : 'Equal'}
              </p>
            </div>
          </div>
          <p className="mt-5 text-[15px] text-graphite">
            The quick estimate is a straight line through the data. The advanced one adds gradient-boosted trees,
            which pick up effects such as pay rising faster for senior roles.
          </p>
        </Card>
      )}
    </div>
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

  useEffect(() => {
    // Form helpers are optional; the form still works if any of these fail
    api.get('/salary-options').then((res) => setOptions(res.data)).catch(() => {});
    api.get('/model-info').then((res) => setMetrics(res.data.metrics)).catch(() => {});
    api.get('/resume-history').then((res) => {
      const primary = res.data.resumes?.find((r) => r.is_primary);
      const skills = Array.isArray(primary?.skills) ? primary.skills : [];
      setResumeSkills(skills.map(String));
      // Start from the primary resume's experience so the estimate needs fewer inputs
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
    } catch (err) {
      setError(errorMessage(err, mode === 'compare' ? 'Comparison failed' : 'Estimate failed'));
    } finally {
      setLoading(false);
    }
  };

  const shown = mode === 'compare' ? comparison : result;
  const accuracy = metrics?.quick;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Salary"
        toneName="green"
        title={mode === 'compare' ? 'Two estimates. One honest range.' : 'Know what you are worth in India.'}
        subtitle={mode === 'compare'
          ? 'Compare a quick linear model with an advanced blend of gradient-boosted trees, with a data-driven range and the factors behind it.'
          : 'Annual CTC estimated from your role, experience, city and skills, using real 2025 Indian job postings.'}
        actions={(
          <Segmented
            label="Estimate mode"
            value={mode}
            onChange={changeMode}
            options={[{ value: 'quick', label: 'Quick estimate' }, { value: 'compare', label: 'Compare models' }]}
          />
        )}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[400px_1fr]">
        <Card className="lg:sticky lg:top-24">
          <h2 className="mb-6 font-display text-[19px] font-semibold tracking-tight">Your details</h2>
          <SalaryForm form={form} setForm={setForm} onSubmit={handleSubmit} loading={loading} mode={mode} options={options} resumeSkills={resumeSkills} />
          {error && <Notice className="mt-4">{error}</Notice>}
          <p className="mt-5 border-t border-black/[0.06] pt-4 text-[12px] leading-[1.5] text-silver">
            Trained on {metrics?.trained_on_rows ? metrics.trained_on_rows.toLocaleString('en-IN') : '31,000+'} Naukri.com
            postings with disclosed pay (Sep to Oct 2025).
            {accuracy ? ` On companies it never saw, half of its estimates were within ${Math.round(accuracy.median_error_pct)}% of the posted salary.` : ''}
            {' '}Posted ranges are a guide, not an offer.
          </p>
        </Card>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${mode}-${shown ? 'result' : 'empty'}`}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            {shown ? (
              mode === 'compare' ? <CompareResult results={comparison} metrics={metrics} /> : <BasicResult result={result} />
            ) : (
              <div className="flex min-h-[420px] flex-col items-center justify-center rounded-[24px] border-2 border-dashed border-hairline px-8 text-center">
                <div className="flex -space-x-3">
                  {['#34c759', '#30b0c7', '#007aff'].map((c, i) => (
                    <motion.span
                      key={c}
                      className="h-12 w-12 rounded-full ring-4 ring-[#fbfbfd]"
                      style={{ background: c }}
                      animate={{ y: [0, -6, 0] }}
                      transition={{ duration: 2.4, repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
                    />
                  ))}
                </div>
                <p className="mt-6 font-display text-[24px] font-semibold tracking-tight">Your estimate will appear here</p>
                <p className="mt-2 max-w-[38ch] text-[15px] text-graphite">
                  Fill in your details and {mode === 'compare' ? 'compare both estimates' : 'see your estimate in lakhs per annum'}.
                </p>
                {mode === 'quick' && (
                  <button type="button" onClick={() => changeMode('compare')} className="mt-4 text-[15px] text-action-link hover:underline">
                    Try the advanced estimate
                  </button>
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
