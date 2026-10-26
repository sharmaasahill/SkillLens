import React, { useEffect, useRef } from 'react';
import { animate, motion, useInView, useMotionValue, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Reveal, useScrollScenes } from './motion';

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

const CHECKS = [
  { label: 'Contact details found', at: 0.3 },
  { label: 'Experience, Education and Skills sections found', at: 0.42 },
  { label: '14 strong action verbs', at: 0.54 },
  { label: '3 weak phrases worth rewording', at: 0.66, warn: true },
  { label: 'No tables or headers that trip up ATS parsers', at: 0.78 },
];

function Check({ item, progress }) {
  const opacity = useTransform(progress, [item.at - 0.06, item.at], [0, 1]);
  const x = useTransform(progress, [item.at - 0.06, item.at], [12, 0]);
  return (
    <motion.li className="flex items-start gap-3 text-[17px] text-ink" style={{ opacity, x }}>
      <span
        className={`mt-[9px] h-2 w-2 shrink-0 rounded-full ${item.warn ? 'bg-orange' : 'bg-green'}`}
        aria-hidden="true"
      />
      {item.label}
    </motion.li>
  );
}

function ResumeLine({ line, index, progress }) {
  const at = 0.12 + (index / LINES.length) * 0.6;
  const lit = useTransform(progress, [at - 0.04, at], [0, 1]);
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
 * A scanner reads down a resume while the ATS score fills and checks tick in.
 * On large screens scrolling drives it inside a pinned scene. On phones and short windows the whole
 * scene is taller than the screen, so pinning it made it spill over the sections around it: there it
 * sits in normal page flow and plays once, by itself, when it comes into view.
 */
function ResumeSection() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const scenes = useScrollScenes();
  const pinned = scenes && !reduce;
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const still = useMotionValue(1);
  const played = useMotionValue(0);
  const inView = useInView(ref, { once: true, amount: 0.2 });

  useEffect(() => {
    if (pinned || reduce || !inView) return undefined;
    const controls = animate(played, 1, { duration: 3.2, ease: 'linear' });
    return () => controls.stop();
  }, [pinned, reduce, inView, played]);

  const p = reduce ? still : pinned ? scrollYProgress : played;

  const scanTop = useTransform(p, [0.1, 0.75], ['0%', '100%']);
  const scanOpacity = useTransform(p, [0.08, 0.12, 0.72, 0.78], [0, 1, 1, 0]);
  const dash = useTransform(p, [0.15, 0.8], [RING, RING * (1 - SCORE / 100)]);
  const score = useTransform(p, [0.15, 0.8], [0, SCORE]);
  const scoreText = useTransform(score, (v) => Math.round(v));

  return (
    <section id="resume" ref={ref} className={`scroll-mt-12 ${pinned ? 'h-[260vh]' : ''}`} aria-labelledby="resume-title">
      <div className={`${pinned ? 'sticky top-0 flex h-screen items-center' : 'py-[14vh]'} px-5`}>
        <div className="mx-auto grid w-full max-w-[984px] items-center gap-12 md:grid-cols-2 md:gap-20">
          {/* Resume paper */}
          <div className="relative mx-auto w-full max-w-[420px] md:mx-0" aria-hidden="true">
            <div className="relative overflow-hidden rounded-[20px] bg-white p-8 shadow-[0_2px_4px_rgba(0,0,0,0.04),0_24px_60px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04]">
              <div className="space-y-2.5">
                {LINES.map((line, i) => (
                  <ResumeLine key={i} line={line} index={i} progress={p} />
                ))}
              </div>
              <motion.div className="pointer-events-none absolute inset-x-0 h-24 -translate-y-1/2" style={{ top: scanTop, opacity: scanOpacity }}>
                <div className="h-full bg-[linear-gradient(180deg,rgba(0,113,227,0)_0%,rgba(0,113,227,0.08)_50%,rgba(0,113,227,0)_100%)]" />
                <div className="absolute inset-x-0 top-1/2 h-px bg-action/60" />
              </motion.div>
            </div>
            <p className="mt-4 text-center text-[12px] text-silver">Sample resume and analysis</p>
          </div>

          {/* Score and checks */}
          <div>
            <Reveal>
              <p className="text-[17px] font-semibold text-blue-ink md:text-[21px]">Resume</p>
              <h2 id="resume-title" className="mt-2 font-display text-[36px] font-semibold leading-[1.08] tracking-tighter2 text-ink md:text-[48px] lg:text-[56px]">
                Read like a recruiter. Scored like a machine.
              </h2>
            </Reveal>

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
                    {scoreText}
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
                <Check key={item.label} item={item} progress={p} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

export default ResumeSection;
