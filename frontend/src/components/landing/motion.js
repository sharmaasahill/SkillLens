import React, { useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion';

// Apple's product pages use this curve for almost every transition
export const EASE = [0.28, 0.11, 0.32, 1];

/*
 * Every landing animation is tied to the scroll position, not to a clock: scroll down and it
 * moves forward, stop and it stops, scroll up and it plays backwards. This works the same with a
 * mouse wheel, a trackpad or a finger.
 */

/**
 * Fades and lifts its children into place as they come up the screen. `delay` starts it a little
 * later in the scroll, so neighbours arrive one after another.
 */
export function Reveal({ children, delay = 0, y = 32, as = 'div', className = '' }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const Component = motion[as];
  // From the moment its top enters the screen until it is about a quarter of the way up
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.98', 'start 0.72'] });
  const start = Math.min(0.5, delay * 2);
  const opacity = useTransform(scrollYProgress, [start, 1], [0, 1]);
  const lift = useTransform(scrollYProgress, [start, 1], [y, 0]);
  return (
    <Component ref={ref} className={className} style={reduce ? undefined : { opacity, y: lift }}>
      {children}
    </Component>
  );
}

/** Counts from zero up to `value` as it scrolls up the screen, and back down when you scroll up. */
export function CountUp({ value, format = (n) => Math.round(n).toLocaleString('en-IN'), className = '' }) {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 0.95', 'start 0.55'] });
  const text = useTransform(scrollYProgress, (p) => format(p * value));
  return (
    <motion.span ref={ref} className={`tabular-nums ${className}`}>
      {reduce ? format(value) : text}
    </motion.span>
  );
}

function useElementSize(read) {
  const ref = useRef(null);
  const [size, setSize] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => setSize(read(el));
    const observer = new ResizeObserver(measure);
    observer.observe(el, { box: 'border-box' });
    measure();
    return () => observer.disconnect();
  }, [read]);
  return [ref, size];
}

const readWidth = (el) => el.offsetWidth;
const readHeight = (el) => el.offsetHeight;

/**
 * Tracks an element's full width, padding included, for scroll-driven layouts that depend on real sizes.
 * (The content width alone leaves out the padding, so a sliding track stopped short of its last card.)
 */
export const useElementWidth = () => useElementSize(readWidth);

/** Tracks an element's full height. */
export const useElementHeight = () => useElementSize(readHeight);

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
 * Large screens (laptops and up) have room for the big pinned scenes: a full-screen stage that
 * stays put while you scroll through it. Phones and tablets get a version sized to their screen.
 */
export const useWideScreen = () => useMediaQuery('(min-width: 1024px) and (min-height: 600px)');

/** Annual salary in lakhs per annum: 1586000 -> "₹15.9 LPA". */
export const money = (n) => `₹${(Number(n) / 100000).toFixed(1)} LPA`;
