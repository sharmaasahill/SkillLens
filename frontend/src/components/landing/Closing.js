import React from 'react';
import { Link } from 'react-router-dom';
import { CountUp, Reveal } from './motion';
import { Wordmark } from './GlobalNav';

const NUMBERS = [
  { value: 31566, label: 'disclosed Indian salaries behind every estimate', color: 'text-green' },
  { value: 97316, label: 'Indian job postings behind your market fit', color: 'text-blue' },
  { value: 18595, label: 'companies hiring across the country', color: 'text-purple' },
  { value: 196, label: 'Indian cities, plus remote roles', color: 'text-orange' },
];

export function Numbers() {
  return (
    <section className="px-5 py-[14vh]" aria-label="SkillLens in numbers">
      <div className="mx-auto grid max-w-[984px] gap-x-10 gap-y-14 sm:grid-cols-2 lg:grid-cols-4">
        {NUMBERS.map((n, i) => (
          <Reveal key={n.label} delay={i * 0.08}>
            <p className={`font-display text-[56px] font-semibold leading-none tracking-tighter2 md:text-[64px] ${n.color}`}>
              <CountUp value={n.value} />
            </p>
            <p className="mt-3 max-w-[22ch] text-[17px] leading-[1.4] text-graphite">{n.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

export function CallToAction({ signedIn, home = '/dashboard' }) {
  return (
    <section className="px-5 pb-[16vh] pt-[6vh] text-center" aria-labelledby="cta-title">
      <Reveal>
        <h2 id="cta-title" className="mx-auto max-w-[14ch] font-display text-[48px] font-semibold leading-[1.05] tracking-tighter2 text-ink md:text-[80px]">
          Know your worth. <span className="bg-[linear-gradient(90deg,#ff9500_0%,#ff2d55_35%,#af52de_68%,#007aff_100%)] bg-clip-text text-transparent">Then ask for it.</span>
        </h2>
      </Reveal>
      <Reveal delay={0.12}>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-6 text-[17px]">
          <Link
            to={signedIn ? home : '/auth?mode=signup'}
            className="rounded-full bg-action px-[22px] py-[11px] text-white transition-colors hover:bg-action-hover"
          >
            {signedIn ? 'Open dashboard' : 'Create a free account'}
          </Link>
          {!signedIn && (
            <Link to="/auth" className="group text-action-link hover:underline">
              Sign in
              <span aria-hidden="true" className="ml-0.5 inline-block transition-transform group-hover:translate-x-0.5">›</span>
            </Link>
          )}
        </div>
      </Reveal>
    </section>
  );
}

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="bg-mist px-5 py-10 text-[12px] text-graphite">
      <div className="mx-auto max-w-[984px]">
        <p className="border-b border-hairline pb-4 leading-[1.6]">
          Salary estimates come from models trained on salaries disclosed in Naukri.com postings from September and
          October 2025, and are a starting point, not an offer. Market fit on the resume page uses the same postings
          to show what employers ask for; they are not open jobs. AI resume reviews are written by Google Gemini after
          your name, phone, email and links are removed.{' '}
          <a href="https://www.kaggle.com/datasets/shivamshrivastava21/indian-job-market-dataset-2025-2026" target="_blank" rel="noopener noreferrer" className="underline">
            Indian Job Market Dataset 2025
          </a>{' '}by Shivam Shrivastava, CC BY-NC-SA 4.0.
        </p>
        <div className="flex flex-col gap-6 pt-6 md:flex-row md:items-start md:justify-between">
          <div className="text-[14px]"><Wordmark /></div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-16 gap-y-2 sm:grid-cols-3">
            <a href="#salary" className="hover:underline">Salary predictor</a>
            <a href="#resume" className="hover:underline">Resume analyzer</a>
            <a href="#jobs" className="hover:underline">Jobs (coming soon)</a>
            <a href="#hr" className="hover:underline">For HR teams</a>
            <Link to="/auth" className="hover:underline">Sign in</Link>
            <Link to="/auth?mode=signup" className="hover:underline">Create account</Link>
          </nav>
        </div>
        <p className="mt-8 text-silver">Copyright {year} SkillLens. All rights reserved.</p>
      </div>
    </footer>
  );
}
