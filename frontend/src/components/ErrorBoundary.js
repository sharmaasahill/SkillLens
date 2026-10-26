import React from 'react';
import { reportError } from '../lib/errorReporter';

/**
 * If a page crashes while drawing, show a calm message instead of a blank screen, and report the
 * error so the admin sees it in the dashboard.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    const stack = [error?.stack, info?.componentStack].filter(Boolean).join('\n');
    reportError({ message: error?.message || String(error), stack }, 'render');
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#fbfbfd] px-6 text-center" role="alert">
        <p className="font-display text-[40px] font-semibold tracking-tight text-ink md:text-[56px]">Something went wrong.</p>
        <p className="mt-4 max-w-[44ch] text-[17px] leading-[1.5] text-graphite">
          This page hit an error. It has been reported, so it can be fixed. Reloading usually helps.
        </p>
        <div className="mt-8 flex items-center gap-6 text-[17px]">
          <button type="button" onClick={() => window.location.reload()} className="rounded-full bg-action px-6 py-3 font-medium text-white hover:bg-action-hover">
            Reload the page
          </button>
          <a href="/" className="text-action-link hover:underline">Go to the home page</a>
        </div>
      </div>
    );
  }
}

export default ErrorBoundary;
