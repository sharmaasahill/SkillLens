import React, { useEffect, useState } from 'react';
import api, { errorMessage } from '../../api';
import { Button, Notice } from '../ui/primitives';
import { Modal, useFeedback } from '../ui/overlays';
import { PasswordField } from '../ui/PasswordField';
import { downloadBlob } from '../../lib/format';

const CODE_FIELD = 'block w-[9ch] rounded-xl border border-hairline bg-white px-3 py-2.5 text-center font-display text-[22px] tracking-[0.25em] tabular-nums text-ink focus:border-action focus:outline-none focus:ring-4 focus:ring-action/15';
const FIELD = 'block w-full rounded-xl border border-hairline bg-white px-4 py-3 text-[16px] text-ink focus:border-action focus:outline-none focus:ring-4 focus:ring-action/15';

function CodeInput({ value, onChange, id, label = 'Code from the app' }) {
  return (
    <>
      <label htmlFor={id} className="sr-only">{label}</label>
      <input
        id={id} value={value} onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        inputMode="numeric" autoComplete="one-time-code" placeholder="123456" className={CODE_FIELD}
      />
    </>
  );
}

/** The recovery codes, shown once, with copy and download. */
function RecoveryCodes({ codes, onDone }) {
  const { notify } = useFeedback();
  const text = `SkillLens admin recovery codes (each works once)\n\n${codes.join('\n')}\n`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); notify('Recovery codes copied'); } catch (e) { notify('Select the codes and copy them yourself', 'info'); }
  };
  return (
    <div>
      <Notice toneName="orange" className="mb-5">
        Save these somewhere safe, away from your phone (a password manager or a printed page). Each works once if you
        lose your phone. They will not be shown again.
      </Notice>
      <ol className="grid grid-cols-2 gap-x-8 gap-y-2 font-mono text-[17px] tabular-nums text-ink sm:grid-cols-4">
        {codes.map((c) => <li key={c} className="select-all">{c}</li>)}
      </ol>
      <div className="mt-6 flex flex-wrap gap-3">
        <Button variant="secondary" onClick={copy}>Copy</Button>
        <Button variant="secondary" onClick={() => downloadBlob(text, 'skilllens-recovery-codes.txt', 'text/plain')}>Download</Button>
        <Button onClick={onDone}>I have saved them</Button>
      </div>
    </div>
  );
}

/**
 * Two-factor sign-in for the admin with a free authenticator app. Steps: scan the QR code, type the
 * first code, save the recovery codes. Turning it off needs the password and a current code.
 */
