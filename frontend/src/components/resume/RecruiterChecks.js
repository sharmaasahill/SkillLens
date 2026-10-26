import React from 'react';
import { Rise, Section } from '../ui/studio';

function Finding({ tone = '#ff9500', title, children }) {
  return (
    <Rise amount={0.1}>
      <li className="grid grid-cols-[auto_1fr] gap-5 border-b border-black/[0.07] py-6 last:border-0">
        <span className="mt-2 h-2.5 w-2.5 rounded-full" style={{ background: tone }} aria-hidden="true" />
        <div>
          <p className="font-display text-[20px] font-semibold tracking-tight text-ink">{title}</p>
          <div className="mt-1 max-w-[70ch] text-[16px] leading-[1.55] text-graphite">{children}</div>
        </div>
      </li>
    </Rise>
  );
}

/** What a careful recruiter notices on a second read. Computed on the server without AI. */
function RecruiterChecks({ checks, index = '05' }) {
  if (!checks) return null;
  const { repeated_verbs: verbs = [], unproven_skills: unproven = [], timeline = [], first_person: firstPerson = 0 } = checks;
  const nothing = !verbs.length && !unproven.length && !timeline.length && !firstPerson;

  return (
    <Section index={index} title="Recruiter checks" note="Things a careful recruiter notices on a second read.">
      {nothing ? (
        <p className="text-[17px] text-graphite">Nothing to flag. Your bullets vary their verbs, your skills show up in your work, and your dates line up.</p>
      ) : (
        <ul>
          {verbs.map((v) => (
            <Finding key={v.verb} title={`${v.count} bullets start with "${v.verb}"`}>
              Recruiters skim the first word of each bullet, so repeats blur together. Swap some for verbs that say what you did:
              {' '}<span className="font-medium text-ink">{v.alternatives.join(', ')}</span>.
            </Finding>
          ))}
          {unproven.length > 0 && (
            <Finding title={`${unproven.length} skill${unproven.length === 1 ? '' : 's'} listed but never shown`}>
              These are in your skills list, but no job, project or achievement shows you using them. Interviewers often ask about exactly these.
              Add one line of proof for the ones that matter for your target role, or drop the ones you cannot talk about.
              <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1">
                {unproven.map((s) => <span key={s} className="font-display text-[17px] font-medium tracking-tight text-orange-ink">{s}</span>)}
              </p>
            </Finding>
          )}
          {timeline.map((t) => (
            <Finding key={t.text} tone={t.kind === 'overlap' ? '#007aff' : '#ff9500'} title={t.kind === 'overlap' ? 'Roles that overlap' : t.kind === 'gap' ? 'A gap between roles' : 'Two current roles'}>
              {t.text}
            </Finding>
          ))}
          {firstPerson > 0 && (
            <Finding tone="#86868b" title={`"I", "my" or "me" appears ${firstPerson} times`}>
              Most resume styles leave these out: &ldquo;Built a dashboard&rdquo; reads tighter than &ldquo;I built a dashboard&rdquo;.
            </Finding>
          )}
        </ul>
      )}
    </Section>
  );
}

export default RecruiterChecks;
