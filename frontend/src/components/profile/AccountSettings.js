import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { csrf, errorMessage } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { Button, Notice } from '../ui/primitives';
import { Modal, useFeedback } from '../ui/overlays';
import { PasswordField, PasswordMatch, matchState } from '../ui/PasswordField';

const FIELD = 'block w-full rounded-xl border bg-white px-4 py-3 text-[16px] text-ink placeholder:text-silver transition focus:outline-none focus:ring-4';
const TONE = {
  normal: 'border-hairline focus:border-action focus:ring-action/15',
  match: 'border-green focus:border-green focus:ring-green/20',
  mismatch: 'border-red focus:border-red focus:ring-red/15',
};

/** Change the password: other devices are signed out, this one stays signed in. */
function ChangePassword() {
  const { notify } = useFeedback();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [again, setAgain] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const match = matchState(next, again);

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (next !== again) { setError('The two new passwords are different.'); return; }
    setSaving(true);
    try {
      const { data } = await api.post('/profile/change-password', { current_password: current, new_password: next });
      csrf.save(data); // this device gets fresh tokens; every other device is signed out
      setCurrent(''); setNext(''); setAgain('');
      notify('Password changed. Other devices were signed out.');
    } catch (err) {
      setError(errorMessage(err, 'Could not change the password'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={submit} className="max-w-[440px] space-y-3">
      <p className="font-display text-[21px] font-semibold tracking-tight text-ink">Change password</p>
      {error && <Notice>{error}</Notice>}
      <PasswordField id="current-password" label="Current password" required autoComplete="current-password"
        placeholder="Current password" className={`${FIELD} ${TONE.normal}`} value={current} onChange={(e) => setCurrent(e.target.value)} />
      <PasswordField id="new-password" label="New password" required minLength={8} autoComplete="new-password"
        placeholder="New password (8+ characters)" className={`${FIELD} ${TONE.normal}`} value={next} onChange={(e) => setNext(e.target.value)} />
      <div>
        <PasswordField id="new-password-again" label="Confirm new password" required autoComplete="new-password"
          placeholder="Confirm new password" invalid={match === 'mismatch'} describedBy="new-password-match"
          className={`${FIELD} ${TONE[match === 'match' || match === 'mismatch' ? match : 'normal']}`}
          value={again} onChange={(e) => setAgain(e.target.value)} />
        <PasswordMatch id="new-password-match" state={match} />
      </div>
      <Button type="submit" variant="dark" loading={saving} className="!mt-5">Change password</Button>
    </form>
  );
}

/** Delete the account and everything in it, after typing the password once more. */
function DeleteAccount() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(false);

  const close = () => { setOpen(false); setPassword(''); setError(''); };

  const remove = async (e) => {
    e?.preventDefault();
    setDeleting(true);
    setError('');
    try {
      await api.post('/profile/delete', { password });
      await logout();
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not delete the account'));
      setDeleting(false);
    }
  };

  return (
    <div className="max-w-[560px]">
      <p className="font-display text-[21px] font-semibold tracking-tight text-red-ink">Delete account</p>
      <p className="mt-2 text-[15px] leading-[1.6] text-graphite">
        Removes your profile, every resume and its file, AI reviews, cover letters, job searches and history. This cannot be undone.
      </p>
      <Button variant="danger" className="mt-4" onClick={() => setOpen(true)}>Delete my account</Button>

      <Modal
        open={open} onClose={close} title="Delete your account?" size="sm"
        footer={(
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={close} disabled={deleting}>Cancel</Button>
            <Button variant="danger" onClick={remove} loading={deleting} disabled={!password}>Delete for good</Button>
          </div>
        )}
      >
        <form onSubmit={remove} className="space-y-4">
          <p className="text-[15px] leading-[1.5] text-graphite">Everything is deleted at once. Type your password to confirm.</p>
          {error && <Notice>{error}</Notice>}
          <PasswordField id="delete-password" label="Password" required autoComplete="current-password" placeholder="Your password"
            className={`${FIELD} ${TONE.normal}`} value={password} onChange={(e) => setPassword(e.target.value)} />
        </form>
      </Modal>
    </div>
  );
}

function AccountSettings() {
  return (
    <div className="grid gap-14 lg:grid-cols-2">
      <ChangePassword />
      <DeleteAccount />
    </div>
  );
}

export default AccountSettings;
