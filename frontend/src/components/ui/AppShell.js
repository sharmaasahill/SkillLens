import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { EASE, cx } from './primitives';
import { Atmosphere, LensMark, RevealText } from './studio';

const USER_LINKS = [
  { to: '/dashboard', label: 'Overview', toneName: 'gray', end: true },
  { to: '/salary-predictor', label: 'Salary', toneName: 'green', also: ['/advanced-salary-predictor'] },
  { to: '/resume-analyzer', label: 'Resume', toneName: 'blue' },
  { to: '/job-recommender', label: 'Jobs', toneName: 'purple' },
  { to: '/account', label: 'Profile', toneName: 'orange' },
];

const HR_LINKS = [
  { to: '/hr-dashboard', label: 'Candidates', toneName: 'teal' },
];

// The account button shows the person's first name rather than a letter avatar
function shortNameOf(user) {
  const first = (user?.full_name || '').trim().split(/\s+/)[0];
  return first || (user?.email || '').split('@')[0] || 'Account';
}

function AccountMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onClick = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const signOut = async () => {
    await logout();
    navigate('/auth', { replace: true });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={`Account menu for ${shortNameOf(user)}`}
        className="group flex max-w-[160px] items-center gap-1 text-[12px] font-medium text-ink/80 transition-colors hover:text-ink"
      >
        <span className="truncate">{shortNameOf(user)}</span>
        <svg viewBox="0 0 16 16" className={cx('h-3 w-3 shrink-0 text-silver transition-transform duration-300 group-hover:text-ink', open && 'rotate-180')} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
          <path d="M4 6l4 4 4-4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute right-0 top-8 w-64 overflow-hidden rounded-2xl bg-white/95 p-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] ring-1 ring-black/5 backdrop-blur-xl"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.2, ease: EASE }}
          >
            <div className="px-3 py-2.5">
              <p className="truncate text-[14px] font-semibold text-ink">{user?.full_name || 'Your account'}</p>
              <p className="truncate text-[12px] text-graphite">{user?.email}</p>
            </div>
            <div className="my-1 h-px bg-black/[0.06]" />
            {!user?.is_admin && (
              <button
                type="button" role="menuitem"
                onClick={() => { setOpen(false); navigate('/account'); }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] text-ink hover:bg-mist"
              >
                Profile
              </button>
            )}
            <button
              type="button" role="menuitem" onClick={signOut}
              className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-[14px] text-red-ink hover:bg-red-soft"
            >
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const TONE_HEX = { gray: '#1d1d1f', green: '#34c759', blue: '#007aff', purple: '#af52de', orange: '#ff9500', teal: '#30b0c7' };

function NavLinks({ links, layoutKey }) {
  const location = useLocation();
  return (
    <ul className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
      {links.map((link) => {
        const active = location.pathname === link.to || (link.also || []).includes(location.pathname);
        return (
          <li key={link.to} className="relative">
            <NavLink
              to={link.to}
              end={link.end}
              className={cx('relative block whitespace-nowrap px-3 py-1.5 text-[12px] transition-colors', active ? 'text-ink' : 'text-ink/60 hover:text-ink')}
            >
              {link.label}
              {active && (
                <motion.span
                  layoutId={`nav-${layoutKey}`}
                  className="absolute inset-x-3 -bottom-[1px] h-[2px] rounded-full"
                  style={{ background: TONE_HEX[link.toneName] || '#1d1d1f' }}
                  transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                />
              )}
            </NavLink>
          </li>
        );
      })}
    </ul>
  );
}

const ROUTE_TONES = [
  ['/salary', 'green'], ['/advanced-salary', 'green'], ['/resume', 'blue'], ['/job', 'purple'],
  ['/account', 'orange'], ['/hr', 'teal'], ['/dashboard', 'orange'],
];

/** Top navigation and page frame shared by every signed-in page. */
function AppShell({ children, wide = false, toneName }) {
  const { user } = useAuth();
  const location = useLocation();
  const links = user?.is_admin ? HR_LINKS : USER_LINKS;
  const pageToneName = toneName || ROUTE_TONES.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] || 'blue';
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const width = wide ? 'max-w-[1320px]' : 'max-w-[1180px]';
  return (
    <div className="relative min-h-screen font-text text-ink antialiased selection:bg-action/20">
      <Atmosphere toneName={pageToneName} />
      {/* Same bar as the landing page: 48px tall, 1024px wide, 12px links, logo only */}
      <header className={cx(
        'sticky top-0 z-50 border-b transition-colors duration-500 ease-apple',
        scrolled ? 'border-black/[0.08] bg-white/[0.86] backdrop-blur-xl backdrop-saturate-[1.8]' : 'border-transparent bg-white/0'
      )}>
        <nav aria-label="Main" className="mx-auto grid h-12 max-w-[1024px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-5">
          <NavLink to="/" className="group justify-self-start" aria-label="SkillLens home">
            <LensMark className="h-6 w-6 transition-transform duration-700 ease-apple group-hover:rotate-[200deg]" />
          </NavLink>
          <div className="hidden md:block"><NavLinks links={links} layoutKey="desk" /></div>
          <div className="col-start-3 justify-self-end"><AccountMenu /></div>
        </nav>
        {/* On phones the section links get their own scrollable row */}
        <div className="px-3 pb-1 md:hidden">
          <NavLinks links={links} layoutKey="mobile" />
        </div>
      </header>
      <main className={cx('mx-auto px-6 pb-28 pt-10 md:pt-16', width)}>
        {children}
      </main>
    </div>
  );
}

/** Editorial page opening: eyebrow with a drawn rule, a headline that rises word by word, and a lead. */
export function PageHeader({ eyebrow, title, subtitle, toneName, actions, accent = 1, children }) {
  const location = useLocation();
  const t = toneName || ROUTE_TONES.find(([prefix]) => location.pathname.startsWith(prefix))?.[1] || 'blue';
  const hex = { orange: '#ff9500', green: '#34c759', blue: '#007aff', purple: '#af52de', teal: '#30b0c7' }[t] || '#007aff';
  return (
    <div className="mb-14 md:mb-20">
      <div className="flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <motion.div className="flex items-center gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6 }}>
              <motion.span className="h-px origin-left" style={{ background: hex, width: 36 }} initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, ease: EASE }} />
              <p className="text-[13px] font-semibold uppercase tracking-[0.14em]" style={{ color: hex }}>{eyebrow}</p>
            </motion.div>
          )}
          <RevealText
            text={typeof title === 'string' ? title : ''}
            accent={accent}
            toneName={t}
            className="mt-5 max-w-[17ch] font-display text-[44px] font-semibold leading-[1.02] tracking-tighter2 text-ink md:text-[76px]"
          />
          {subtitle && (
            <motion.p
              className="mt-6 max-w-[56ch] text-[18px] leading-[1.5] text-graphite md:text-[21px]"
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: EASE, delay: 0.35 }}
            >
              {subtitle}
            </motion.p>
          )}
        </div>
        {actions && (
          <motion.div className="flex flex-wrap gap-3" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.5 }}>
            {actions}
          </motion.div>
        )}
      </div>
      {children}
    </div>
  );
}

export default AppShell;
