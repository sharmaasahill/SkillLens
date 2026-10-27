import React, { useEffect, useRef, useState } from 'react';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../api';
import { API_URL } from '../config';
import { useAuth } from '../contexts/AuthContext';
import { homeFor } from '../components/ProtectedRoute';
import { LensMark } from '../components/ui/studio';
import { PasswordField, PasswordMatch, matchState } from '../components/ui/PasswordField';
import { useSiteInfo } from '../lib/siteInfo';

const FIELD = 'block w-full rounded-xl border bg-white px-4 py-3.5 text-[17px] text-ink placeholder:text-silver transition focus:outline-none focus:ring-4';
// The confirm field's border turns green when both passwords match and red when they differ
const FIELD_TONE = {
  normal: 'border-hairline focus:border-action focus:ring-action/15',
  match: 'border-green focus:border-green focus:ring-green/20',
  mismatch: 'border-red focus:border-red focus:ring-red/15',
};

// Why Google sign-in sent the person back (?error=google_<code>)
const GOOGLE_ERRORS = {
  google_cancelled: 'Google sign-in was cancelled. Try again, or use your email and password.',
  google_state: 'That sign-in link expired. Press Continue with Google again.',
  google_failed: 'Google sign-in did not work just now. Try again in a minute.',
  google_unverified: 'Your Google email is not verified yet. Verify it with Google, or sign up with email.',
  google_blocked: 'This account has been blocked. Contact SkillLens support if you think this is a mistake.',
  google_admin: 'The admin signs in with email, password and the authenticator code.',
  google_off: 'Google sign-in is not set up on this site yet.',
};

/** Google's own "G" mark, as its brand guidelines ask for on sign-in buttons. */
function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
    </svg>
  );
}

function Divider() {
  return (
    <div className="my-6 flex items-center gap-3 text-[13px] text-silver" aria-hidden="true">
      <span className="h-px flex-1 bg-hairline" />or<span className="h-px flex-1 bg-hairline" />
    </div>
  );
}