function TwoFactorSetup({ onChange }) {
  const { notify } = useFeedback();
  const [status, setStatus] = useState(null);
  const [setup, setSetup] = useState(null);
  const [code, setCode] = useState('');
  const [codes, setCodes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [offOpen, setOffOpen] = useState(false);
  const [offPassword, setOffPassword] = useState('');
  const [offCode, setOffCode] = useState('');
  const [renewCode, setRenewCode] = useState('');

  const load = async () => {
    try {
      const { data } = await api.get('/api/admin/2fa');
      setStatus(data);
      onChange?.(data);
    } catch (e) { /* the rest of the page still works */ }
  };
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (action) => {
    setBusy(true);
    setError('');
    try { await action(); } catch (err) { setError(errorMessage(err, 'That did not work')); } finally { setBusy(false); }
  };

  const start = () => act(async () => {
    const { data } = await api.post('/api/admin/2fa/setup');
    setSetup(data);
    setCode('');
  });
  const confirm = (e) => {
    e.preventDefault();
    act(async () => {
      const { data } = await api.post('/api/admin/2fa/enable', { code });
      setSetup(null);
      setCodes(data.recovery_codes);
      setStatus(data);
      onChange?.(data);
      notify('Two-factor sign-in is on');
    });
  };
  const turnOff = (e) => {
    e?.preventDefault();
    act(async () => {
      const { data } = await api.post('/api/admin/2fa/disable', { password: offPassword, code: offCode });
      setStatus(data);
      onChange?.(data);
      setOffOpen(false); setOffPassword(''); setOffCode('');
      notify('Two-factor sign-in is off', 'info');
    });
  };
  const renew = (e) => {
    e.preventDefault();
    act(async () => {
      const { data } = await api.post('/api/admin/2fa/recovery-codes', { code: renewCode });
      setCodes(data.recovery_codes);
      setStatus(data);
      setRenewCode('');
    });
  };

  if (!status) return null;
  if (codes) return <RecoveryCodes codes={codes} onDone={() => setCodes(null)} />;

  if (setup) {
    return (
      <div className="grid gap-10 md:grid-cols-[auto_1fr] md:items-start">
        <img src={setup.qr} alt="QR code to scan with Google Authenticator" className="h-[220px] w-[220px] rounded-2xl bg-white p-2 ring-1 ring-black/[0.06]" />
        <div>
          <ol className="space-y-3 text-[16px] leading-[1.55] text-ink">
            <li><span className="font-semibold">1.</span> Install Google Authenticator (free, Android and iPhone), or any authenticator app.</li>
            <li><span className="font-semibold">2.</span> Tap <span className="font-medium">+</span>, then <span className="font-medium">Scan a QR code</span>, and scan this code.</li>
            <li><span className="font-semibold">3.</span> Type the 6-digit code the app shows for SkillLens.</li>
          </ol>
          <p className="mt-4 text-[13px] text-graphite">Cannot scan? Choose &quot;Enter a setup key&quot; and type: <span className="select-all font-mono text-ink">{setup.secret}</span></p>
          {error && <Notice className="mt-4">{error}</Notice>}
          <form onSubmit={confirm} className="mt-5 flex flex-wrap items-center gap-3">
            <CodeInput id="setup-code" value={code} onChange={setCode} />
            <Button type="submit" variant="dark" loading={busy} disabled={code.length !== 6}>Turn on</Button>
            <Button variant="secondary" onClick={() => { setSetup(null); setError(''); }} disabled={busy}>Cancel</Button>
          </form>
        </div>
      </div>
    );
  }

  if (!status.enabled) {
    return (
      <div className="max-w-[62ch]">
        <p className="text-[16px] leading-[1.6] text-graphite">
          Off. With it on, signing in as admin needs your password and a 6-digit code from Google Authenticator on your
          phone, so a leaked password alone cannot open the dashboard. The app is free.
        </p>
        {error && <Notice className="mt-4">{error}</Notice>}
        <Button className="mt-5" onClick={start} loading={busy}>Set up two-factor sign-in</Button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <p className="flex items-center gap-2 text-[16px] font-medium text-green-ink">
        <span className="h-2 w-2 rounded-full bg-green" aria-hidden="true" />
        On since {new Date(status.enabled_at).toLocaleDateString('en-IN')}. {status.recovery_codes_left} of 8 recovery codes left.
      </p>
      {error && <Notice>{error}</Notice>}
      <form onSubmit={renew} className="flex flex-wrap items-center gap-3">
        <span className="text-[15px] text-graphite">New recovery codes (the old ones stop working):</span>
        <CodeInput id="renew-code" value={renewCode} onChange={setRenewCode} />
        <Button type="submit" variant="outline" size="sm" loading={busy} disabled={renewCode.length !== 6}>Make new codes</Button>
      </form>
      <Button variant="danger" size="sm" onClick={() => setOffOpen(true)}>Turn off</Button>

      <Modal
        open={offOpen} onClose={() => setOffOpen(false)} title="Turn off two-factor sign-in?" size="sm"
        footer={(
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={() => setOffOpen(false)} disabled={busy}>Cancel</Button>
            <Button variant="danger" onClick={turnOff} loading={busy} disabled={!offPassword || offCode.length !== 6}>Turn off</Button>
          </div>
        )}
      >
        <form onSubmit={turnOff} className="space-y-4">
          <p className="text-[15px] leading-[1.5] text-graphite">The admin account will be protected by the password alone. Confirm with both:</p>
          <PasswordField id="off-password" label="Admin password" required autoComplete="current-password" placeholder="Admin password"
            className={FIELD} value={offPassword} onChange={(e) => setOffPassword(e.target.value)} />
          <CodeInput id="off-code" value={offCode} onChange={setOffCode} />
        </form>
      </Modal>
    </div>
  );
}

export default TwoFactorSetup;
