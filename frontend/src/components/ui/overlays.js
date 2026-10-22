import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Button, EASE, cx } from './primitives';

/* ---------- Modal / sheet ---------- */

/** Accessible dialog: Escape and backdrop close it, focus moves inside and returns afterwards. */
export function Modal({ open, onClose, title, children, size = 'lg', footer }) {
  const panelRef = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onCloseRef.current(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    const timer = setTimeout(() => panelRef.current?.focus(), 30);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      previous?.focus?.();
    };
  }, [open]);

  const widths = { sm: 'max-w-[440px]', md: 'max-w-[640px]', lg: 'max-w-[880px]', xl: 'max-w-[1080px]' };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[80] flex items-end justify-center bg-black/30 p-0 backdrop-blur-sm sm:items-center sm:p-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={typeof title === 'string' ? title : undefined}
            tabIndex={-1}
            className={cx('flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[28px] bg-white shadow-[0_30px_80px_-20px_rgba(0,0,0,0.35)] outline-none sm:rounded-[28px]', widths[size])}
            initial={{ opacity: 0, y: 40, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.98 }}
            transition={{ duration: 0.4, ease: EASE }}
          >
            <div className="flex items-center justify-between gap-4 border-b border-black/[0.06] px-6 py-4 md:px-8">
              <h2 className="font-display text-[21px] font-semibold tracking-tight text-ink">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full bg-mist px-3.5 py-1.5 text-[13px] font-medium text-graphite transition hover:text-ink"
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto px-6 py-6 md:px-8">{children}</div>
            {footer && <div className="border-t border-black/[0.06] px-6 py-4 md:px-8">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ---------- Toasts and confirm dialogs ---------- */

const FeedbackContext = createContext(null);

const TOAST_STYLE = {
  success: { dot: 'bg-green' },
  error: { dot: 'bg-red' },
  info: { dot: 'bg-blue' },
};

export function FeedbackProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [confirmState, setConfirmState] = useState(null);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const notify = useCallback((message, type = 'success') => {
    const id = `${Date.now()}-${Math.random()}`;
    setToasts((list) => [...list, { id, message, type }]);
    setTimeout(() => dismiss(id), 3500);
  }, [dismiss]);

  const confirm = useCallback((options) => new Promise((resolve) => {
    setConfirmState({ ...options, resolve });
  }), []);

  const closeConfirm = (answer) => {
    confirmState?.resolve(answer);
    setConfirmState(null);
  };

  return (
    <FeedbackContext.Provider value={{ notify, confirm }}>
      {children}

      {/* Toasts */}
      <div className="pointer-events-none fixed inset-x-0 top-16 z-[90] flex flex-col items-center gap-2 px-4" aria-live="polite">
        <AnimatePresence>
          {toasts.map((t) => {
            const style = TOAST_STYLE[t.type] || TOAST_STYLE.info;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: -12, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ duration: 0.35, ease: EASE }}
                className="pointer-events-auto flex items-center gap-2.5 rounded-full bg-white/90 px-5 py-3 text-[14px] text-ink shadow-[0_10px_40px_-10px_rgba(0,0,0,0.3)] ring-1 ring-black/5 backdrop-blur-xl"
              >
                <span className={cx('h-2 w-2 shrink-0 rounded-full', style.dot)} aria-hidden="true" />
                {t.message}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {/* Confirm dialog */}
      <Modal
        open={Boolean(confirmState)}
        onClose={() => closeConfirm(false)}
        title={confirmState?.title || 'Are you sure?'}
        size="sm"
        footer={(
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => closeConfirm(false)}>Cancel</Button>
            <Button variant={confirmState?.destructive ? 'danger' : 'primary'} onClick={() => closeConfirm(true)}>
              {confirmState?.confirmLabel || 'Confirm'}
            </Button>
          </div>
        )}
      >
        <p className="text-[15px] leading-[1.5] text-graphite">{confirmState?.message}</p>
      </Modal>
    </FeedbackContext.Provider>
  );
}

export function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('useFeedback must be used within a FeedbackProvider');
  return context;
}
