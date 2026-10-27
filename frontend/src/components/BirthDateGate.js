import React, { useState } from 'react';
import api, { errorMessage } from '../api';
import { useAuth } from '../contexts/AuthContext';
import { LensMark } from './ui/studio';
import { birthDateBounds } from '../lib/format';

/**
 * Shown once to accounts that have no date of birth yet (Google sign-ups and accounts made
 * before sign-up asked for it). SkillLens is for people aged 18 or older, so it is needed to go on.
 */
function BirthDateGate() {
  const { refreshUser, logout } = useAuth();
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const born = birthDateBounds();

  const save = async (e) => {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.put('/update-profile', { date_of_birth: dateOfBirth });
      await refreshUser();  // the account no longer needs a date of birth, so the page opens
    } catch (err) {
      setError(errorMessage(err, 'Could not save your date of birth. Try again.'));
      setSaving(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-6 py-16 font-text text-ink antialiased">
      <div className="w-full max-w-[400px] rounded-[28px] bg-white p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.25)] ring-1 ring-black/[0.05] sm:p-10">
        <LensMark className="mx-auto h-8 w-8" />
        <h1 className="mt-5 text-center font-display text-[32px] font-semibold leading-[1.1] tracking-tight">One more thing</h1>
        <p className="mt-3 text-center text-[16px] leading-[1.5] text-graphite">
          Add your date of birth to keep using SkillLens. It is only used to check that you are 18 or older.
        </p>
        <form className="mt-8 space-y-3" onSubmit={save}>
          {error && <div className="rounded-xl bg-[#fff2f0] px-4 py-3 text-[15px] text-[#bf1d00]" role="alert">{error}</div>}
          <label htmlFor="gate-dob" className="mb-1.5 block px-1 text-[13px] text-graphite">Date of birth</label>
          <input
            id="gate-dob" name="dateOfBirth" type="date" required autoComplete="bday" min={born.min} max={born.max}
            value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)}
            className="block w-full rounded-xl border border-hairline bg-white px-4 py-3.5 text-[17px] text-ink transition focus:border-action focus:outline-none focus:ring-4 focus:ring-action/15"
          />
          <button type="submit" disabled={saving} className="!mt-6 w-full rounded-xl bg-action py-3.5 text-[17px] font-medium text-white transition-colors hover:bg-action-hover disabled:opacity-60">
            {saving ? 'Saving...' : 'Continue'}
          </button>
        </form>
        <p className="mt-6 text-center text-[14px]">
          <button type="button" onClick={logout} className="text-graphite hover:text-ink">Sign out</button>
        </p>
      </div>
    </div>
  );
}

export default BirthDateGate;
