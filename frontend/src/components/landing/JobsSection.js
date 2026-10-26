import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import { Reveal, useElementHeight, useElementWidth, useMediaQuery, useWideScreen } from './motion';

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

const cx = (...c) => c.filter(Boolean).join(' ');

function MatchCard({ job, index, wide }) {
  const t = CARD_TONES[index % CARD_TONES.length];
  return (
    <article
      className={cx(
        'flex shrink-0 snap-start flex-col justify-between gap-6 rounded-[28px]',
        // Large screens: the card height follows the window height, so the full-screen scene always fits
        wide ? 'h-[clamp(300px,46vh,420px)] w-[360px] p-8' : 'h-[320px] w-[272px] p-6 sm:w-[300px]',
        t.bg
      )}
    >
      <div>
        <p className={`text-[12px] font-medium uppercase tracking-[0.08em] ${t.text}`}>Match {index + 1}</p>
        <h3 className="mt-3 font-display text-[26px] font-semibold leading-[1.1] tracking-tight text-ink md:text-[28px]">{job.role}</h3>
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
          <span className={`font-display text-[44px] font-semibold leading-none tracking-tight md:text-[48px] ${t.text}`}>{job.score}</span>
          <span className="text-[17px] text-graphite">% match</span>
        </div>
      </div>
    </article>
  );
}

/**
 * Scrolling down slides a row of job matches sideways, like a product gallery; scrolling up slides
 * it back, and it stops when you stop.
 *
 * Laptops and up: a full-screen scene. Phones and tablets: the scene is only as tall as its content
 * and is held in the middle of the screen, so it fits and the next section follows straight after it.
 * Screens too short for either (a phone turned sideways) get a plain row you swipe.
 */
function JobsSection() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const wideScreen = useWideScreen();
  const tallEnough = useMediaQuery('(min-height: 520px)');
  const mode = reduce || !tallEnough ? 'swipe' : wideScreen ? 'wide' : 'compact';
  const pinned = mode !== 'swipe';
  const wide = mode === 'wide';

  const [sceneRef, sceneHeight] = useElementHeight();
  const [viewportRef, viewportWidth] = useElementWidth();
  const [trackRef, trackWidth] = useElementWidth();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });

  // Slide until the last card (and the padding after it) is fully on screen
  const distance = Math.max(0, trackWidth - viewportWidth);
  const x = useTransform(scrollYProgress, [0.12, 0.9], [0, -distance]);
  const progressScale = useTransform(scrollYProgress, [0.12, 0.9], [0, 1]);

  const sceneClass = {
    wide: 'sticky top-0 flex h-screen flex-col justify-center overflow-hidden',
    compact: 'sticky-center sticky overflow-hidden pb-2',
    swipe: '',
  }[mode];

  return (
    <section id="jobs" ref={ref} className={`scroll-mt-12 ${pinned ? 'h-[300vh]' : 'pb-20 md:py-[14vh]'}`} aria-labelledby="jobs-title">
      <div ref={sceneRef} className={sceneClass} style={mode === 'compact' ? { '--scene-h': `${sceneHeight}px` } : undefined}>
        <div className="mx-auto w-full max-w-[1024px] px-5">
          <Reveal>
            <p className="text-[17px] font-semibold text-purple-ink md:text-[21px]">Jobs</p>
            <h2
              id="jobs-title"
              className={cx(
                'mt-2 font-display font-semibold leading-[1.08] tracking-tighter2 text-ink',
                wide ? 'max-w-[22ch] text-[56px]' : 'max-w-[18ch] text-[30px] sm:text-[40px]'
              )}
            >
              Fresh roles that fit the skills you already have.
            </h2>
            {/* On short phone screens the pinned scene needs this room for the cards */}
            <p className={cx('mt-4 max-w-[60ch] text-[15px] leading-[1.5] text-graphite md:mt-5 md:text-[17px]', mode === 'compact' && '[@media(max-height:720px)]:hidden')}>
              Live openings from job boards, Naukri, LinkedIn, Wellfound and company career pages, ranked against your resume.
              Example for{' '}
              {SKILLS.map((s, i) => (
                <span key={s} className="text-ink">{s}{i < SKILLS.length - 1 ? ', ' : ''}</span>
              ))}.
            </p>
          </Reveal>
        </div>

        <div
          ref={viewportRef}
          className={cx(
            'w-full',
            wide ? 'mt-10' : 'mt-6',
            !pinned && 'snap-x snap-mandatory overflow-x-auto scroll-px-5 pb-2 focus:outline-none focus-visible:ring-2 focus-visible:ring-action/40 md:scroll-px-[max(1.25rem,calc((100vw-984px)/2))]'
          )}
          // A row you swipe must also be reachable from the keyboard (arrow keys scroll it once focused)
          {...(pinned ? {} : { role: 'region', tabIndex: 0, 'aria-label': 'Example job matches, swipe for more' })}
        >
          <motion.div
            ref={trackRef}
            className="flex w-max gap-4 px-5 md:gap-5 md:px-[max(1.25rem,calc((100vw-984px)/2))]"
            style={{ x: pinned ? x : 0 }}
          >
            {MATCHES.map((job, i) => (
              <MatchCard key={job.role + job.company} job={job} index={i} wide={wide} />
            ))}
          </motion.div>
        </div>

        {pinned && (
          <div className={cx('mx-auto h-[3px] w-[120px] overflow-hidden rounded-full bg-[#e8e8ed]', wide ? 'mt-8' : 'mt-6')} aria-hidden="true">
            <motion.div className="h-full origin-left bg-[linear-gradient(90deg,#af52de,#007aff)]" style={{ scaleX: progressScale }} />
          </div>
        )}
      </div>
    </section>
  );
}

export default JobsSection;
