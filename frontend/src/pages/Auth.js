import React, { useEffect, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../api';
import { useAuth } from '../contexts/AuthContext';

function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginType, setLoginType] = useState('user'); // 'user' or 'hr'
  const navigate = useNavigate();
  const { user, loading: sessionLoading, login, register } = useAuth();

  // The sign-in page follows the landing page's light look
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => { if (hadDark) root.classList.add('dark'); };
  }, []);

  const homeFor = (account) => (account.is_admin ? '/hr-dashboard' : '/dashboard');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const account = isLogin
        ? await login(email, password, loginType === 'hr' ? 'hr' : 'candidate')
        : await register(email, password, fullName);
      navigate(homeFor(account), { replace: true });
    } catch (err) {
      const msg = errorMessage(err, 'An error occurred');
      // The backend gives clear messages for wrong-side login, so show them as-is
      if (err.response?.status === 403) {
        setError(msg);
      } else if (err.response?.status === 401) {
        setError('Invalid email or password');
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Already signed in (e.g. returning visitor with a valid session cookie)
  if (!sessionLoading && user) {
    return <Navigate to={homeFor(user)} replace />;
  }

  const field = 'block w-full rounded-xl border border-hairline bg-white px-4 py-3.5 text-[17px] text-ink placeholder:text-silver transition focus:border-action focus:outline-none focus:ring-4 focus:ring-action/15';

  return (
    <div className="flex min-h-screen flex-col bg-white font-text text-ink antialiased">
      <header className="mx-auto flex h-12 w-full max-w-[1024px] items-center px-5">
        <Link to="/" className="font-display text-[17px] font-semibold tracking-tight text-ink">
          Skill<span className="text-graphite">Lens</span>
        </Link>
      </header>

      <main className="relative flex flex-1 items-center justify-center overflow-hidden px-6 pb-20">
        <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-[38%] h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_200deg,#ff9500,#ff2d55,#af52de,#007aff,#30b0c7,#34c759,#ff9500)] opacity-[0.14] blur-[90px]" />
        <div className="relative w-full max-w-[400px] rounded-[28px] bg-white/80 p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)] ring-1 ring-black/[0.05] backdrop-blur-xl sm:p-10">
          <h1 className="text-center font-display text-[40px] font-semibold leading-[1.1] tracking-tight">
            {isLogin ? 'Sign in to SkillLens' : 'Create your account'}
          </h1>
          <p className="mt-3 text-center text-[17px] text-graphite">
            {isLogin ? 'Welcome back.' : 'Free, and takes less than a minute.'}
          </p>

          {isLogin && (
            <div className="mx-auto mt-8 flex w-fit rounded-full bg-mist p-1" role="group" aria-label="Account type">
              {[['user', 'Candidate'], ['hr', 'HR team']].map(([type, label]) => (
                <button
                  key={type}
                  type="button"
                  aria-pressed={loginType === type}
                  onClick={() => { setLoginType(type); setEmail(''); setPassword(''); }}
                  className={`rounded-full px-5 py-1.5 text-[14px] transition ${
                    loginType === type ? 'bg-white text-ink shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : 'text-graphite hover:text-ink'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          <form className="mt-8 space-y-3" onSubmit={handleSubmit}>
            {error && (
              <div className="rounded-xl bg-[#fff2f0] px-4 py-3 text-[15px] text-[#bf1d00]" role="alert">
                {error}
              </div>
            )}
            {!isLogin && (
              <div>
                <label htmlFor="fullName" className="sr-only">Full Name</label>
                <input id="fullName" name="fullName" type="text" required autoComplete="name"
                  className={field} placeholder="Full name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
              </div>
            )}
            <div>
              <label htmlFor="email" className="sr-only">Email address</label>
              <input id="email" name="email" type="email" required autoComplete="email"
                className={field} placeholder="Email address" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">Password</label>
              <input id="password" name="password" type="password" required
                minLength={isLogin ? undefined : 8}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                className={field} placeholder={isLogin ? 'Password' : 'Password (8+ characters)'}
                value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="!mt-6 w-full rounded-xl bg-action py-3.5 text-[17px] font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-60"
            >
              {loading ? 'Please wait...' : (isLogin ? 'Sign in' : 'Create account')}
            </button>
          </form>

          <p className="mt-8 text-center text-[15px] text-graphite">
            {isLogin ? 'New to SkillLens? ' : 'Already have an account? '}
            <button type="button" onClick={() => { setIsLogin(!isLogin); setError(''); }} className="text-action-link hover:underline">
              {isLogin ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

export default Auth; 