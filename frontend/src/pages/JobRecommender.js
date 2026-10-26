import React from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { EASE, Marquee, Rise, Section } from '../components/ui/studio';

const COMING = [
  ['01', 'Fresh openings', 'Jobs posted in the last few weeks, from job boards and company career pages, not an old dataset.'],
  ['02', 'Ranked against your resume', 'Every opening scored on the skills, experience and city in your primary resume.'],
  ['03', 'Why it fits, and what to add', 'The skills you already have for each role, and the ones that would close the gap.'],
];

const ROLES = ['Backend Engineer', 'Data Analyst', 'Product Designer', 'DevOps Engineer', 'Java Developer',
  'Business Analyst', 'ML Engineer', 'Frontend Developer'];

/** Jobs page while live job search is being built. Matching against the expired 2025 dataset was removed. */
function JobRecommender() {
  const reduce = useReducedMotion();
  return (
    <AppShell toneName="purple">
      <PageHeader
        eyebrow="Jobs"
        title="Live job search is on its way."
        accent={3}
        subtitle="Fresh openings from across the web, ranked against your primary resume. We are building it now."
      >
        <motion.div
          className="mt-10 flex items-center gap-3 text-[15px] text-graphite"
          initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: EASE, delay: 0.6 }}
        >
          <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
            {!reduce && <span className="absolute inset-0 animate-pulsering rounded-full bg-purple" />}
            <span className="relative h-2.5 w-2.5 rounded-full bg-purple" />
          </span>
          Coming soon
        </motion.div>
      </PageHeader>

      <Rise className="-mx-6 mb-6 md:mb-10">
        <Marquee items={ROLES} />
      </Rise>

      <Section index="01" title="What is coming" note="Built on live job sources, so every role is one you can still apply to.">
        <ol>
          {COMING.map(([index, title, line], i) => (
            <Rise key={index} delay={i * 0.06}>
              <li className="grid grid-cols-[auto_1fr] gap-6 border-b border-black/[0.07] py-7 md:gap-10">
                <span className="font-display text-[28px] font-semibold tabular-nums text-black/15 md:text-[36px]">{index}</span>
                <div>
                  <p className="font-display text-[22px] font-semibold tracking-tight text-ink md:text-[28px]">{title}</p>
                  <p className="mt-1 max-w-[60ch] text-[16px] leading-[1.55] text-graphite">{line}</p>
                </div>
              </li>
            </Rise>
          ))}
        </ol>
      </Section>

      <Section index="02" title="Until then" note="See what employers ask for, using 2025 Naukri.com postings.">
        <p className="max-w-[60ch] text-[17px] leading-[1.6] text-ink">
          The resume page now shows your <span className="font-semibold">market fit</span>: for a role you choose, which skills
          Indian postings ask for and which of them your resume already shows.
        </p>
        <Link
          to="/resume-analyzer"
          className="group mt-6 inline-flex items-center gap-2 text-[17px] font-medium text-action-link"
        >
          Check your market fit
          <span aria-hidden="true" className="transition-transform duration-300 group-hover:translate-x-1">&rarr;</span>
        </Link>
      </Section>
    </AppShell>
  );
}

export default JobRecommender;
