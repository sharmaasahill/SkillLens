import React, { useEffect, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import api, { errorMessage } from '../../api';
import { Notice, Skeleton, cx } from '../ui/primitives';
import { Select } from '../ui/Select';
import { EASE, Section } from '../ui/studio';
import { lpa } from '../../lib/format';

const MAX_CITIES = 12;

/**
 * The same role, experience and skills in India's biggest job markets, best paid first.
 * For example: Data Analyst, 3 years - Bengaluru ₹7.6 LPA, Pune ₹6.4 LPA, Jaipur ₹4.9 LPA.
 */
function CityCompare({ request, allCities = [], index = '04' }) {
  const reduce = useReducedMotion();
  const [rows, setRows] = useState(null);
  const [picked, setPicked] = useState([]); // empty: the server's default list
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setError('');
    api.post('/salary/cities', { ...request, cities: picked })
      .then(({ data }) => { if (alive) setRows(data.cities); })
      .catch((err) => { if (alive) setError(errorMessage(err, 'Could not compare cities')); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [request, picked]);

  const shown = rows || [];
  const max = Math.max(1, ...shown.map((r) => r.salary_range.max));
  const yours = shown.find((r) => r.city === request.city);
  const addable = allCities.filter((c) => c !== 'Remote' && !shown.some((r) => r.city === c));
  const add = (city) => {
    if (!city) return;
    setPicked([...(picked.length ? picked : shown.map((r) => r.city)), city].slice(-MAX_CITIES));
  };

  return (
    <Section
      index={index}
      title="Compare cities"
      note={`${request.job_title}, ${request.years_of_experience} years${request.skills?.length ? ', same skills' : ''}, in India's biggest job markets.`}
    >
      {error && <Notice className="mb-6">{error}</Notice>}
      {loading && !rows ? (
        <div className="space-y-4">{[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-9" />)}</div>
      ) : (
        <div className={cx('transition-opacity', loading && 'opacity-60')}>
          <ul className="space-y-4">
            {shown.map((row, i) => {
              const mine = row.city === request.city;
              const diff = yours && !mine ? row.predicted_salary - yours.predicted_salary : null;
              return (
                <li key={row.city} className="grid grid-cols-[96px_minmax(0,1fr)_auto] items-center gap-4 md:grid-cols-[140px_minmax(0,1fr)_170px]">
                  <span className={cx('truncate text-[15px]', mine ? 'font-semibold text-ink' : 'text-graphite')}>
                    {row.city}{mine && <span className="ml-1.5 text-[12px] font-medium text-green-ink">yours</span>}
                  </span>
                  <div className="relative h-8" aria-hidden="true">
                    <div className="absolute inset-y-[14px] left-0 right-0 rounded-full bg-black/[0.04]" />
                    <div
                      className="absolute inset-y-[10px] rounded-full bg-[#30b0c7]/20"
                      style={{ left: `${(row.salary_range.min / max) * 100}%`, width: `${((row.salary_range.max - row.salary_range.min) / max) * 100}%` }}
                    />
                    <motion.div
                      className="absolute inset-y-[6px] left-0 origin-left rounded-full"
                      style={{ width: `${(row.predicted_salary / max) * 100}%`, background: mine ? 'linear-gradient(90deg,#34c759,#30b0c7)' : i === 0 ? '#34c759' : '#a1a1a6' }}
                      initial={reduce ? false : { scaleX: 0 }} animate={{ scaleX: 1 }}
                      transition={{ duration: 0.8, ease: EASE, delay: i * 0.05 }}
                    />
                  </div>
                  <span className="text-right">
                    <span className="block font-display text-[19px] font-semibold tabular-nums text-ink">{lpa(row.predicted_salary)}</span>
                    <span className={cx('block text-[12px] tabular-nums', diff == null ? 'text-silver' : diff >= 0 ? 'text-green-ink' : 'text-red-ink')}>
                      {diff == null ? `${lpa(row.salary_range.min)} to ${lpa(row.salary_range.max)}` : `${diff >= 0 ? '+' : '−'}${lpa(Math.abs(diff))} vs ${request.city}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-black/[0.07] pt-6 text-[14px] text-graphite">
            <p>The bar is the estimate; the soft band behind it is the likely range. {request.city ? '' : 'Choose a city above to compare against it.'}</p>
            {addable.length > 0 && shown.length < MAX_CITIES && (
              <span className="flex items-center gap-2">
                Add
                <Select variant="inline" value="" onChange={(e) => add(e.target.value)} options={addable} placeholder="a city" />
              </span>
            )}
          </div>
        </div>
      )}
    </Section>
  );
}

export default CityCompare;
