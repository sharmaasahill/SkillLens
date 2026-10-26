import React, { useRef } from 'react';
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Reveal, useWideScreen } from './motion';

const SCORE = 82;
const RING = 2 * Math.PI * 52;

// A stylised resume. Words in `skill` get picked out as the scanner passes.
const LINES = [
  { w: '46%', heading: true },
  { w: '30%', muted: true },
  { gap: true },
  { text: 'Experience', heading: true },
  { text: 'Built churn models in', skill: 'Python', after: 'and shipped them to production.' },
  { text: 'Cut report time 60% with', skill: 'SQL', after: 'pipelines on AWS.' },
  { text: 'Led a team of four analysts across two product lines.' },
  { gap: true },
  { text: 'Skills', heading: true },
  { text: 'Machine Learning, Pandas, React, Tableau', skillLine: true },
  { gap: true },
  { text: 'Education', heading: true },
  { text: "Master's in Data Science" },
];

// `at` is how far through the results (0 to 1) each check appears
const CHECKS = [
  { label: 'Contact details found', at: 0.2 },
  { label: 'Experience, Education and Skills sections found', at: 0.37 },
  { label: '14 strong action verbs', at: 0.54 },
  { label: '3 weak phrases worth rewording', at: 0.71, warn: true },
  { label: 'No tables or headers that trip up ATS parsers', at: 0.88 },
];

function Check({ item, progress }) {
  const opacity = useTransform(progress, [item.at - 0.1, item.at], [0, 1]);
  const x = useTransform(progress, [item.at - 0.1, item.at], [12, 0]);
  return (
    <motion.li className="flex items-start gap-3 text-[15px] text-ink md:text-[17px]" style={{ opacity, x }}>
      <span
        className={`mt-[7px] h-2 w-2 shrink-0 rounded-full md:mt-[9px] ${item.warn ? 'bg-orange' : 'bg-green'}`}
        aria-hidden="true"
      />
      {item.label}
    </motion.li>
  );
}

/** One resume line. `scan` is how far the scanner has read down the page (0 to 1). */
function ResumeLine({ line, index, scan }) {
  const at = 0.06 + (index / LINES.length) * 0.86;
  const lit = useTransform(scan, [at - 0.04, at], [0, 1]);
  const color = useTransform(lit, [0, 1], ['rgba(0,113,227,0)', 'rgba(0,113,227,0.12)']);
  const ink = useTransform(lit, [0, 1], ['#6e6e73', '#0066cc']);

  if (line.gap) return <div className="h-3" />;
  if (!line.text) {
    return <div className={`h-[10px] rounded-full ${line.muted ? 'bg-[#e8e8ed]' : 'bg-ink/80'}`} style={{ width: line.w }} />;
  }
  if (line.heading) return <p className="pt-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink">{line.text}</p>;
  if (line.skillLine) {
    return (
      <motion.p className="rounded px-1 -mx-1 text-[13px] font-medium" style={{ backgroundColor: color, color: ink }}>
        {line.text}
      </motion.p>
    );
  }
  return (
    <p className="text-[13px] leading-[1.55] text-graphite">
      {line.text}{' '}
      {line.skill && (
        <motion.span className="rounded px-1 font-medium" style={{ backgroundColor: color, color: ink }}>
          {line.skill}
        </motion.span>
      )}{' '}
      {line.after}
    </p>
  );
}

/**
 * A scanner reads down a resume while the ATS score fills and the checks tick in. Everything
 * follows the scroll: it moves while you scroll, stops when you stop, and runs backwards on the way up.
 *
 * Laptops and up: a pinned full-screen scene that stays put while you scroll through it.
 * Phones and tablets: the scene is taller than the screen, so it stays in the page. The scan line
 * holds still at the same height on screen while the resume slides up under it, like a scanner,
 * and the score and checks fill in as they come up.
 */
