import React, { useEffect, useRef, useState } from 'react';
import { animate, motion, useInView, useReducedMotion } from 'framer-motion';

// Apple's product pages use this curve for almost every transition
export const EASE = [0.28, 0.11, 0.32, 1];

/** Fades and lifts its children into place the first time they scroll into view. */
export function Reveal({ children, delay = 0, y = 32, as = 'div', className = '', amount = 0.4 }) {
  const reduce = useReducedMotion();
  const Component = motion[as];
  return (
    <Component
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount }}
      transition={{ duration: 0.9, ease: EASE, delay }}
    >
      {children}
    </Component>
  );
}

/** Counts up to `value` once visible. Renders the final value immediately for reduced motion. */
export function CountUp({ value, duration = 1.6, format = (n) => Math.round(n).toLocaleString('en-IN'), className = '' }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(reduce ? value : 0);

  useEffect(() => {
    if (!inView || reduce) {
      if (reduce) setDisplay(value);
      return undefined;
    }
    const controls = animate(0, value, { duration, ease: EASE, onUpdate: setDisplay });
    return () => controls.stop();
  }, [inView, reduce, value, duration]);

  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(display)}
    </span>
  );
}

/**
 * Tracks an element's full width, padding included, for scroll-driven layouts that depend on real sizes.
 * (The content width alone leaves out the padding, so a sliding track stopped short of its last card.)
 */
export function useElementWidth() {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setWidth(el.offsetWidth);
    const observer = new ResizeObserver(measure);
    observer.observe(el, { box: 'border-box' });
    measure();
    return () => observer.disconnect();
  }, []);
  return [ref, width];
}

/** True while a CSS media query matches, updating when the window changes size. */
export function useMediaQuery(query) {
  const supported = typeof window !== 'undefined' && typeof window.matchMedia === 'function';
  const [matches, setMatches] = useState(() => supported && window.matchMedia(query).matches);
  useEffect(() => {
    if (!supported) return undefined;
    const list = window.matchMedia(query);
    const update = () => setMatches(list.matches);
    update();
    if (list.addEventListener) list.addEventListener('change', update);
    else list.addListener(update);
    return () => (list.removeEventListener ? list.removeEventListener('change', update) : list.removeListener(update));
  }, [query, supported]);
  return matches;
}

/**
 * Pinned, scroll-driven scenes need a screen that is wide and tall enough to hold the whole scene.
 * On phones and short laptop windows the sections fall back to normal page flow, so nothing is cut
 * off or drawn over the next section.
 */
export const useScrollScenes = () => useMediaQuery('(min-width: 768px) and (min-height: 600px)');

/** Annual salary in lakhs per annum: 1586000 -> "₹15.9 LPA". */
export const money = (n) => `₹${(Number(n) / 100000).toFixed(1)} LPA`;
