import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, animate, useMotionValue, useTransform } from 'framer-motion';
import { BoltIcon, ScaleIcon, ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Badge, Button, Card, Meter, Notice, ScoreRing, Segmented, SelectField, TextField, EASE, cx } from '../components/ui/primitives';
import { money } from '../lib/format';

const EDUCATION_LEVELS = ["High School", "Bachelor's", "Master's", "PhD", "MBA"];
const GENDERS = ['Male', 'Female', 'Other'];
const JOB_TITLES = [
  'Software Engineer', 'Data Scientist', 'Data Analyst', 'Machine Learning Engineer', 'Business Analyst',
  'Product Manager', 'DevOps Engineer', 'Full Stack Developer', 'Frontend Developer', 'Backend Developer',
  'Mobile Developer', 'Cloud Engineer', 'Database Administrator', 'System Administrator', 'Network Engineer',
  'Security Engineer', 'QA Engineer', 'UI/UX Designer', 'Project Manager', 'Technical Lead', 'Senior Manager',
  'Director', 'Marketing Manager', 'Marketing Coordinator', 'Financial Manager', 'Operations Manager', 'Others',
];

const FACTOR_LABELS = {
  Experience_Age_Ratio: 'Experience vs. age',
  Job_Category: 'Job category',
  'Job Title': 'Job title',
  'Years of Experience': 'Years of experience',
  'Education Level': 'Education level',
  Experience_Level: 'Experience level',
  Age_Group: 'Age group',
  Is_Senior: 'Seniority',
  Age: 'Age',
  Gender: 'Gender',
};

const EMPTY_FORM = { age: '', gender: '', education_level: '', job_title: '', years_of_experience: '' };

/** Big number that counts up to `value` whenever it changes. */
function CountingMoney({ value, className }) {
  const mv = useMotionValue(0);
  const text = useTransform(mv, (v) => money(v));
  React.useEffect(() => {
    const controls = animate(mv, value, { duration: 1.2, ease: EASE });
    return () => controls.stop();
  }, [value, mv]);
  return <motion.span className={cx('tabular-nums', className)}>{text}</motion.span>;
}

/** Where `value` sits between min and max, drawn as a track with a marker. */
function RangeTrack({ min, max, value, toneName = 'green' }) {
  const lo = min * 0.9;
  const hi = max * 1.1;
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
        <span>{money(min)}</span>
        <span>{money(max)}</span>
      </div>
    </div>
  );
}

function SalaryForm({ form, setForm, onSubmit, loading, mode }) {
  const set = (name) => (e) => setForm((prev) => ({ ...prev, [name]: e.target.value }));
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-2">
      <SelectField label="Job title" value={form.job_title} onChange={set('job_title')} options={JOB_TITLES} placeholder="Select job title" required className="sm:col-span-2" />
      <TextField label="Age" type="number" min="18" max="70" placeholder="Enter your age" value={form.age} onChange={set('age')} required />
      <TextField label="Years of experience" type="number" min="0" max="50" placeholder="Years" value={form.years_of_experience} onChange={set('years_of_experience')} required />
      <SelectField label="Education" value={form.education_level} onChange={set('education_level')} options={EDUCATION_LEVELS} placeholder="Select education level" required />
      <SelectField label="Gender" value={form.gender} onChange={set('gender')} options={GENDERS} placeholder="Select gender" required />
      <div className="sm:col-span-2">
        <Button type="submit" size="lg" loading={loading} className="w-full">
          {loading ? (mode === 'compare' ? 'Analyzing...' : 'Predicting...') : (mode === 'compare' ? 'Compare both models' : 'Predict salary')}
        </Button>
      </div>
    </form>
  );
}

