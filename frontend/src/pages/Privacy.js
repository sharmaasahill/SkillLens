import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { LensMark } from '../components/ui/studio';
import { useSiteInfo } from '../lib/siteInfo';

const UPDATED = 'October 2026';

function Block({ title, children }) {
  return (
    <section className="border-t border-hairline py-10">
      <h2 className="font-display text-[26px] font-semibold tracking-tight text-ink md:text-[30px]">{title}</h2>
      <div className="mt-4 space-y-4 text-[17px] leading-[1.65] text-graphite">{children}</div>
    </section>
  );
}

function List({ items }) {
  return (
    <ul className="space-y-2.5">
      {items.map(([label, text]) => (
        <li key={label} className="flex gap-3">
          <span className="mt-[11px] h-1.5 w-1.5 shrink-0 rounded-full bg-action" aria-hidden="true" />
          <span><span className="font-medium text-ink">{label}.</span> {text}</span>
        </li>
      ))}
    </ul>
  );
}

/** What SkillLens collects, why, who handles it, how long it is kept, and your rights. */
function Privacy() {
  const site = useSiteInfo();
  useEffect(() => {
    document.title = 'Privacy Policy - SkillLens';
    return () => { document.title = 'SkillLens'; };
  }, []);

  const contact = site.contact_email
    ? <a href={`mailto:${site.contact_email}`} className="text-action-link hover:underline">{site.contact_email}</a>
    : 'the contact email shown here once it is set up';

  return (
    <div className="min-h-screen bg-white font-text text-ink antialiased">
      <header className="mx-auto flex h-12 w-full max-w-[1024px] items-center justify-between px-5">
        <Link to="/" className="group" aria-label="SkillLens home">
          <LensMark className="h-6 w-6 transition-transform duration-700 ease-apple group-hover:rotate-[200deg]" />
        </Link>
        <Link to="/auth" className="text-[14px] text-action-link hover:underline">Sign in</Link>
      </header>

      <main className="mx-auto max-w-[760px] px-6 pb-24 pt-14">
        <p className="text-[17px] font-semibold text-blue-ink">Privacy Policy</p>
        <h1 className="mt-2 font-display text-[44px] font-semibold leading-[1.08] tracking-tighter2 md:text-[60px]">Your data, plainly explained.</h1>
        <p className="mt-6 text-[19px] leading-[1.6] text-graphite">
          SkillLens helps you estimate your salary, improve your resume and find jobs in India. This page says what we
          collect, why, who else handles it, how long we keep it, and what you can do about it. Last updated {UPDATED}.
        </p>

        <Block title="What we collect">
          <List items={[
            ['Account', 'your email, your name, and your password (stored only as a one-way hash we cannot read). If you sign in with Google, we receive your name, email and Google account id, never your Google password.'],
            ['Profile', 'anything you choose to fill in: phone, address, age, current role and company, location, experience, education, skills, links and a short bio.'],
            ['Resumes', 'the PDF files you upload, the text read from them, and their scores and skills. Up to five at a time.'],
            ['What you ask', 'job descriptions you paste for a match, the role and city of job searches, and the inputs of salary estimates.'],
            ['AI answers', 'AI reviews and cover letters we write for you, saved so asking again is free.'],
            ['Technical', 'sign-in cookies, daily usage counts, and error reports (the page, the error message and your browser type) so we can fix problems.'],
          ]}
          />
        </Block>

        <Block title="Why we use it">
          <p>
            Only to run SkillLens for you: to score resumes, estimate salaries, rank jobs against your skills, keep your
            library and history, keep accounts safe, and fix errors. We do not sell your data, show ads, or use tracking
            or advertising cookies.
          </p>
        </Block>

        <Block title="Who can see it">
          <p>
            You. And one SkillLens administrator, who can see profiles and resumes to run and protect the service (for
            example, to stop misuse). The admin account is protected by two-factor sign-in. Nobody else at SkillLens has access.
          </p>
        </Block>

        <Block title="Services that handle it for us">
          <List items={[
            ['Hosting', 'the app runs on Render and the database on Neon, on servers in Singapore. Data is sent over HTTPS.'],
            ['Google Gemini (AI)', 'only when you press AI review or Write cover letter. Your name, phone numbers, email and links are removed from the resume first. SkillLens uses Gemini\'s free tier, under which Google may use what is sent to improve its products.'],
            ['Job sources', 'only the role, city and date range of a search are sent (to Google for Jobs, Adzuna, Jooble, Careerjet, TheirStack, Apify and company career pages). Never your resume.'],
            ['Google sign-in', 'if you choose it, Google tells us who you are. See Google\'s own privacy policy for what Google keeps.'],
          ]}
          />
        </Block>

        <Block title="How long we keep it">
          <List items={[
            ['Your account and resumes', 'until you delete them. Deleting the account removes everything at once.'],
            ['Cached job results', 'about a week.'],
            ['Error reports', 'until fixed, then 30 days.'],
            ['Backups', 'kept encrypted for up to 30 days, then deleted.'],
          ]}
          />
        </Block>

        <Block title="Your rights">
          <p>Under India&apos;s Digital Personal Data Protection Act, 2023, you can:</p>
          <List items={[
            ['See and correct', 'everything about you on the Profile and Overview pages, and edit it at any time.'],
            ['Delete', 'your account and all its data: Profile, then Account, then Delete my account. It happens immediately.'],
            ['Withdraw consent', 'by deleting your account. Remove single resumes from the Overview page.'],
            ['Ask or complain', <>write to {contact}. We reply within 30 days.</>],
          ]}
          />
        </Block>

        <Block title="Keeping it safe">
          <p>
            HTTPS everywhere, hashed passwords, sign-in cookies that page scripts cannot read, protection against
            cross-site requests, limits on repeated sign-in attempts, two-factor sign-in for the admin, and encrypted backups.
            No system is perfectly secure, so we will tell affected users promptly if a breach ever happens.
          </p>
        </Block>

        <Block title="Children">
          <p>SkillLens is meant for people aged 18 or older. Please do not create an account if you are younger.</p>
        </Block>

        <Block title="Changes">
          <p>If this policy changes in a way that matters, the date above changes and signed-in users are told on the site.</p>
        </Block>

        <p className="border-t border-hairline pt-8 text-[15px] text-silver">
          <Link to="/" className="text-action-link hover:underline">Back to SkillLens</Link>
        </p>
      </main>
    </div>
  );
}

export default Privacy;
