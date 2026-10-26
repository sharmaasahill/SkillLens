import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { homeFor } from '../components/ProtectedRoute';
import { LensMark } from '../components/ui/studio';
import { PasswordField, PasswordMatch, matchState } from '../components/ui/PasswordField';

const FIELD = 'block w-full rounded-xl border bg-white px-4 py-3.5 text-[17px] text-ink placeholder:text-silver transition focus:outline-none focus:ring-4';
// The confirm field's border turns green when both passwords match and red when they differ
const FIELD_TONE = {
  normal: 'border-hairline focus:border-action focus:ring-action/15',
  match: 'border-green focus:border-green focus:ring-green/20',
  mismatch: 'border-red focus:border-red focus:ring-red/15',
};

function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const confirmRef = useRef(null);
  const navigate = useNavigate();
  const { user, loading: sessionLoading, login, register } = useAuth();

  // The sign-in page follows the landing page's light look
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => { if (hadDark) root.classList.add('dark'); };
  }, []);


  const match = matchState(password, confirm);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isLogin && password !== confirm) {
      setError('The two passwords are different. Type the same password in both fields.');
      confirmRef.current?.focus();
      return;
    }
    setLoading(true);

    try {
      // The admin email lands on the admin dashboard, everyone else on their dashboard
      const account = isLogin ? await login(email, password) : await register(email, password, fullName);
      navigate(homeFor(account), { replace: true });
    } catch (err) {
      setError(err.response?.status === 401 ? 'Invalid email or password' : errorMessage(err, 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  // Already signed in (e.g. returning visitor with a valid session cookie)
  if (!sessionLoading && user) {
    return <Navigate to={homeFor(user)} replace />;
  }

  const field = `${FIELD} ${FIELD_TONE.normal}`;
  const confirmTone = match === 'match' || match === 'mismatch' ? FIELD_TONE[match] : FIELD_TONE.normal;

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setConfirm('');
  };

  return (
    <div className="flex min-h-screen flex-col bg-white font-text text-ink antialiased">
      <header className="mx-auto flex h-12 w-full max-w-[1024px] items-center px-5">
        <Link to="/" className="group" aria-label="SkillLens home">
          <LensMark className="h-6 w-6 transition-transform duration-700 ease-apple group-hover:rotate-[200deg]" />
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
            <PasswordField
              id="password" name="password" label="Password" required
              minLength={isLogin ? undefined : 8}
              autoComplete={isLogin ? 'current-password' : 'new-password'}
              className={field} placeholder={isLogin ? 'Password' : 'Password (8+ characters)'}
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            {!isLogin && (
              <div>
                <PasswordField
                  ref={confirmRef}
                  id="confirmPassword" name="confirmPassword" label="Confirm password" required
                  autoComplete="new-password" placeholder="Confirm password"
                  className={`${FIELD} ${confirmTone}`}
                  invalid={match === 'mismatch'} describedBy="password-match"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)}
                />
                <PasswordMatch id="password-match" state={match} />
              </div>
            )}
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
            <button type="button" onClick={switchMode} className="text-action-link hover:underline">
              {isLogin ? 'Create an account' : 'Sign in'}
            </button>
          </p>
        </div>
      </main>
    </div>
  );
}

export default Auth; 