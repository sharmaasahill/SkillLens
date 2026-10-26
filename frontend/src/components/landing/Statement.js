import React, { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

const TEXT =
  'Most career advice is a guess. SkillLens reads your resume, weighs your experience against 31,566 real Indian salaries, and checks your skills against 97,316 job postings. Then it shows its working.';

function Word({ children, progress, range, className = '' }) {
  const opacity = useTransform(progress, range, [0.16, 1]);
  return (
    <motion.span style={{ opacity }} className={`inline ${className}`}>
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
  // Words that carry the facts get their product colour
  const accent = (word) => {
    if (word.startsWith('resume')) return 'text-blue';
    if (word === '31,566' || word === 'real' || word === 'Indian' || word.startsWith('salaries')) return 'text-green';
    if (word === '97,316' || word === 'job' || word.startsWith('postings')) return 'text-purple';
    if (word === 'working.') return 'bg-[linear-gradient(90deg,#ff9500,#ff2d55)] bg-clip-text text-transparent';
    return '';
  };

  return (
    <section className="px-5 py-[18vh]" aria-label="About SkillLens">
      <p
        ref={ref}
        className="mx-auto max-w-[984px] font-display text-[32px] font-semibold leading-[1.18] tracking-tight text-ink md:text-[56px] md:leading-[1.1]"
      >
        {reduce
          ? TEXT
          : words.map((word, i) => (
              <Word key={i} progress={scrollYProgress} range={[i / words.length, (i + 1) / words.length]} className={accent(word)}>
                {word}
              </Word>
            ))}
      </p>
    </section>
  );
}

export default Statement;
