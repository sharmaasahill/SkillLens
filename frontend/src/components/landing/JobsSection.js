import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Reveal, useElementWidth } from './motion';

const SKILLS = ['Python', 'SQL', 'React', 'AWS', 'Machine Learning'];

// Examples of how live matches look for the skills above
const MATCHES = [
  { role: 'Data Scientist', company: 'Uplers', place: 'Hyderabad', score: 85, skills: ['Machine Learning', 'AWS', 'Python'] },
  { role: 'Fullstack Engineer', company: 'Kansal Corporate Solutions', place: 'Bengaluru', score: 71, skills: ['React', 'AWS', 'Python'] },
  { role: 'Full Stack Engineer', company: 'Axtria', place: 'Noida', score: 70, skills: ['React', 'Python', 'AWS'] },
  { role: 'Data Scientist', company: 'Crescendo Global', place: 'Bengaluru', score: 69, skills: ['Machine Learning', 'SQL', 'Python'] },
  { role: 'Python Developer', company: 'Reycruit', place: 'Hyderabad', score: 69, skills: ['AWS', 'SQL', 'Python'] },
  { role: 'AI Engineer', company: 'Version 1', place: 'Bengaluru', score: 67, skills: ['Python', 'Machine Learning', 'AWS'] },
];

const CARD_TONES = [
  { bg: 'bg-purple-soft', text: 'text-purple-ink' },
  { bg: 'bg-blue-soft', text: 'text-blue-ink' },
  { bg: 'bg-green-soft', text: 'text-green-ink' },
  { bg: 'bg-orange-soft', text: 'text-orange-ink' },
  { bg: 'bg-pink-soft', text: 'text-pink-ink' },
  { bg: 'bg-teal-soft', text: 'text-teal-ink' },
];

function MatchCard({ job, index }) {
  const t = CARD_TONES[index % CARD_TONES.length];
  return (
    <article className={`flex h-[360px] w-[300px] shrink-0 flex-col justify-between rounded-[28px] p-8 md:h-[420px] md:w-[360px] ${t.bg}`}>
      <div>
        <p className={`text-[12px] font-medium uppercase tracking-[0.08em] ${t.text}`}>Match {index + 1}</p>
        <h3 className="mt-3 font-display text-[28px] font-semibold leading-[1.1] tracking-tight text-ink">{job.role}</h3>
        <p className="mt-2 text-[17px] text-graphite">{job.company}</p>
        <p className="text-[14px] text-silver">{job.place}</p>
      </div>
      <div>
        <div className="flex flex-wrap gap-2">
          {job.skills.map((skill) => (
            <span key={skill} className="rounded-full bg-white px-3 py-1 text-[13px] text-ink">{skill}</span>
          ))}
        </div>
        <div className="mt-6 flex items-baseline gap-2">
          <span className={`font-display text-[48px] font-semibold leading-none tracking-tight ${t.text}`}>{job.score}</span>
          <span className="text-[17px] text-graphite">% match</span>
        </div>
      </div>
    </article>
  );
}

/** Vertical scroll drives a horizontal track of job matches, like a product gallery. */
function JobsSection() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const [viewportRef, viewportWidth] = useElementWidth();
  const [trackRef, trackWidth] = useElementWidth();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  const distance = Math.max(0, trackWidth - viewportWidth);
  const x = useTransform(scrollYProgress, [0.12, 0.92], [0, -distance]);
  const progressScale = useTransform(scrollYProgress, [0.12, 0.92], [0, 1]);

  return (
    <section id="jobs" ref={ref} className={`scroll-mt-12 ${reduce ? 'py-[14vh]' : 'h-[300vh]'}`} aria-labelledby="jobs-title">
      <div className={reduce ? '' : 'sticky top-0 flex h-screen flex-col justify-center overflow-hidden'}>
        <div className="mx-auto w-full max-w-[1024px] px-5">
          <Reveal>
            <p className="text-[17px] font-semibold text-purple-ink md:text-[21px]">Jobs</p>
            <h2 id="jobs-title" className="mt-2 max-w-[18ch] font-display text-[40px] font-semibold leading-[1.08] tracking-tighter2 text-ink md:text-[56px]">
              Fresh roles that fit the skills you already have.
            </h2>
            <p className="mt-5 max-w-[60ch] text-[17px] text-graphite">
              Live openings from job boards, Naukri, LinkedIn, Wellfound and company career pages, ranked against your resume.
              Example for{' '}
              {SKILLS.map((s, i) => (
                <span key={s} className="text-ink">{s}{i < SKILLS.length - 1 ? ', ' : ''}</span>
              ))}.
            </p>
          </Reveal>
        </div>

        <div ref={viewportRef} className={`mt-12 w-full ${reduce ? 'overflow-x-auto' : ''}`}>
          <motion.div
            ref={trackRef}
            className="flex w-max gap-5 px-5 md:px-[max(1.25rem,calc((100vw-984px)/2))]"
            style={{ x: reduce ? 0 : x }}
          >
            {MATCHES.map((job, i) => (
              <MatchCard key={job.role + job.company} job={job} index={i} />
            ))}
          </motion.div>
        </div>

        {!reduce && (
          <div className="mx-auto mt-10 h-[3px] w-[120px] overflow-hidden rounded-full bg-[#e8e8ed]" aria-hidden="true">
            <motion.div className="h-full origin-left bg-[linear-gradient(90deg,#af52de,#007aff)]" style={{ scaleX: progressScale }} />
          </div>
        )}
      </div>
    </section>
  );
}

export default JobsSection;
