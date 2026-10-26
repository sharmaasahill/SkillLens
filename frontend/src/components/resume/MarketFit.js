import React, { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api';
import { Button, Notice, Skeleton, cx } from '../ui/primitives';
import { Combobox } from '../ui/Select';
import { CountNumber, Line, Rise, Section, ratioColor } from '../ui/studio';

/**
 * Market fit: for a target role, which skills 2025 Indian postings ask for (share of hiring companies)
 * and which of them this resume shows. The first check uses the profile role or the resume headline.
 */
function MarketFit({ resumeId, index = '04' }) {
  const [roles, setRoles] = useState([]);
  const [role, setRole] = useState('');
  const [fit, setFit] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const check = async (target) => {
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post(`/resumes/${resumeId}/market-fit`, { role: target || null });
      setFit(data);
      if (data.role) setRole(data.role);
    } catch (err) {
      setError(errorMessage(err, 'Could not check market fit'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!resumeId) return;
    api.get('/market/roles').then(({ data }) => setRoles(data.roles || [])).catch(() => {});
    check('');
  }, [resumeId]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!resumeId) return null;
  const skills = fit?.skills || [];
  const missing = skills.filter((s) => !s.have);

  return (
    <Section
      index={index}
      title="Market fit"
      note="What Indian employers ask for in this role, from 2025 Naukri.com postings. It shows demand, not open jobs."
    >
      <form onSubmit={(e) => { e.preventDefault(); if (role.trim().length >= 2) check(role.trim()); }}>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-4">
          <p className="font-display text-[24px] font-semibold leading-[1.6] tracking-tight text-black/35 md:text-[30px]">
            Compare with postings for{' '}
            <Combobox variant="inline" value={role} onChange={(e) => setRole(e.target.value)} suggestions={roles} placeholder="a job title" maxLength={100} />
          </p>
          <Button type="submit" variant="dark" loading={loading} disabled={role.trim().length < 2}>Check</Button>
        </div>
      </form>

      {error && <Notice className="mt-6">{error}</Notice>}

      {loading && !fit ? (
        <div className="mt-10 space-y-4"><Skeleton className="h-16 w-1/3" /><Skeleton className="h-5" /><Skeleton className="h-5 w-5/6" /></div>
      ) : fit && skills.length === 0 ? (
        <p className="mt-10 max-w-[60ch] text-[16px] leading-[1.6] text-graphite">
          {fit.role
            ? <>Not enough postings for &ldquo;{fit.role}&rdquo; to say what employers want. Try a broader title, such as Backend Developer or Data Analyst.</>
            : 'Type the job title you are aiming for to see what employers ask for.'}
        </p>
      ) : fit ? (
        <Rise className={cx('mt-10 transition-opacity', loading && 'opacity-50')}>
          <div className="grid gap-10 md:grid-cols-[auto_1fr] md:gap-16">
            <div>
              <p className="font-display text-[72px] font-semibold leading-none tracking-tighter2" style={{ color: ratioColor((fit.coverage || 0) / 100) }}>
                <CountNumber value={fit.coverage || 0} /><span className="text-[32px] text-silver">%</span>
              </p>
              <p className="mt-3 max-w-[24ch] text-[15px] leading-[1.5] text-graphite">
                of what <span className="font-semibold text-ink tabular-nums">{fit.companies.toLocaleString('en-IN')}</span> companies ask for, your resume shows.
              </p>
              {fit.typical_experience !== null && (
                <p className="mt-4 text-[14px] text-graphite">Typical ask: <span className="font-medium text-ink">{fit.typical_experience ? `${fit.typical_experience}+ years` : 'freshers welcome'}</span></p>
              )}
              {missing.length > 0 && (
                <p className="mt-4 max-w-[28ch] text-[14px] leading-[1.5] text-graphite">
                  Biggest gap: <span className="font-medium text-orange-ink">{missing[0].skill}</span>, asked for by {Math.round(missing[0].share)}% of them.
                </p>
              )}
            </div>
            <ul className="space-y-4">
              {skills.map((s, i) => (
                <li key={s.skill} className="grid grid-cols-[minmax(0,1fr)_56px_92px] items-center gap-4">
                  <div className="min-w-0">
                    <p className={cx('truncate text-[15px]', s.have ? 'text-ink' : 'font-medium text-orange-ink')}>{s.skill}</p>
                    <Line value={s.share} color={s.have ? '#34c759' : '#ff9500'} className="mt-1.5" delay={i * 0.04} />
                  </div>
                  <span className="text-right text-[13px] tabular-nums text-graphite">{Math.round(s.share)}%</span>
                  <span className={cx('text-right text-[13px] font-medium', s.have ? 'text-green-ink' : 'text-orange-ink')}>{s.have ? 'You have it' : 'Not shown'}</span>
                </li>
              ))}
            </ul>
          </div>
          <p className="mt-10 border-t border-black/[0.07] pt-6 text-[13px] leading-[1.6] text-silver">
            {fit.guessed && 'Role taken from your profile or resume headline; change it above. '}
            Matched {fit.postings.toLocaleString('en-IN')} postings on &ldquo;{fit.matched_on}&rdquo;, counting each company once.
            Percentages are the share of hiring companies that list the skill. Source: {fit.source?.name}, {fit.source?.collected}, {fit.source?.licence}.
            &ldquo;Not shown&rdquo; may still be true for you: add it only if you have used it.
          </p>
        </Rise>
      ) : null}
    </Section>
  );
}

export default MarketFit;
