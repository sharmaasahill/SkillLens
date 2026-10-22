import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { EASE, Reveal } from './motion';

const FILTERS = ['Data Analyst', 'Pune', '3 to 5 years', 'Python', 'Score 70+', 'Has resume'];
const SCORE_BUCKETS = [
  { label: '0-40', value: 18, color: '#ff3b30' },
  { label: '41-60', value: 46, color: '#ff9500' },
  { label: '61-80', value: 100, color: '#ffcc00' },
  { label: '81-100', value: 64, color: '#34c759' },
];
const FILTER_TONES = ['bg-teal-soft text-teal-ink', 'bg-blue-soft text-blue-ink', 'bg-purple-soft text-purple-ink', 'bg-green-soft text-green-ink', 'bg-orange-soft text-orange-ink', 'bg-pink-soft text-pink-ink'];

function Tile({ children, className = '', delay = 0 }) {
  return (
    <Reveal delay={delay} amount={0.3} className={`overflow-hidden rounded-[28px] bg-white p-8 md:p-10 ${className}`}>
      {children}
    </Reveal>
  );
}

function TileTitle({ eyebrow, title }) {
  return (
    <>
      <p className="text-[14px] font-semibold text-graphite">{eyebrow}</p>
      <h3 className="mt-2 font-display text-[28px] font-semibold leading-[1.12] tracking-tight text-ink md:text-[32px]">{title}</h3>
    </>
  );
}

function HRSection() {
  const reduce = useReducedMotion();
  const pop = (i) => ({
    initial: reduce ? false : { opacity: 0, scale: 0.85, y: 8 },
    whileInView: { opacity: 1, scale: 1, y: 0 },
    viewport: { once: true, amount: 0.6 },
    transition: { duration: 0.6, ease: EASE, delay: 0.2 + i * 0.08 },
  });

  return (
    <section id="hr" className="scroll-mt-12 bg-mist px-5 py-[14vh]" aria-labelledby="hr-title">
      <div className="mx-auto max-w-[984px]">
        <Reveal className="text-center">
          <p className="text-[17px] font-semibold text-teal-ink md:text-[21px]">For HR teams</p>
          <h2 id="hr-title" className="mx-auto mt-2 max-w-[18ch] font-display text-[40px] font-semibold leading-[1.08] tracking-tighter2 text-ink md:text-[64px]">
            Find the right candidate in seconds.
          </h2>
        </Reveal>

        <div className="mt-16 grid gap-5 md:grid-cols-6">
          <Tile className="md:col-span-4">
            <TileTitle eyebrow="Search" title="Filter by role, place, experience, skills and score." />
            <div className="mt-10 flex flex-wrap gap-3">
              {FILTERS.map((f, i) => (
                <motion.span key={f} {...pop(i)} className={`rounded-full px-4 py-2 text-[15px] ${FILTER_TONES[i % FILTER_TONES.length]}`}>
                  {f}
                </motion.span>
              ))}
            </div>
          </Tile>

          <Tile className="flex flex-col justify-between md:col-span-2" delay={0.08}>
            <TileTitle eyebrow="Speed" title="Same speed at ten candidates or ten thousand." />
            <p className="mt-6 text-[15px] leading-[1.5] text-graphite">
              Search, sorting and pagination run in the database, in a fixed number of queries.
            </p>
          </Tile>

          <Tile className="md:col-span-3" delay={0.04}>
            <TileTitle eyebrow="Analytics" title="See the whole pool at a glance." />
            <div className="mt-10 flex h-[160px] items-end gap-4" aria-label="Sample score distribution">
              {SCORE_BUCKETS.map((b, i) => (
                <div key={b.label} className="flex h-full flex-1 flex-col justify-end gap-2">
                  <motion.div
                    className="w-full origin-bottom rounded-[10px]"
                    style={{ height: `${b.value}%`, background: b.color }}
                    initial={reduce ? false : { scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true, amount: 0.8 }}
                    transition={{ duration: 1.1, ease: EASE, delay: 0.15 + i * 0.1 }}
                  />
                  <span className="text-center text-[12px] text-silver">{b.label}</span>
                </div>
              ))}
            </div>
          </Tile>

          <Tile className="flex flex-col justify-between md:col-span-3" delay={0.12}>
            <TileTitle eyebrow="Profiles" title="Every resume, history and skill in one place." />
            <div className="mt-10 space-y-3">
              {[['Resume history', 'Scores over time'], ['Profile changes', 'Last ten edits'], ['Export', 'CSV in one click']].map(([a, b], i) => (
                <motion.div
                  key={a}
                  className="flex items-center justify-between rounded-2xl bg-mist px-5 py-4"
                  initial={reduce ? false : { opacity: 0, x: -16 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true, amount: 0.8 }}
                  transition={{ duration: 0.7, ease: EASE, delay: 0.15 + i * 0.1 }}
                >
                  <span className="text-[17px] text-ink">{a}</span>
                  <span className="text-[14px] text-graphite">{b}</span>
                </motion.div>
              ))}
            </div>
          </Tile>
        </div>
      </div>
    </section>
  );
}

export default HRSection;
