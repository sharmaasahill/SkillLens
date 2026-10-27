import React, { useCallback, useEffect, useId, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import api, { errorMessage } from '../api';
import AppShell from '../components/ui/AppShell';
import { Button, Notice, Skeleton, Spinner, cx } from '../components/ui/primitives';
import { useFeedback } from '../components/ui/overlays';
import { pdfError } from '../components/ui/Dropzone';
import { CountNumber, EASE, Orbit, RevealText, Rise, Section } from '../components/ui/studio';
import { editFormFrom, profileCompletion } from '../lib/careerStats';
import { WRAP, birthDateBounds, birthDateLabel, breakable, dateLabel, dateTimeLabel, downloadBlob } from '../lib/format';
import AccountSettings from '../components/profile/AccountSettings';

const SECTIONS = [
  {
    key: 'personal', index: '01', title: 'Personal', note: 'Private. Never shown on the public site.',
    fields: [
      { name: 'full_name', label: 'Full name', placeholder: 'Your full name' },
      { name: 'phone_number', label: 'Phone', type: 'tel', placeholder: '+91 98765 43210' },
      { name: 'date_of_birth', label: 'Date of birth', type: 'date', ...birthDateBounds() },
      { name: 'address', label: 'Address', placeholder: 'City, State' },
    ],
  },
  {
    key: 'professional', index: '02', title: 'Work', note: 'Shapes your salary estimate and job matches.',
    fields: [
      { name: 'current_work', label: 'Current role', placeholder: 'e.g. Senior Software Engineer' },
      { name: 'current_company', label: 'Company', placeholder: 'e.g. Infosys' },
      { name: 'current_location', label: 'City', placeholder: 'e.g. Bengaluru' },
      { name: 'total_experience', label: 'Experience', type: 'number', placeholder: '3.5', min: 0, max: 50, step: 0.5, suffix: 'years' },
    ],
  },
  {
    key: 'education', index: '03', title: 'Skills and education',
    fields: [
      { name: 'education', label: 'Education', placeholder: 'e.g. B.Tech Computer Science, VIT' },
      { name: 'skills_summary', label: 'Skills', multiline: 2, placeholder: 'e.g. Python, SQL, React, AWS' },
      { name: 'certifications', label: 'Certifications', multiline: 2, placeholder: 'e.g. AWS Solutions Architect' },
      { name: 'languages', label: 'Languages', placeholder: 'e.g. English, Hindi' },
      { name: 'achievements', label: 'Achievements', multiline: 3, placeholder: 'e.g. Cut report time by 40%' },
    ],
  },
  {
    key: 'links', index: '04', title: 'Links and bio',
    fields: [
      { name: 'linkedin_url', label: 'LinkedIn', type: 'url', placeholder: 'https://linkedin.com/in/you' },
      { name: 'website_url', label: 'Portfolio', type: 'url', placeholder: 'https://you.dev' },
      { name: 'bio', label: 'Bio', multiline: 3, placeholder: 'A short professional summary' },
    ],
  },
];

const INPUT = 'block w-full border-0 border-b border-black/15 bg-transparent px-0 py-1.5 text-[17px] text-ink placeholder:text-silver focus:border-action focus:outline-none focus:ring-0';

function Value({ field, value, age }) {
  if (value === null || value === undefined || String(value).trim() === '') return <span className="text-silver">Not added</span>;
  if (field.type === 'date') return <span>{birthDateLabel(value)}{age != null ? ` (${age} years)` : ''}</span>;
  if (field.type === 'url') {
    return <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-action-link hover:underline">{value.replace(/^https?:\/\/(www\.)?/, '')}</a>;
  }
  return <span className="whitespace-pre-line">{value}{field.suffix ? ` ${field.suffix}` : ''}</span>;
}

/** Spec-sheet rows: label on the left, value (or an underlined input when editing) on the right. */
function SpecSection({ section, profile, editing, form, onChange }) {
  return (
    <Section index={section.index} title={section.title} note={section.note}>
      <dl>
        {section.key === 'personal' && (
          <div className="grid gap-1 border-b border-black/[0.07] py-5 sm:grid-cols-[180px_1fr] sm:gap-8">
            <dt className="text-[14px] text-graphite">Email</dt>
            <dd className="text-[17px] text-ink">{profile.email}</dd>
          </div>
        )}
        {section.fields.map((field) => (
          <div key={field.name} className="grid gap-1 border-b border-black/[0.07] py-5 sm:grid-cols-[180px_1fr] sm:gap-8">
            <dt className="pt-0.5 text-[14px] text-graphite"><label htmlFor={`f-${field.name}`}>{field.label}</label></dt>
            <dd className="min-w-0 text-[17px] text-ink">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={editing ? 'edit' : 'view'} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.25, ease: EASE }}>
                  {editing ? (
                    field.multiline ? (
                      <textarea id={`f-${field.name}`} name={field.name} rows={field.multiline} value={form[field.name] ?? ''} onChange={onChange} placeholder={field.placeholder} className={cx(INPUT, 'resize-y')} />
                    ) : (
                      <input id={`f-${field.name}`} name={field.name} type={field.type || 'text'} min={field.min} max={field.max} step={field.step}
                        value={form[field.name] ?? ''} onChange={onChange} placeholder={field.placeholder} className={INPUT} />
                    )
                  ) : <Value field={field} value={profile[field.name]} age={profile.age} />}
                </motion.div>
              </AnimatePresence>
            </dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

function Profile() {
  const { notify } = useFeedback();
  const uploadId = useId();
  const [profile, setProfile] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [resumeUploading, setResumeUploading] = useState(false);
  const [resumeError, setResumeError] = useState('');

  const load = useCallback(async () => {
    const [p, h] = await Promise.all([api.get('/profile'), api.get('/profile/history')]);
    setProfile(p.data);
    setHistory(h.data.history || []);
    setForm(editFormFrom(p.data));
  }, []);

  useEffect(() => {
    load()
      .catch((err) => { if (err.response?.status !== 401) setError('Failed to load profile data'); })
      .finally(() => setLoading(false));
  }, [load]);

  const onChange = (e) => setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  const startEditing = () => { setForm(editFormFrom(profile)); setSaveError(''); setEditing(true); };
  const cancelEditing = () => { setForm(editFormFrom(profile)); setSaveError(''); setEditing(false); };

  const save = async () => {
    setSaving(true);
    setSaveError('');
    try {
      await api.put('/update-profile', form, { headers: { 'Content-Type': 'application/json' } });
      await load();
      setEditing(false);
      notify('Profile saved');
    } catch (err) {
      setSaveError(errorMessage(err, 'Failed to update profile'));
    } finally {
      setSaving(false);
    }
  };

  const uploadResume = async (file) => {
    const problem = pdfError(file);
    if (problem) { setResumeError(problem); return; }
    setResumeUploading(true);
    setResumeError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      await api.post('/profile/upload-resume', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      notify('Primary resume updated');
      await load();
    } catch (err) {
      setResumeError(errorMessage(err, 'Failed to upload resume'));
    } finally {
      setResumeUploading(false);
    }
  };

  const downloadResume = async () => {
    try {
      const response = await api.get('/profile/download-resume', { responseType: 'blob' });
      downloadBlob(response.data, profile.profile_resume_filename || 'resume.pdf');
    } catch (err) {
      notify('Failed to download resume', 'error');
    }
  };

  if (loading) {
    return (
      <AppShell toneName="orange">
        <div className="grid items-center gap-12 md:grid-cols-[1fr_auto]"><div className="space-y-4"><Skeleton className="h-20 w-2/3" /><Skeleton className="h-6 w-1/2" /></div><Skeleton className="h-[260px] w-[260px] !rounded-full" /></div>
      </AppShell>
    );
  }
  if (error || !profile) return <AppShell toneName="orange"><Notice>{error || 'Failed to load profile data'}</Notice></AppShell>;

  const completion = profileCompletion(profile);
  const role = [profile.current_work, profile.current_company].filter(Boolean).join(' at ');

  return (
    <AppShell toneName="orange">
      {/* Opening */}
      <div className="grid items-center gap-12 pb-16 md:grid-cols-[1fr_auto]">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <span className="h-px w-9 bg-orange" />
            <p className="text-[13px] font-semibold uppercase tracking-[0.14em] text-orange-ink">Profile</p>
          </div>
          <RevealText text={profile.full_name || 'Complete your profile'} accent={profile.full_name ? 0 : 1} toneName="orange"
            className="mt-5 font-display text-[48px] font-semibold leading-[1.02] tracking-tighter2 text-ink md:text-[84px]" />
          <p className="mt-5 text-[19px] text-graphite md:text-[21px]">{[role, profile.current_location].filter(Boolean).join(', ') || profile.email}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            {editing ? (
              <>
                <Button onClick={save} loading={saving}>Save changes</Button>
                <Button variant="secondary" onClick={cancelEditing} disabled={saving}>Cancel</Button>
              </>
            ) : (
              <Button variant="dark" onClick={startEditing}>Edit profile</Button>
            )}
          </div>
          {saveError && <Notice className="mt-5">{saveError}</Notice>}
        </div>
        <Rise className="mx-auto">
          {/* Completion itself sits in the ring, instead of a letter avatar */}
          <Orbit size={260} rings={[{ label: 'Profile complete', value: completion, a: '#ff9500', b: '#ff2d55' }]}>
            <span className="font-display text-[64px] font-semibold leading-none tracking-tighter2 text-ink">
              <CountNumber value={completion} /><span className="text-[26px] text-silver">%</span>
            </span>
            <span className="mt-2 text-[13px] font-medium uppercase tracking-[0.12em] text-orange-ink">Complete</span>
          </Orbit>
        </Rise>
      </div>

      {SECTIONS.map((section) => (
        <SpecSection key={section.key} section={section} profile={profile} editing={editing} form={form} onChange={onChange} />
      ))}

      <Section index="05" title="Primary resume" note={<>Used for salary and job matches. <Link to="/dashboard" className="text-action-link hover:underline">Manage all resumes</Link></>}>
        {profile.profile_resume_filename ? (
          <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-black/[0.07] pb-6">
            <div className="min-w-0">
              <p className={`font-display text-[20px] font-semibold leading-[1.25] tracking-tight md:text-[24px] ${WRAP}`}>{breakable(profile.profile_resume_filename)}</p>
              <p className="text-[14px] text-graphite">Added {profile.profile_resume_uploaded_at ? dateLabel(profile.profile_resume_uploaded_at) : 'recently'}</p>
            </div>
            <Button variant="outline" size="sm" onClick={downloadResume}>Download</Button>
          </div>
        ) : (
          <p className="border-b border-black/[0.07] pb-6 text-[16px] text-graphite">No primary resume yet. The one you add here becomes primary.</p>
        )}
        <label htmlFor={uploadId} className="group mt-2 flex cursor-pointer items-center gap-4 py-5">
          <input id={uploadId} type="file" accept=".pdf,application/pdf" className="sr-only" disabled={resumeUploading}
            onChange={(e) => { if (e.target.files[0]) uploadResume(e.target.files[0]); e.target.value = ''; }} />
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-ink text-white transition-colors group-hover:bg-orange">
            {resumeUploading ? <Spinner className="h-5 w-5" /> : <span className="text-[20px] leading-none">+</span>}
          </span>
          <span className="text-[16px] font-medium text-ink">{profile.profile_resume_filename ? 'Upload a new primary resume' : 'Add your resume'}</span>
        </label>
        {resumeError && <Notice>{resumeError}</Notice>}
      </Section>

      <Section index="06" title="History" note="Earlier versions of your profile, newest first.">
        {history.length > 0 ? (
          <ol className="relative ml-1.5 border-l border-black/[0.1]">
            {history.slice(0, 10).map((entry, i) => (
              <Rise key={`${entry.changed_at}-${i}`} delay={i * 0.04} as="li" className="relative pb-8 pl-8 last:pb-0">
                <span className="absolute -left-[5px] top-2 h-2.5 w-2.5 rounded-full bg-orange ring-4 ring-[#fbfbfd]" aria-hidden="true" />
                <p className="text-[13px] text-silver">{dateTimeLabel(entry.changed_at)}</p>
                <p className="mt-1 text-[17px] text-ink">{entry.full_name || 'No name'}{entry.current_work ? `, ${entry.current_work}` : ''}</p>
                <p className="text-[14px] text-graphite">{[entry.current_company, entry.current_location].filter(Boolean).join(', ') || 'No work details'}</p>
              </Rise>
            ))}
          </ol>
        ) : (
          <p className="text-[16px] text-graphite">Changes appear here after you edit your profile.</p>
        )}
      </Section>

      <Section index="07" title="Account" note={`Signed in as ${profile.email}${profile.google_linked ? ', linked to Google' : ''}.`}>
        <AccountSettings profile={profile} onChanged={() => load().catch(() => {})} />
      </Section>

      <AnimatePresence>
        {editing && (
          <motion.div
            className="fixed inset-x-0 bottom-6 z-40 mx-auto flex w-fit items-center gap-3 rounded-full bg-ink/90 p-2 pl-6 text-white shadow-[0_20px_60px_-15px_rgba(0,0,0,0.5)] backdrop-blur-xl"
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }} transition={{ duration: 0.4, ease: EASE }}
          >
            <span className="text-[14px]">Editing your profile</span>
            <button type="button" onClick={cancelEditing} className="rounded-full px-4 py-2 text-[14px] text-white/70 hover:text-white">Cancel</button>
            <button type="button" onClick={save} disabled={saving} className="rounded-full bg-white px-5 py-2 text-[14px] font-medium text-ink disabled:opacity-60">
              {saving ? 'Saving...' : 'Save'}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </AppShell>
  );
}

export default Profile;
