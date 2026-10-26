import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { CountUp, Reveal, money } from './motion';

// Real outputs for: Data Scientist, 5 years, Bengaluru, Python + SQL + Machine Learning
const BASIC = 1823000;
const ADVANCED = 1586000;
const RANGE = [650000, 2097000];
const SCALE_MAX = 2200000;
// Measured on companies the model never saw in training
const MEDIAN_ERROR = 22.5;
const TRAINED_ON = 31566;

function ModelBar({ label, detail, value, tone, delay }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  // The bar fills as it comes up the screen and empties again when you scroll back up
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.95', 'start 0.6'] });
  const scaleX = useTransform(scrollYProgress, [Math.min(0.4, delay * 2), 1], [0, 1]);
  return (
    <div ref={ref}>
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[17px] font-semibold text-ink">{label}</p>
          <p className="text-[14px] text-graphite">{detail}</p>
        </div>
        {/* Never split "₹15.9 LPA" over two lines */}
        <p className="shrink-0 whitespace-nowrap font-display text-[26px] font-semibold tracking-tight text-ink md:text-[32px]">
          <CountUp value={value} format={money} />
        </p>
      </div>
      <div className="mt-4 h-[10px] overflow-hidden rounded-full bg-[#e8e8ed]">
        <motion.div
          className={`h-full origin-left rounded-full ${tone}`}
          style={{ width: `${(value / SCALE_MAX) * 100}%`, scaleX: reduce ? 1 : scaleX }}
        />
      </div>
    </div>
  );
}

function SalarySection() {
  const difference = ((ADVANCED - BASIC) / BASIC) * 100;

  return (
    // On phones and tablets the resume card that follows sits as close to these cards as they sit
    // to each other (20px), so the three read as one stack
    <section id="salary" className="scroll-mt-12 px-5 pb-5 pt-12 md:pt-[14vh] lg:pb-[14vh]" aria-labelledby="salary-title">
      <div className="mx-auto max-w-[984px]">
        <Reveal>
          <p className="text-[17px] font-semibold text-green-ink md:text-[21px]">Salary</p>
          <h2 id="salary-title" className="mt-2 max-w-[16ch] font-display text-[40px] font-semibold leading-[1.08] tracking-tighter2 text-ink md:text-[64px]">
            Two models. One honest range.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-[620px] text-[19px] leading-[1.5] text-graphite md:text-[21px]">
            Both models learn from salaries disclosed in Indian job postings: your title, experience, city
            and skills. The quick one shows exactly what moved the number. The advanced one adds
            gradient-boosted trees and a range drawn from similar postings.
            <span className="text-ink"> You see both, side by side, in lakhs per annum.</span>
          </p>
        </Reveal>

        <div className="mt-16 grid gap-5 md:grid-cols-[1.25fr_1fr]">
          <Reveal className="rounded-[28px] bg-mist p-8 md:p-12">
            <p className="text-[14px] font-medium uppercase tracking-[0.08em] text-silver">Example estimate</p>
            <p className="mt-1 text-[17px] text-graphite">Data Scientist, 5 years, Bengaluru</p>
            <div className="mt-10 space-y-9">
              <ModelBar label="Quick estimate" detail="Ridge regression" value={BASIC} tone="bg-[#a1a1a6]" delay={0} />
              <ModelBar label="Advanced estimate" detail="Ridge + gradient-boosted trees" value={ADVANCED} tone="bg-[linear-gradient(90deg,#30b0c7,#34c759)]" delay={0.15} />
            </div>
            <p className="mt-10 border-t border-hairline pt-6 text-[17px] leading-[1.5] text-graphite">
              Here the models disagree by <span className="font-semibold text-orange-ink">{Math.abs(difference).toFixed(1)}%</span>.
              That gap is worth knowing before you negotiate.
            </p>
          </Reveal>

          <Reveal className="relative flex flex-col justify-between overflow-hidden rounded-[28px] bg-green-soft p-8 md:p-12" delay={0.1}>
            <div>
              <p className="text-[14px] font-medium uppercase tracking-[0.08em] text-green-ink">Likely range</p>
              <p className="mt-4 font-display text-[40px] font-semibold leading-none tracking-tight text-ink md:text-[48px]">
                <CountUp value={RANGE[0]} format={money} />
              </p>
              <p className="my-2 text-[17px] text-silver">to</p>
              <p className="font-display text-[40px] font-semibold leading-none tracking-tight text-ink md:text-[48px]">
                <CountUp value={RANGE[1]} format={money} />
              </p>
            </div>
            <div className="mt-12 flex items-end justify-between">
              <div>
                <p className="text-[14px] text-graphite">Typical error</p>
                <p className="font-display text-[32px] font-semibold tracking-tight text-ink">
                  <span className="text-green-ink"><CountUp value={MEDIAN_ERROR} format={(n) => `${n.toFixed(1)}%`} /></span>
                </p>
                <p className="text-[12px] text-silver">on companies it never saw</p>
              </div>
              <div className="text-right">
                <p className="text-[14px] text-graphite">Trained on</p>
                <p className="font-display text-[32px] font-semibold tracking-tight text-ink">
                  <CountUp value={TRAINED_ON} />
                </p>
                <p className="text-[12px] text-silver">Indian salaries, 2025</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default SalarySection;
