import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { EASE } from './motion';
import { LensMark } from '../ui/studio';

const LINKS = [
  { href: '#salary', label: 'Salary' },
  { href: '#resume', label: 'Resume' },
  { href: '#jobs', label: 'Jobs' },
];

export function Wordmark({ className = '' }) {
  return (
    <span className={`font-display font-semibold tracking-tight text-ink ${className}`}>
      Skill<span className="text-graphite">Lens</span>
    </span>
  );
}

function GlobalNav({ signedIn, home = '/dashboard' }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 border-b transition-colors duration-500 ease-apple ${
        scrolled || open ? 'bg-white/[0.86] backdrop-blur-xl backdrop-saturate-[1.8]' : 'bg-white/0'
      } ${scrolled && !open ? 'border-black/[0.08]' : 'border-transparent'}`}
    >
      <nav aria-label="Main" className="mx-auto grid h-12 max-w-[1024px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-5">
        <a href="#top" className="group justify-self-start" aria-label="SkillLens home">
          <LensMark className="h-6 w-6 transition-transform duration-700 ease-apple group-hover:rotate-[200deg]" />
        </a>

        <ul className="hidden items-center gap-8 md:flex">
          {LINKS.map((link) => (
            <li key={link.href}>
              <a href={link.href} className="text-[12px] text-ink/80 transition-colors hover:text-ink">
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="col-start-3 flex items-center gap-4 justify-self-end">
          {signedIn ? (
            <Link to={home} className="rounded-full bg-action px-3.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-action-hover">
              Open dashboard
            </Link>
          ) : (
            <>
              <Link to="/auth" className="hidden text-[12px] text-ink/80 hover:text-ink sm:inline">
                Sign in
              </Link>
              <Link to="/auth?mode=signup" className="rounded-full bg-action px-3.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-action-hover">
                Get started
              </Link>
            </>
          )}
          <button
            type="button"
            className="relative h-8 w-8 md:hidden"
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className={`absolute left-1.5 right-1.5 h-px bg-ink transition-transform duration-300 ${open ? 'top-1/2 rotate-45' : 'top-[12px]'}`} />
            <span className={`absolute left-1.5 right-1.5 h-px bg-ink transition-transform duration-300 ${open ? 'top-1/2 -rotate-45' : 'top-[19px]'}`} />
          </button>
        </div>
      </nav>

      <AnimatePresence>
        {open && (
          <motion.div
            className="h-[calc(100vh-3rem)] bg-white px-10 pt-8 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: EASE }}
          >
            <ul className="space-y-4">
              {LINKS.map((link, i) => (
                <motion.li
                  key={link.href}
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, ease: EASE, delay: 0.05 + i * 0.04 }}
                >
                  <a href={link.href} onClick={() => setOpen(false)} className="font-display text-[28px] font-semibold text-ink">
                    {link.label}
                  </a>
                </motion.li>
              ))}
              {!signedIn && (
                <li>
                  <Link to="/auth" className="font-display text-[28px] font-semibold text-graphite">Sign in</Link>
                </li>
              )}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}

export default GlobalNav;
