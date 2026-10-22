import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { motion, useMotionValue, useReducedMotion, useScroll, useTransform } from 'framer-motion';
import Laptop from './Laptop';
import ScreenUI from './ScreenUI';
import { EASE } from './motion';

const easeOutCubic = (t) => 1 - (1 - t) ** 3;

/**
 * Scroll-driven hero. At rest it is just the headline. As you scroll, the laptop
 * rises in from below with its lid already swinging open, the display wakes up,
 * and the salary estimate counts up on screen. It is never shown sitting closed.
 */
function Hero({ signedIn }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const still = useMotionValue(1);
  const p = reduce ? still : scrollYProgress;

  const headlineOpacity = useTransform(p, [0.01, 0.09], reduce ? [1, 1] : [1, 0]);
  const headlineY = useTransform(p, [0.01, 0.09], reduce ? [0, 0] : [0, -80]);
  const headlineScale = useTransform(p, [0.01, 0.09], reduce ? [1, 1] : [1, 0.94]);

  // The laptop starts fully below the fold and rises in while the lid opens.
  // It never scales (scaling a GPU layer up blurs it); it moves instead.
  // It enters once the headline has gone, with the lid already half open
  const laptopY = useTransform(p, [0.02, 0.28], ['70vh', '0vh'], { ease: easeOutCubic });
  const laptopOpacity = useTransform(p, [0.02, 0.05], [0, 1]);
  const open = useTransform(p, [0.02, 0.36], [0.3, 1]);
  const screenOpacity = useTransform(p, [0.26, 0.34], [0, 1]);
  const screenProgress = useTransform(p, [0.4, 0.72], [0, 1]);
  const glowOpacity = useTransform(p, [0.3, 0.45, 0.8], [0, 0.9, 0.6]);
  const glowScale = useTransform(p, [0.3, 0.6], [0.8, 1.05]);

  const captionOpacity = useTransform(p, [0.7, 0.84], reduce ? [1, 1] : [0, 1]);
  const captionY = useTransform(p, [0.7, 0.84], reduce ? [0, 0] : [16, 0]);

  return (
    <section ref={ref} id="top" className={reduce ? 'relative' : 'relative h-[300vh]'} aria-labelledby="hero-title">
      <div className={`${reduce ? '' : 'sticky top-0 h-screen'} flex flex-col items-center overflow-hidden`}>
        {/* Headline */}
        <motion.div
          className={`${reduce ? 'relative py-28' : 'absolute inset-0 pt-12'} z-10 flex flex-col items-center justify-center px-6 text-center`}
          style={{ opacity: headlineOpacity, y: headlineY, scale: headlineScale }}
        >
          <motion.h1
            id="hero-title"
            className="mx-auto max-w-[13ch] font-display text-[48px] font-semibold leading-[1.05] tracking-tighter2 text-ink md:text-[80px]"
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 1.2, ease: EASE, delay: 0.25 }}
          >
            Know what your skills are <span className="bg-[linear-gradient(90deg,#ff9500_0%,#ff2d55_35%,#af52de_68%,#007aff_100%)] bg-clip-text text-transparent">worth.</span>
          </motion.h1>
          <motion.div
            className="mt-9 flex items-center justify-center gap-6 text-[17px]"
            initial={reduce ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, ease: EASE, delay: 0.7 }}
          >
            <Link
              to={signedIn ? '/dashboard' : '/auth?mode=signup'}
              className="rounded-full bg-action px-[22px] py-[11px] text-white transition-colors hover:bg-action-hover"
            >
              {signedIn ? 'Open dashboard' : 'Get started'}
            </Link>
            <a href="#salary" className="group text-action-link hover:underline">
              See how it works
              <span aria-hidden="true" className="ml-0.5 inline-block transition-transform group-hover:translate-x-0.5">›</span>
            </a>
          </motion.div>
        </motion.div>

        {/* Laptop */}
        <motion.div
          className="relative my-auto w-[min(94vw,1240px,calc((100vh-210px)*1.62))] md:mb-0 md:mt-auto md:pb-[8vh]"
          style={{ y: reduce ? 0 : laptopY, opacity: reduce ? 1 : laptopOpacity }}
          aria-hidden="true"
        >
          {/* Colour bloom behind the display as it wakes up */}
          <motion.div
            className="pointer-events-none absolute inset-x-[12%] top-[4%] bottom-[30%] -z-10 rounded-[50%] bg-[conic-gradient(from_180deg_at_50%_50%,#ff9500,#ff2d55,#af52de,#007aff,#30b0c7,#34c759,#ff9500)] blur-[70px]"
            style={{ opacity: reduce ? 0.5 : glowOpacity, scale: reduce ? 1 : glowScale }}
          />
          <Laptop open={reduce ? still : open} screenOpacity={reduce ? 1 : screenOpacity}>
            <ScreenUI progress={reduce ? still : screenProgress} />
          </Laptop>
        </motion.div>

        {/* Caption above the open laptop, taking over from the headline */}
        <motion.p
          className="absolute inset-x-0 top-[calc(3rem+4vh)] px-6 text-center text-[17px] text-graphite md:text-[21px]"
          style={{ opacity: captionOpacity, y: captionY }}
        >
          A Data Scientist with five years and a Master's. <span className="text-ink">Estimated at $110,354.</span>
        </motion.p>
      </div>
    </section>
  );
}

export default Hero;
