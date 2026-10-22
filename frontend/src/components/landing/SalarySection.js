import React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { CountUp, EASE, Reveal, money } from './motion';

// Real outputs for: Data Scientist, 29, Master's, 5 years
const BASIC = 137546;
const ADVANCED = 110354;
const RANGE = [104836, 115872];
const SCALE_MAX = 150000;

function ModelBar({ label, detail, value, tone, delay }) {
  const reduce = useReducedMotion();
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <p className="text-[17px] font-semibold text-ink">{label}</p>
          <p className="text-[14px] text-graphite">{detail}</p>
        </div>
        <p className="font-display text-[28px] font-semibold tracking-tight text-ink md:text-[32px]">
          <CountUp value={value} format={money} />
        </p>
      </div>
      <div className="mt-4 h-[10px] overflow-hidden rounded-full bg-[#e8e8ed]">
        <motion.div
          className={`h-full origin-left rounded-full ${tone}`}
          style={{ width: `${(value / SCALE_MAX) * 100}%` }}
          initial={reduce ? false : { scaleX: 0 }}
          whileInView={{ scaleX: 1 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 1.4, ease: EASE, delay }}
        />
      </div>
    </div>
  );
}

function SalarySection() {
  const difference = ((ADVANCED - BASIC) / BASIC) * 100;

  return (
    <section id="salary" className="scroll-mt-12 px-6 py-[14vh]" aria-labelledby="salary-title">
      <div className="mx-auto max-w-[980px]">
        <Reveal>
          <p className="text-[17px] font-semibold text-green-ink md:text-[21px]">Salary</p>
          <h2 id="salary-title" className="mt-2 max-w-[16ch] font-display text-[40px] font-semibold leading-[1.08] tracking-tighter2 text-ink md:text-[64px]">
            Two models. One honest range.
          </h2>
        </Reveal>
        <Reveal delay={0.1}>
          <p className="mt-6 max-w-[620px] text-[19px] leading-[1.5] text-graphite md:text-[21px]">
            A Random Forest gives you a quick estimate. An ensemble of Random Forest, Gradient Boosting
            and Ridge regression adds a range, a confidence score and the factors behind it.
            <span className="text-ink"> You see both, side by side.</span>
          </p>
        </Reveal>

        <div className="mt-16 grid gap-5 md:grid-cols-[1.25fr_1fr]">
          <Reveal className="rounded-[28px] bg-mist p-8 md:p-12" amount={0.3}>
            <p className="text-[14px] font-medium uppercase tracking-[0.08em] text-silver">Example estimate</p>
            <p className="mt-1 text-[17px] text-graphite">Data Scientist, 5 years, Master's degree</p>
            <div className="mt-10 space-y-9">
              <ModelBar label="Basic model" detail="Random Forest" value={BASIC} tone="bg-[#a1a1a6]" delay={0} />
              <ModelBar label="Advanced model" detail="Weighted ensemble of three" value={ADVANCED} tone="bg-[linear-gradient(90deg,#30b0c7,#34c759)]" delay={0.15} />
            </div>
            <p className="mt-10 border-t border-hairline pt-6 text-[17px] leading-[1.5] text-graphite">
              Here the models disagree by <span className="font-semibold text-orange-ink">{Math.abs(difference).toFixed(1)}%</span>.
              That gap is worth knowing before you negotiate.
            </p>
          </Reveal>

          <Reveal className="relative flex flex-col justify-between overflow-hidden rounded-[28px] bg-green-soft p-8 md:p-12" delay={0.1} amount={0.3}>
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
                <p className="text-[14px] text-graphite">Model confidence</p>
                <p className="font-display text-[32px] font-semibold tracking-tight text-ink">
                  <span className="text-green-ink"><CountUp value={97.9} format={(n) => `${n.toFixed(1)}%`} /></span>
                </p>
              </div>
              <div className="text-right">
                <p className="text-[14px] text-graphite">Trained on</p>
                <p className="font-display text-[32px] font-semibold tracking-tight text-ink">
                  <CountUp value={6704} />
                </p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}

export default SalarySection;