function BasicResult({ result }) {
  return (
    <Card className="relative overflow-hidden !p-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(52,199,89,0.25),transparent_70%)]" />
      <Badge toneName="green">{result.model_type || 'Basic Random Forest'}</Badge>
      <p className="mt-6 text-[15px] text-graphite">Estimated salary</p>
      <CountingMoney value={result.predicted_salary} className="mt-1 block font-display text-[56px] font-semibold leading-none tracking-tighter2 text-ink md:text-[72px]" />
      <div className="mt-10">
        <p className="mb-3 text-[13px] font-medium text-graphite">Likely range</p>
        <RangeTrack min={result.salary_range.min} max={result.salary_range.max} value={result.predicted_salary} />
      </div>
    </Card>
  );
}

function CompareResult({ results }) {
  const { basic, advanced, comparison } = results;
  const top = Math.max(basic?.predicted_salary || 0, advanced?.predicted_salary || 0) || 1;
  const higher = comparison?.higher_prediction;
  return (
    <div className="space-y-5">
      <div className="grid gap-5 md:grid-cols-2">
        {basic && (
          <Card className="!p-7">
            <div className="flex items-center justify-between">
              <Badge toneName="gray">Basic model</Badge>
              {higher === 'basic' && <Badge toneName="orange">Higher</Badge>}
            </div>
            <CountingMoney value={basic.predicted_salary} className="mt-5 block font-display text-[44px] font-semibold leading-none tracking-tight" />
            <p className="mt-2 text-[14px] text-graphite">Range {money(basic.salary_range?.min)} to {money(basic.salary_range?.max)}</p>
            <p className="mt-1 text-[13px] text-silver">Model: {basic.model_type}</p>
            <Meter value={(basic.predicted_salary / top) * 100} toneName="gray" className="mt-6 h-2.5" />
          </Card>
        )}
        {advanced && (
          <Card className="relative overflow-hidden !p-7">
            <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-[radial-gradient(circle,rgba(52,199,89,0.22),transparent_70%)]" />
            <div className="relative flex items-center justify-between">
              <Badge toneName="green">Advanced ensemble</Badge>
              {higher === 'advanced' && <Badge toneName="orange">Higher</Badge>}
            </div>
            <CountingMoney value={advanced.predicted_salary} className="relative mt-5 block font-display text-[44px] font-semibold leading-none tracking-tight" />
            <p className="relative mt-2 text-[14px] text-graphite">Range {money(advanced.salary_range?.min)} to {money(advanced.salary_range?.max)}</p>
            {advanced.confidence_interval && (
              <p className="relative mt-1 text-[13px] text-silver">
                95% CI: {money(advanced.confidence_interval.lower)} to {money(advanced.confidence_interval.upper)}
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
              <ScoreRing value={advanced.prediction_confidence} size={128} toneName={advanced.prediction_confidence >= 80 ? 'green' : 'orange'} label="confidence">
                <span className="font-display text-[28px] font-semibold leading-none tabular-nums">{advanced.prediction_confidence.toFixed(1)}%</span>
              </ScoreRing>
            )}
            <p className="mt-4 text-[13px] text-silver">Model: {advanced.model_version}</p>
          </Card>
          <Card className="!p-7">
            <h3 className="font-display text-[19px] font-semibold tracking-tight">Top influential factors</h3>
            <div className="mt-5 space-y-4">
              {(advanced.top_influential_factors || []).map((factor, i) => (
                <div key={factor.factor}>
                  <div className="mb-1.5 flex justify-between text-[14px]">
                    <span className="text-ink">{FACTOR_LABELS[factor.factor] || factor.factor}</span>
                    <span className="text-graphite tabular-nums">{(factor.importance * 100).toFixed(1)}%</span>
                  </div>
                  <Meter value={factor.importance * 100} toneName={['green', 'teal', 'blue'][i % 3]} delay={i * 0.1} />
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {comparison && (
        <Card className="!p-7">
          <div className="flex items-center gap-2">
            <ArrowsRightLeftIcon className="h-5 w-5 text-orange" aria-hidden="true" />
            <h3 className="font-display text-[19px] font-semibold tracking-tight">Model comparison</h3>
          </div>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl bg-orange-soft p-5">
              <p className="text-[13px] text-orange-ink">Salary difference</p>
              <p className="mt-1 font-display text-[28px] font-semibold tracking-tight">{money(Math.abs(comparison.difference))}</p>
            </div>
            <div className="rounded-2xl bg-orange-soft p-5">
              <p className="text-[13px] text-orange-ink">Percentage difference</p>
              <p className="mt-1 font-display text-[28px] font-semibold tracking-tight">{Math.abs(comparison.difference_percentage).toFixed(1)}%</p>
            </div>
            <div className="rounded-2xl bg-mist p-5">
              <p className="text-[13px] text-graphite">Higher prediction</p>
              <p className="mt-1 font-display text-[28px] font-semibold capitalize tracking-tight">
                {higher === 'advanced' ? 'Advanced' : higher === 'basic' ? 'Basic' : 'Equal'}
              </p>
            </div>
          </div>
          <p className="mt-5 text-[15px] text-graphite">
            {comparison.difference > 0
              ? 'Advanced model predicts higher salary.'
              : comparison.difference < 0
                ? 'Basic model predicts higher salary.'
                : 'Both models predict the same salary.'}
          </p>
        </Card>
      )}
    </div>
  );
}

/** Salary prediction with a quick estimate (basic model) or a side-by-side model comparison. */
function SalaryPredictor() {
  const navigate = useNavigate();
  const location = useLocation();
  const mode = location.pathname === '/advanced-salary-predictor' ? 'compare' : 'quick';
  const [form, setForm] = useState(EMPTY_FORM);
  const [result, setResult] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const changeMode = (next) => {
    setError('');
    navigate(next === 'compare' ? '/advanced-salary-predictor' : '/salary-predictor', { replace: true });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const requestData = {
      age: parseInt(form.age, 10),
      gender: form.gender,
      education_level: form.education_level,
      job_title: form.job_title,
      years_of_experience: parseInt(form.years_of_experience, 10),
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
      setError(errorMessage(err, mode === 'compare' ? 'Comparison failed' : 'Prediction failed'));
    } finally {
      setLoading(false);
    }
  };

  const shown = mode === 'compare' ? comparison : result;

  return (
    <AppShell>
      <PageHeader
        eyebrow="Salary"
        toneName="green"
        title={mode === 'compare' ? 'Two models. One honest range.' : 'Know what you are worth.'}
        subtitle={mode === 'compare'
          ? 'Compare a Random Forest with an ensemble of Random Forest, Gradient Boosting and Ridge, with confidence and the factors behind it.'
          : 'Get a salary estimate from your role, experience and education in a few seconds.'}
        actions={(
          <Segmented
            label="Prediction mode"
            value={mode}
            onChange={changeMode}
            options={[{ value: 'quick', label: 'Quick estimate' }, { value: 'compare', label: 'Compare models' }]}
          />
        )}
      />

      <div className="grid items-start gap-6 lg:grid-cols-[400px_1fr]">
        <Card className="lg:sticky lg:top-24">
          <div className="mb-6 flex items-center gap-2">
            {mode === 'compare' ? <ScaleIcon className="h-5 w-5 text-green" /> : <BoltIcon className="h-5 w-5 text-green" />}
            <h2 className="font-display text-[19px] font-semibold tracking-tight">Your details</h2>
          </div>
          <SalaryForm form={form} setForm={setForm} onSubmit={handleSubmit} loading={loading} mode={mode} />
          {error && <Notice className="mt-4">{error}</Notice>}
        </Card>

        <AnimatePresence mode="wait">
          <motion.div
            key={`${mode}-${shown ? 'result' : 'empty'}`}
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: EASE }}
          >
            {shown ? (
              mode === 'compare' ? <CompareResult results={comparison} /> : <BasicResult result={result} />
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
                  Fill in your details and {mode === 'compare' ? 'compare both models' : 'predict your salary'}.
                </p>
                {mode === 'quick' && (
                  <button type="button" onClick={() => changeMode('compare')} className="mt-4 text-[15px] text-action-link hover:underline">
                    Try the advanced predictor
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
