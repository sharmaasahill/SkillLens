import React, { forwardRef, useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

const EASE = [0.28, 0.11, 0.32, 1];
const KEYS = [' ', 'Enter'];

/** An eye that opens while the password is shown; a slash is drawn across it while hidden. */
function Eye({ open }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <motion.circle cx="12" cy="12" initial={false} animate={{ r: open ? 3.2 : 2.2 }} transition={{ duration: 0.25, ease: EASE }} />
      <motion.path
        d="M4 4l16 16"
        initial={false}
        animate={{ pathLength: open ? 0 : 1, opacity: open ? 0 : 1 }}
        transition={{ duration: 0.25, ease: EASE }}
      />
    </svg>
  );
}

/**
 * Password input with an eye button. Pressing and holding the eye shows the password; letting go
 * hides it again. Works with a mouse, a finger, and the keyboard (hold Space or Enter on the eye).
 */
export const PasswordField = forwardRef(function PasswordField(
  { id, label, className = '', describedBy, invalid, ...inputProps },
  ref
) {
  const [shown, setShown] = useState(false);
  const hide = useCallback(() => setShown(false), []);

  // A release the button never hears about (the finger slid away, the window lost focus, the tab
  // was switched) must never leave the password on screen.
  useEffect(() => {
    if (!shown) return undefined;
    window.addEventListener('pointerup', hide);
    window.addEventListener('pointercancel', hide);
    window.addEventListener('blur', hide);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.removeEventListener('pointerup', hide);
      window.removeEventListener('pointercancel', hide);
      window.removeEventListener('blur', hide);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [shown, hide]);

  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        ref={ref}
        id={id}
        type={shown ? 'text' : 'password'}
        // While shown as plain text, phone keyboards must not autocorrect or capitalise it
        autoCapitalize="off"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        className={`${className} pr-12`}
        {...inputProps}
      />
      <button
        type="button"
        aria-label={`Press and hold to show ${label.toLowerCase()}`}
        title="Press and hold to show"
        onPointerDown={(e) => { if (e.button === 0) { e.preventDefault(); setShown(true); } }}
        onPointerUp={hide}
        onPointerLeave={hide}
        onPointerCancel={hide}
        onMouseDown={(e) => e.preventDefault()} // keep the cursor in the password field
        onContextMenu={(e) => e.preventDefault()} // a long press on a phone opens no menu
        onKeyDown={(e) => { if (KEYS.includes(e.key)) { e.preventDefault(); setShown(true); } }}
        onKeyUp={(e) => { if (KEYS.includes(e.key)) { e.preventDefault(); hide(); } }}
        onBlur={hide}
        className={`absolute inset-y-0 right-0 flex w-12 touch-none select-none items-center justify-center rounded-r-xl transition-colors [-webkit-touch-callout:none] focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-action/40 ${
          shown ? 'text-action' : 'text-silver hover:text-graphite'
        }`}
      >
        <Eye open={shown} />
      </button>
    </div>
  );
});

/** How a confirmation compares with the password: empty, typing (so far so good), match or mismatch. */
export function matchState(password, confirm) {
  if (!confirm) return 'empty';
  if (confirm === password) return 'match';
  return password.startsWith(confirm) ? 'typing' : 'mismatch';
}

const MESSAGES = {
  typing: { text: 'Keep typing...', className: 'text-silver' },
  match: { text: 'Passwords match', className: 'text-green-ink' },
  mismatch: { text: "Passwords don't match", className: 'text-red-ink' },
};

function StateIcon({ state }) {
  if (state === 'typing') {
    return (
      <span className="flex gap-1" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="h-1.5 w-1.5 rounded-full bg-silver"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </span>
    );
  }
  const match = state === 'match';
  return (
    <motion.svg
      viewBox="0 0 20 20" className="h-5 w-5 shrink-0" aria-hidden="true"
      initial={{ scale: 0.6 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }}
    >
      <circle cx="10" cy="10" r="10" fill={match ? '#34c759' : '#ff3b30'} />
      <motion.path
        d={match ? 'M5.8 10.3l2.7 2.7 5.7-5.9' : 'M6.8 6.8l6.4 6.4M13.2 6.8l-6.4 6.4'}
        fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.35, ease: EASE, delay: 0.08 }}
      />
    </motion.svg>
  );
}

/**
 * Live feedback under the confirm field: dots while it still matches so far, a green tick that
 * draws itself when both match, and a red cross with a small shake when they differ.
 */
export function PasswordMatch({ id, state }) {
  const reduce = useReducedMotion();
  const message = MESSAGES[state];
  return (
    <motion.div
      initial={false}
      animate={{ height: message ? 'auto' : 0, opacity: message ? 1 : 0 }}
      transition={{ duration: 0.3, ease: EASE }}
      className="overflow-hidden"
    >
      <div id={id} role="status" aria-live="polite">
        <AnimatePresence mode="wait" initial={false}>
          {message && (
            <motion.p
              key={state}
              className={`flex items-center gap-2 px-1 pt-2.5 text-[14px] font-medium ${message.className}`}
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0, x: state === 'mismatch' && !reduce ? [0, -6, 6, -4, 4, 0] : 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.2, ease: EASE, x: { duration: 0.4 } }}
            >
              <StateIcon state={state} />
              {message.text}
            </motion.p>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
