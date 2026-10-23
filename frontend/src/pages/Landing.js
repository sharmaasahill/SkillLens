import React, { useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { homeFor } from '../components/ProtectedRoute';
import GlobalNav from '../components/landing/GlobalNav';
import Hero from '../components/landing/Hero';
import Statement from '../components/landing/Statement';
import SalarySection from '../components/landing/SalarySection';
import ResumeSection from '../components/landing/ResumeSection';
import JobsSection from '../components/landing/JobsSection';
import HRSection from '../components/landing/HRSection';
import { CallToAction, Footer, Numbers } from '../components/landing/Closing';

/** Public marketing page. Always light, whatever theme the app itself uses. */
function Landing() {
  const { user } = useAuth();
  const signedIn = Boolean(user);
  const home = homeFor(user);

  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.remove('dark');
    root.style.scrollBehavior = 'smooth';
    document.title = 'SkillLens - Know what your skills are worth';
    return () => {
      if (hadDark) root.classList.add('dark');
      root.style.scrollBehavior = '';
      document.title = 'SkillLens';
    };
  }, []);

  return (
    <div className="min-h-screen bg-white font-text text-ink antialiased selection:bg-action/20">
      <a href="#salary" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-14 focus:z-[60] focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:shadow">
        Skip to content
      </a>
      <GlobalNav signedIn={signedIn} home={home} />
      <main>
        <Hero signedIn={signedIn} home={home} />
        <Statement />
        <SalarySection />
        <ResumeSection />
        <JobsSection />
        <HRSection />
        <Numbers />
        <CallToAction signedIn={signedIn} home={home} />
      </main>
      <Footer />
    </div>
  );
}

export default Landing;
