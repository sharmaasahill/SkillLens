import React from 'react';
import { motion, useTransform } from 'framer-motion';

// Real output of both models for this profile (India 2025.10 model)
const PROFILE = { role: 'Data Scientist', years: 5, city: 'Bengaluru' };
const ESTIMATE = 1586000;
const BASIC = 1823000;
const RANGE = [643000, 1883000];
// effect = change vs. an average posting; weight = share of the explanation (bar length)
const FACTORS = [
  { name: 'Job title', effect: 73.6, weight: 44.6 },
  { name: 'Skills', effect: 66.2, weight: 41.0 },
  { name: 'City', effect: 9.7, weight: 7.5 },
];
const lpa = (n) => `₹${(n / 100000).toFixed(1)} LPA`;

// Smooth salary distribution curve for the chart (illustrative shape)
const CURVE = 'M0,58 C14,57 22,52 30,40 C38,26 44,8 52,6 C60,4 66,18 72,30 C80,44 90,54 100,57';
const AREA = `${CURVE} L100,60 L0,60 Z`;
const MARKER_X = 49; // where the estimate sits on the curve

/**
 * The app as it appears on the laptop display. Sized in container query units
 * (cqw) so it scales exactly with the screen. `progress` (0..1) animates the content.
 */
function ScreenUI({ progress }) {
  const salary = useTransform(progress, (p) => lpa(ESTIMATE * Math.min(1, p * 1.15)));
  const curveLength = useTransform(progress, [0, 0.7], [0, 1]);
  // Reveal the chart left to right with a clip, which keeps the hairline stroke crisp
  const curveClip = useTransform(curveLength, (v) => `inset(0 ${(1 - v) * 100}% 0 0)`);
  const markerOpacity = useTransform(progress, [0.55, 0.75], [0, 1]);
  const rangeScale = useTransform(progress, [0.25, 0.9], [0, 1]);
  const factorScale = useTransform(progress, [0.3, 1], [0, 1]);
  const compareOpacity = useTransform(progress, [0.7, 1], [0, 1]);

  return (
    <div className="flex h-full w-full bg-[#fbfbfd] font-text text-ink">
      {/* Sidebar */}
      <aside className="flex w-[19%] flex-col gap-[1.4cqw] border-r border-black/[0.06] bg-[#f5f5f7] px-[1.8cqw] py-[2.2cqw]">
        <div className="flex gap-[0.6cqw] pb-[1cqw]">
          {['#ff5f57', '#febc2e', '#28c840'].map((c) => (
            <span key={c} className="h-[0.9cqw] w-[0.9cqw] rounded-full" style={{ background: c }} />
          ))}
        </div>
        <span className="text-[1.5cqw] font-semibold">SkillLens</span>
        {['Overview', 'Salary', 'Resume', 'Jobs', 'Profile'].map((item) => (
          <span
            key={item}
            className={`rounded-[0.6cqw] px-[0.8cqw] py-[0.45cqw] text-[1.1cqw] ${
              item === 'Salary' ? 'bg-white font-medium text-green-ink shadow-[0_0.1cqw_0.3cqw_rgba(0,0,0,0.08)]' : 'text-graphite'
            }`}
          >
            {item}
          </span>
        ))}
      </aside>

      {/* Main */}
      <main className="flex flex-1 flex-col gap-[1.6cqw] px-[3cqw] py-[2.6cqw]">
        <div className="flex items-baseline justify-between">
          <span className="text-[2.1cqw] font-semibold tracking-tight">Salary estimate</span>
          <span className="text-[1cqw] text-silver">Advanced estimate</span>
        </div>

        <div className="flex gap-[0.8cqw]">
          {[PROFILE.role, `${PROFILE.years} years`, PROFILE.city].map((chip, i) => (
            <span key={chip} className={`rounded-full px-[1cqw] py-[0.35cqw] text-[1cqw] ${['bg-purple-soft text-purple-ink', 'bg-orange-soft text-orange-ink', 'bg-blue-soft text-blue-ink'][i]}`}>
              {chip}
            </span>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-[1.35fr_1fr] gap-[1.6cqw]">
          {/* Estimate with distribution chart */}
          <section className="flex min-h-0 flex-col rounded-[1.2cqw] bg-white p-[2cqw] shadow-[0_0.2cqw_1.2cqw_rgba(0,0,0,0.06)]">
            <span className="text-[1.05cqw] text-graphite">Estimated annual CTC</span>
            <motion.span className="mt-[0.6cqw] font-display text-[5cqw] font-semibold leading-none tracking-tight tabular-nums">
              {salary}
            </motion.span>

            <div className="relative mt-[1.6cqw] min-h-0 flex-1">
              <motion.svg viewBox="0 0 100 60" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" style={{ clipPath: curveClip }}>
                <defs>
                  <linearGradient id="screen-area" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#34c759" stopOpacity="0.22" />
                    <stop offset="100%" stopColor="#30b0c7" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d={AREA} fill="url(#screen-area)" />
                <path d={CURVE} fill="none" stroke="#34c759" strokeWidth="1.6" vectorEffect="non-scaling-stroke" />
                <motion.line
                  x1={MARKER_X} x2={MARKER_X} y1="6" y2="60" stroke="#1d1d1f" strokeWidth="0.6"
                  strokeDasharray="3 3" vectorEffect="non-scaling-stroke" style={{ opacity: markerOpacity }}
                />
              </motion.svg>
              <motion.span
                className="absolute top-0 -translate-x-1/2 rounded-full bg-ink px-[0.8cqw] py-[0.2cqw] text-[0.9cqw] font-medium text-white"
                style={{ left: `${MARKER_X}%`, opacity: markerOpacity }}
              >
                You
              </motion.span>
            </div>

            <div className="mt-[1.4cqw]">
              <div className="relative h-[0.7cqw] overflow-hidden rounded-full bg-[#e8e8ed]">
                <motion.div className="absolute inset-y-0 left-[18%] right-[22%] origin-left rounded-full bg-[linear-gradient(90deg,#30b0c7,#34c759)]" style={{ scaleX: rangeScale }} />
              </div>
              <div className="mt-[0.6cqw] flex justify-between text-[0.95cqw] text-silver tabular-nums">
                <span>{lpa(RANGE[0])}</span>
                <span>Likely range</span>
                <span>{lpa(RANGE[1])}</span>
              </div>
            </div>
          </section>

          {/* Factors and comparison */}
          <section className="flex flex-col rounded-[1.2cqw] bg-white p-[2cqw] shadow-[0_0.2cqw_1.2cqw_rgba(0,0,0,0.06)]">
            <span className="text-[1.05cqw] text-graphite">What moved the number</span>
            <div className="mt-[1.4cqw] flex flex-col gap-[1.3cqw]">
              {FACTORS.map((f, i) => (
                <div key={f.name} className="flex flex-col gap-[0.45cqw]">
                  <div className="flex justify-between text-[1.05cqw]">
                    <span>{f.name}</span>
                    <span className="text-graphite tabular-nums">+{Math.round(f.effect)}%</span>
                  </div>
                  <div className="h-[0.5cqw] rounded-full bg-[#e8e8ed]">
                    <motion.div className={`h-full origin-left rounded-full ${['bg-green', 'bg-teal', 'bg-blue'][i]}`} style={{ width: `${Math.max(f.weight, 4)}%`, scaleX: factorScale }} />
                  </div>
                </div>
              ))}
            </div>

            <motion.div className="mt-auto border-t border-black/[0.06] pt-[1.4cqw]" style={{ opacity: compareOpacity }}>
              <div className="flex justify-between text-[1.05cqw]">
                <span className="text-graphite">Quick estimate</span>
                <span className="tabular-nums">{lpa(BASIC)}</span>
              </div>
              <div className="mt-[0.6cqw] flex justify-between text-[1.05cqw]">
                <span className="text-graphite">Difference</span>
                <span className="font-medium text-orange-ink tabular-nums">{(((ESTIMATE - BASIC) / BASIC) * 100).toFixed(1)}%</span>
              </div>
            </motion.div>
          </section>
        </div>
      </main>
    </div>
  );
}

export default ScreenUI;
