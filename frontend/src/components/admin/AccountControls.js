import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import api, { errorMessage } from '../../api';
import { Button, cx } from '../ui/primitives';
import { Modal, useFeedback } from '../ui/overlays';

/**
 * Block or unblock sign-in, give a temporary password, or delete the account. Each step says
 * exactly what will happen first, because blocking and resets sign the person out at once.
 */
function AccountControls({ user, onBlocked, onDeleted }) {
  const { notify, confirm } = useFeedback();
  const [busy, setBusy] = useState('');
  const [temporary, setTemporary] = useState('');
  const name = user.full_name || user.email;

  const run = async (key, action) => {
    setBusy(key);
    try {
      await action();
    } catch (err) {
      notify(errorMessage(err, 'That did not work. Try again.'), 'error');
    } finally {
      setBusy('');
    }
  };

  const toggleBlock = () => run('block', async () => {
    if (!user.blocked) {
      const ok = await confirm({
        title: `Block ${name}?`,
        message: 'They are signed out everywhere at once and cannot sign in again until you unblock them. Their data stays.',
        confirmLabel: 'Block', destructive: true,
      });
      if (!ok) return;
    }
    const { data } = await api.post(`/api/admin/users/${user.id}/${user.blocked ? 'unblock' : 'block'}`);
    onBlocked(user.id, data);
    notify(data.blocked ? `${name} is blocked` : `${name} can sign in again`);
  });

  const resetPassword = () => run('reset', async () => {
    const ok = await confirm({
      title: `Reset ${name}'s password?`,
      message: 'Their current password stops working and they are signed out. You get a temporary password to send them; they can change it on their Profile page.',
      confirmLabel: 'Reset password',
    });
    if (!ok) return;
    const { data } = await api.post(`/api/admin/users/${user.id}/reset-password`);
    setTemporary(data.temporary_password);
  });

  const remove = () => run('delete', async () => {
    const ok = await confirm({
      title: `Delete ${name}'s account?`,
      message: 'Their profile, every resume and its file, AI answers, job searches and history are deleted for good. This cannot be undone.',
      confirmLabel: 'Delete account', destructive: true,
    });
    if (!ok) return;
    await api.delete(`/api/admin/users/${user.id}`);
    notify(`${name}'s account was deleted`);
    onDeleted(user.id);
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(temporary);
      notify('Temporary password copied');
    } catch (err) {
      notify('Select the password and copy it yourself', 'info');
    }
  };

  return (
    <>
      {user.blocked && (
        <p className="mb-5 flex items-center gap-2 text-[14px] font-medium text-red-ink">
          <span className="h-2 w-2 rounded-full bg-red" aria-hidden="true" />
          Blocked{user.blocked_at ? ` since ${new Date(user.blocked_at).toLocaleDateString('en-IN')}` : ''}. They cannot sign in.
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <Button size="sm" variant={user.blocked ? 'dark' : 'outline'} onClick={toggleBlock} loading={busy === 'block'} disabled={Boolean(busy)}>
          {user.blocked ? 'Unblock' : 'Block sign-in'}
        </Button>
        <Button size="sm" variant="outline" onClick={resetPassword} loading={busy === 'reset'} disabled={Boolean(busy)}>Reset password</Button>
        <Button size="sm" variant="danger" onClick={remove} loading={busy === 'delete'} disabled={Boolean(busy)}>Delete account</Button>
      </div>
      <p className="mt-3 text-[13px] leading-[1.5] text-silver">Remove from the list only hides someone here. These change the account itself.</p>

      {/* Shown above the page, not inside the sliding drawer (its movement would carry the dialog) */}
      {createPortal(
      <Modal
        open={Boolean(temporary)} onClose={() => setTemporary('')} title="Temporary password" size="sm"
        footer={(
          <div className="flex justify-end gap-3">
            <Button variant="secondary" onClick={copy}>Copy</Button>
            <Button onClick={() => setTemporary('')}>Done</Button>
          </div>
        )}
      >
        <p className="text-[15px] leading-[1.5] text-graphite">
          Send this to {name} privately. It is shown only once. They sign in with it, then change it on their Profile page.
        </p>
        <p className={cx('mt-5 select-all break-all rounded-2xl bg-mist px-5 py-4 text-center font-mono text-[22px] font-semibold tracking-wide text-ink')}>
          {temporary}
        </p>
      </Modal>,
      document.body,
      )}
    </>
  );
}

export default AccountControls;