function ResumeSection() {
  const sectionRef = useRef(null);
  const paperRef = useRef(null);
  const resultsRef = useRef(null);
  const reduce = useReducedMotion();
  const pinned = useWideScreen() && !reduce;

  // Pinned: the whole section's scroll drives the scene
  const { scrollYProgress: sceneProgress } = useScroll({ target: sectionRef, offset: ['start start', 'end end'] });
  const pinnedScan = useTransform(sceneProgress, [0.1, 0.75], [0, 1]);
  const pinnedResults = useTransform(sceneProgress, [0.15, 0.85], [0, 1]);
  // In the page: the resume is read as it passes 60% of the way down the screen...
  const { scrollYProgress: paperProgress } = useScroll({ target: paperRef, offset: ['start 0.6', 'end 0.6'] });
  // ...and the results fill in as they come up from the bottom of the screen
  const { scrollYProgress: resultsProgress } = useScroll({ target: resultsRef, offset: ['start 0.95', 'end 0.65'] });

  const still = useMotionValue(1);
  const scan = reduce ? still : pinned ? pinnedScan : paperProgress;
  const results = reduce ? still : pinned ? pinnedResults : resultsProgress;

  const scanTop = useTransform(scan, [0, 1], ['0%', '100%']);
  const scanOpacity = useTransform(scan, [0, 0.04, 0.96, 1], [0, 1, 1, 0]);
  const dash = useTransform(results, [0, 0.85], [RING, RING * (1 - SCORE / 100)]);
  const scoreText = useTransform(results, [0, 0.85], [0, SCORE], { clamp: true });
  const scoreRounded = useTransform(scoreText, (v) => Math.round(v));

  return (
    <section
      id="resume"
      ref={sectionRef}
      // In the page on phones and tablets: no space above, so the resume card sits 20px under the salary cards
      className={`scroll-mt-12 ${pinned ? 'h-[260vh]' : 'pb-20 lg:pb-[14vh]'}`}
      aria-labelledby="resume-title"
    >
      <div className={`${pinned ? 'sticky top-0 flex h-screen items-center' : ''} px-5`}>
        <div className="mx-auto grid w-full max-w-[984px] items-center gap-12 lg:grid-cols-2 lg:gap-20">
          {/* Resume paper */}
          <div className="relative mx-auto w-full max-w-[420px] lg:mx-0" aria-hidden="true">
            <div ref={paperRef} className="relative overflow-hidden rounded-[20px] bg-white p-7 shadow-[0_2px_4px_rgba(0,0,0,0.04),0_24px_60px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04] md:p-8">
              <div className="space-y-2.5">
                {LINES.map((line, i) => (
                  <ResumeLine key={i} line={line} index={i} scan={scan} />
                ))}
              </div>
              <motion.div className="pointer-events-none absolute inset-x-0 h-24 -translate-y-1/2" style={{ top: scanTop, opacity: scanOpacity }}>
                <div className="h-full bg-[linear-gradient(180deg,rgba(0,113,227,0)_0%,rgba(0,113,227,0.08)_50%,rgba(0,113,227,0)_100%)]" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-action/60" />
              </motion.div>
            </div>
            <p className="mt-4 text-center text-[12px] text-silver">Sample resume and analysis</p>
          </div>

          {/* Score and checks, lined up with the resume card's edges on phones and tablets */}
          <div className="mx-auto w-full max-w-[420px] lg:mx-0 lg:max-w-none">
            <Reveal>
              <p className="text-[17px] font-semibold text-blue-ink md:text-[21px]">Resume</p>
              <h2 id="resume-title" className="mt-2 font-display text-[36px] font-semibold leading-[1.08] tracking-tighter2 text-ink md:text-[48px] lg:text-[56px]">
                Read like a recruiter. Scored like a machine.
              </h2>
            </Reveal>

            <div ref={resultsRef}>
              <div className="mt-8 flex items-center gap-5 md:gap-6">
                <div className="relative h-[104px] w-[104px] shrink-0 md:h-[120px] md:w-[120px]">
                  <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90" aria-hidden="true">
                    <circle cx="60" cy="60" r="52" fill="none" stroke="#e8e8ed" strokeWidth="10" />
                    <motion.circle
                      cx="60" cy="60" r="52" fill="none" stroke="#0071e3" strokeWidth="10" strokeLinecap="round"
                      strokeDasharray={RING} style={{ strokeDashoffset: dash }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span className="font-display text-[36px] font-semibold leading-none tracking-tight text-ink tabular-nums">
                      {scoreRounded}
                    </motion.span>
                    <span className="mt-1 text-[11px] text-silver">ATS score</span>
                  </div>
                </div>
                <p className="text-[15px] leading-[1.5] text-graphite md:text-[17px]">
                  Upload a PDF. SkillLens pulls out your skills, checks the sections an applicant tracking
                  system looks for, and tells you exactly what to fix.
                </p>
              </div>

              <ul className="mt-8 space-y-3 md:space-y-4" aria-label="Sample checks">
                {CHECKS.map((item) => (
                  <Check key={item.label} item={item} progress={results} />
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ResumeSection;
