import React, { useEffect, useRef, useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { useAuth } from '../../contexts/AuthContext';
import { EASE, cx } from './primitives';
import { tone } from './tones';

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

function initialOf(user) {
  return ((user?.full_name || user?.email || 'U').trim().charAt(0) || 'U').toUpperCase();
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
        aria-label="Account"
        className="flex h-8 w-8 items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff9500,#ff2d55)] text-[13px] font-semibold text-white ring-2 ring-white transition hover:scale-105"
      >
        {initialOf(user)}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            className="absolute right-0 top-11 w-64 overflow-hidden rounded-2xl bg-white/95 p-2 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.3)] ring-1 ring-black/5 backdrop-blur-xl"
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

function NavLinks({ links }) {
  const location = useLocation();
  return (
    <ul className="flex items-center gap-1 overflow-x-auto [scrollbar-width:none]">
      {links.map((link) => (
        <li key={link.to}>
          <NavLink
            to={link.to}
            end={link.end}
            className={({ isActive }) => {
              const active = isActive || (link.also || []).includes(location.pathname);
              return cx(
                'flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-[13px] transition-colors',
                active ? 'bg-ink text-white' : 'text-ink/75 hover:bg-mist hover:text-ink'
              );
            }}
          >
            <span className={cx('h-1.5 w-1.5 rounded-full', tone(link.toneName).bg)} aria-hidden="true" />
            {link.label}
          </NavLink>
        </li>
      ))}
    </ul>
  );
}

/** Top navigation and page frame shared by every signed-in page. */
function AppShell({ children, wide = false }) {
  const { user } = useAuth();
  const links = user?.is_admin ? HR_LINKS : USER_LINKS;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('dark');
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#fbfbfd] font-text text-ink antialiased selection:bg-action/20">
      <header className={cx(
        'sticky top-0 z-50 border-b transition-colors duration-300',
        scrolled ? 'border-black/[0.08] bg-white/80 backdrop-blur-xl backdrop-saturate-[1.8]' : 'border-transparent bg-[#fbfbfd]'
      )}>
        <nav aria-label="Main" className={cx('mx-auto flex h-14 items-center justify-between gap-4 px-5', wide ? 'max-w-[1280px]' : 'max-w-[1120px]')}>
          <NavLink to="/" className="font-display text-[19px] font-semibold tracking-tight text-ink">
            Skill<span className="text-graphite">Lens</span>
          </NavLink>
          <div className="hidden md:block"><NavLinks links={links} /></div>
          <AccountMenu />
        </nav>
        {/* On phones the section links get their own scrollable row */}
        <div className="border-t border-black/[0.05] px-3 py-2 md:hidden">
          <NavLinks links={links} />
        </div>
      </header>
      <main className={cx('mx-auto px-5 pb-24 pt-8 md:pt-12', wide ? 'max-w-[1280px]' : 'max-w-[1120px]')}>
        {children}
      </main>
    </div>
  );
}

/** Large page title block, Apple product-page style. */
export function PageHeader({ eyebrow, title, subtitle, toneName = 'blue', actions }) {
  return (
    <div className="mb-10 flex flex-col gap-6 md:mb-12 md:flex-row md:items-end md:justify-between">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE }}>
        {eyebrow && <p className={cx('text-[15px] font-semibold md:text-[17px]', tone(toneName).text)}>{eyebrow}</p>}
        <h1 className="mt-1 max-w-[20ch] font-display text-[36px] font-semibold leading-[1.08] tracking-tighter2 text-ink md:text-[52px]">{title}</h1>
        {subtitle && <p className="mt-3 max-w-[60ch] text-[17px] leading-[1.5] text-graphite md:text-[19px]">{subtitle}</p>}
      </motion.div>
      {actions && <div className="flex flex-wrap gap-3">{actions}</div>}
    </div>
  );
}

export default AppShell;