function Auth() {
  const [searchParams] = useSearchParams();
  const [isLogin, setIsLogin] = useState(searchParams.get('mode') !== 'signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fullName, setFullName] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState(GOOGLE_ERRORS[searchParams.get('error')] || '');
  const [loading, setLoading] = useState(false);
  // Admin two-factor step: the challenge from the password step, and the code typed now
  const [challenge, setChallenge] = useState('');
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const confirmRef = useRef(null);
  const codeRef = useRef(null);
  const navigate = useNavigate();
  const site = useSiteInfo();
  const { user, loading: sessionLoading, login, verifyTwoFactor, register } = useAuth();

  // The sign-in page follows the landing page's light look
  useEffect(() => {
    const root = document.documentElement;
    const hadDark = root.classList.contains('dark');
    root.classList.remove('dark');
    return () => { if (hadDark) root.classList.add('dark'); };
  }, []);

  useEffect(() => { if (challenge) codeRef.current?.focus(); }, [challenge, useRecovery]);

  const match = matchState(password, confirm);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    if (!isLogin && password !== confirm) {
      setError('The two passwords are different. Type the same password in both fields.');
      confirmRef.current?.focus();
      return;
    }
    if (!isLogin && !agreed) {
      setError('Tick the box to agree to the Privacy Policy.');
      return;
    }
    setLoading(true);

    try {
      if (isLogin) {
        const result = await login(email, password);
        if (result.twoFactor) {
          setChallenge(result.twoFactor);
          return;
        }
        // The admin email lands on the admin dashboard, everyone else on their dashboard
        navigate(homeFor(result), { replace: true });
      } else {
        navigate(homeFor(await register(email, password, fullName, agreed)), { replace: true });
      }
    } catch (err) {
      setError(err.response?.status === 401 ? 'Invalid email or password' : errorMessage(err, 'An error occurred'));
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { user: account } = await verifyTwoFactor(challenge, code);
      navigate(homeFor(account), { replace: true });
    } catch (err) {
      if (err.response?.status === 401 && /sign in again/i.test(errorMessage(err, ''))) {
        setChallenge('');  // the 5 minutes ran out: back to the password step
      }
      setError(errorMessage(err, 'That code did not work'));
      setCode('');
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
  const googleHref = `${API_URL}/auth/google/start?mode=${isLogin ? 'signin' : 'signup'}`;

  const switchMode = () => {
    setIsLogin(!isLogin);
    setError('');
    setConfirm('');
  };

  const errorBox = error && (
    <div className="rounded-xl bg-[#fff2f0] px-4 py-3 text-[15px] text-[#bf1d00]" role="alert">{error}</div>
  );

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
          {challenge ? (
            <>
              <h1 className="text-center font-display text-[34px] font-semibold leading-[1.1] tracking-tight">Two-factor sign-in</h1>
              <p className="mt-3 text-center text-[16px] leading-[1.5] text-graphite">
                {useRecovery
                  ? 'Type one of the recovery codes you saved. Each one works once.'
                  : 'Open Google Authenticator and type the 6-digit code for SkillLens.'}
              </p>
              <form className="mt-8 space-y-3" onSubmit={submitCode}>
                {errorBox}
                <label htmlFor="code" className="sr-only">{useRecovery ? 'Recovery code' : 'Authenticator code'}</label>
                <input
                  ref={codeRef} id="code" name="code" required value={code} onChange={(e) => setCode(e.target.value)}
                  inputMode={useRecovery ? 'text' : 'numeric'} autoComplete="one-time-code" maxLength={useRecovery ? 11 : 6}
                  pattern={useRecovery ? undefined : '[0-9]{6}'} placeholder={useRecovery ? 'xxxxx-xxxxx' : '123456'}
                  className={`${field} text-center font-display text-[26px] tracking-[0.3em] tabular-nums`}
                />
                <button type="submit" disabled={loading} className="!mt-6 w-full rounded-xl bg-action py-3.5 text-[17px] font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-60">
                  {loading ? 'Checking...' : 'Verify'}
                </button>
              </form>
              <div className="mt-6 flex justify-between text-[14px]">
                <button type="button" onClick={() => { setUseRecovery((v) => !v); setCode(''); setError(''); }} className="text-action-link hover:underline">
                  {useRecovery ? 'Use the app code' : 'Use a recovery code'}
                </button>
                <button type="button" onClick={() => { setChallenge(''); setCode(''); setError(''); }} className="text-graphite hover:text-ink">Back</button>
              </div>
            </>
          ) : (
            <>
              <h1 className="text-center font-display text-[40px] font-semibold leading-[1.1] tracking-tight">
                {isLogin ? 'Sign in to SkillLens' : 'Create your account'}
              </h1>
              <p className="mt-3 text-center text-[17px] text-graphite">
                {isLogin ? 'Welcome back.' : 'Free, and takes less than a minute.'}
              </p>

              <form className="mt-8 space-y-3" onSubmit={handleSubmit}>
                {errorBox}
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
                {!isLogin && (
                  <label className="!mt-4 flex items-start gap-3 text-[14px] leading-[1.5] text-graphite">
                    <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} className="mt-0.5 h-4 w-4 shrink-0 accent-[#0071e3]" />
                    <span>
                      I agree to the <Link to="/privacy" target="_blank" className="text-action-link hover:underline">Privacy Policy</Link>,
                      including how my resume is analysed and stored.
                    </span>
                  </label>
                )}
                <button
                  type="submit"
                  disabled={loading}
                  className="!mt-6 w-full rounded-xl bg-action py-3.5 text-[17px] font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-60"
                >
                  {loading ? 'Please wait...' : (isLogin ? 'Sign in' : 'Create account')}
                </button>
              </form>

              {site.google_sign_in && (
                <>
                  <Divider />
                  <a
                    href={googleHref}
                    className="flex w-full items-center justify-center gap-3 rounded-xl border border-hairline bg-white py-3 text-[16px] font-medium text-ink transition hover:bg-mist focus:outline-none focus-visible:ring-4 focus-visible:ring-action/15"
                  >
                    <GoogleMark />
                    Continue with Google
                  </a>
                  <p className="mt-3 text-center text-[12px] leading-[1.5] text-silver">
                    New here? Continuing with Google creates your account under our{' '}
                    <Link to="/privacy" target="_blank" className="underline hover:text-graphite">Privacy Policy</Link>.
                  </p>
                </>
              )}

              <p className="mt-8 text-center text-[15px] text-graphite">
                {isLogin ? 'New to SkillLens? ' : 'Already have an account? '}
                <button type="button" onClick={switchMode} className="text-action-link hover:underline">
                  {isLogin ? 'Create an account' : 'Sign in'}
                </button>
              </p>
              <p className="mt-3 text-center text-[13px] text-silver">
                <Link to="/privacy" className="hover:underline">Privacy Policy</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

export default Auth;
