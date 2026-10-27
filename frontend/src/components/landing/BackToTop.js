import React, { useState } from 'react';
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from 'framer-motion';
import { EASE } from './motion';

/**
 * A round "back to top" button in the bottom-right corner. It appears once you are halfway down
 * the page, and its ring fills up as you scroll, so it also shows how far down you are.
 */
function BackToTop() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const [shown, setShown] = useState(() => scrollYProgress.get() >= 0.5);
  useMotionValueEvent(scrollYProgress, 'change', (progress) => setShown(progress >= 0.5));

  const toTop = () => window.scrollTo({ top: 0, left: 0, behavior: reduce ? 'instant' : 'smooth' });
  const hidden = reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.9 };

  return (
    <AnimatePresence>
      {shown && (
        <motion.button
          type="button"
          onClick={toTop}
          aria-label="Back to top"
          title="Back to top"
          initial={hidden}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={hidden}
          transition={{ duration: 0.35, ease: EASE }}
          className="group fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-white/85 text-ink shadow-[0_12px_32px_-10px_rgba(0,0,0,0.35)] backdrop-blur-xl transition-colors hover:bg-white focus:outline-none focus-visible:ring-4 focus-visible:ring-action/30 md:bottom-8 md:right-8"
        >
          {/* Progress ring: empty at the top of the page, full at the bottom */}
          <svg viewBox="0 0 48 48" className="absolute inset-0 h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="24" cy="24" r="23" fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="1.5" />
            <motion.circle
              cx="24" cy="24" r="23" fill="none" stroke="#0071e3" strokeWidth="1.5" strokeLinecap="round"
              style={{ pathLength: scrollYProgress }}
            />
          </svg>
          <svg
            viewBox="0 0 20 20" className="h-5 w-5 transition-transform duration-300 ease-apple group-hover:-translate-y-0.5"
            fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
          >
            <path d="M10 15.5V4.5M5 9.5l5-5 5 5" />
          </svg>
        </motion.button>
      )}
    </AnimatePresence>
  );
}

export default BackToTop;
