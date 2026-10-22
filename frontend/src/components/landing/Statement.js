import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

const TEXT =
  'Most career advice is a guess. SkillLens reads your resume, weighs your experience against 6,704 real salaries, and matches you to 2,197 open roles. Then it shows its working.';

function Word({ children, progress, range }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <motion.span style={{ opacity }} className="inline">
      {children}{' '}
    </motion.span>
  );
}

/** Large paragraph whose words light up one by one as it scrolls through the viewport. */
function Statement() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.85', 'end 0.45'] });
  const words = TEXT.split(' ');

  return (
    <section className="px-6 py-[18vh]" aria-label="About SkillLens">
      <p
        ref={ref}
        className="mx-auto max-w-[980px] font-display text-[32px] font-semibold leading-[1.18] tracking-tight text-ink md:text-[56px] md:leading-[1.1]"
      >
        {reduce
          ? TEXT
          : words.map((word, i) => (
              <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]}>
                {word}
              </Word>
            ))}
      </p>
    </section>
  );
}

export default Statement;
