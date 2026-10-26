import api from '../api';

/*
 * Sends JavaScript crashes from the browser to the server, where the admin dashboard lists them.
 * At most a few reports per page load, each message only once, and nothing from browser extensions.
 */
const MAX_REPORTS = 5;
const sent = new Set();
let count = 0;

// Harmless browser noise that says nothing about SkillLens
const IGNORE = [/ResizeObserver loop/i, /^Script error\.?$/i, /Non-Error promise rejection captured/i];

function fromExtension(stack = '') {
  return /(chrome|moz|safari(-web)?)-extension:\/\//.test(stack);
}

export function reportError(error, kind = 'error') {
  try {
    const message = String(error?.message || error || 'Unknown error').slice(0, 500);
    const stack = String(error?.stack || '').slice(0, 6000);
    if (!message.trim() || IGNORE.some((re) => re.test(message)) || fromExtension(stack)) return;
    const key = `${kind}|${message}`;
    if (sent.has(key) || count >= MAX_REPORTS) return;
    sent.add(key);
    count += 1;
    api.post('/api/client-errors', { message, stack, url: window.location.pathname, kind }).catch(() => {});
  } catch (e) {
    // Reporting must never cause another error
  }
}

let installed = false;

/** Listens for uncaught errors and rejected promises once, for the whole app. */
export function installErrorReporting() {
  if (installed || typeof window === 'undefined') return;
  installed = true;
  window.addEventListener('error', (event) => reportError(event.error || event.message, 'error'));
  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason;
    // Failed API calls are already shown to the user and logged on the server
    if (reason?.isAxiosError) return;
    reportError(reason, 'unhandledrejection');
  });
}
