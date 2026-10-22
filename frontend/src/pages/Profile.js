import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import api, { errorMessage } from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import { Appear, Button, Card, Notice, ScoreRing, Skeleton, TextArea, TextField, EASE, cx } from '../components/ui/primitives';
import { useFeedback } from '../components/ui/overlays';
import Dropzone, { pdfError } from '../components/ui/Dropzone';
import { tone } from '../components/ui/tones';
import { editFormFrom, profileCompletion } from '../lib/careerStats';
import { dateLabel, dateTimeLabel, downloadBlob } from '../lib/format';

const SECTIONS = [
  {
    key: 'personal', title: 'Personal information', toneName: 'orange',
    fields: [
      { name: 'full_name', label: 'Full name', placeholder: 'Enter your full name', span: 2 },
      { name: 'phone_number', label: 'Phone', type: 'tel', placeholder: '+1 (555) 123-4567' },
      { name: 'age', label: 'Age', type: 'number', placeholder: '25', min: 18, max: 100 },
      { name: 'address', label: 'Address', placeholder: 'City, State, Country', span: 2 },
    ],
  },
  {
    key: 'professional', title: 'Professional information', toneName: 'blue',
    fields: [
      { name: 'current_work', label: 'Current position', placeholder: 'e.g., Senior Software Engineer' },
      { name: 'current_company', label: 'Company', placeholder: 'e.g., Tech Corp Inc.' },
      { name: 'current_location', label: 'Location', placeholder: 'San Francisco, CA' },
      { name: 'total_experience', label: 'Experience (years)', type: 'number', placeholder: '3.5', min: 0, max: 50, step: 0.5 },
    ],
  },
  {
    key: 'education', title: 'Education and skills', toneName: 'green',
    fields: [
      { name: 'education', label: 'Education', placeholder: 'e.g., BS Computer Science, Stanford University', span: 2 },
      { name: 'skills_summary', label: 'Skills', multiline: 2, placeholder: 'e.g., Python, JavaScript, React, Node.js, AWS, Docker...', span: 2 },
      { name: 'certifications', label: 'Certifications', multiline: 2, placeholder: 'e.g., AWS Solutions Architect, PMP' },
      { name: 'languages', label: 'Languages', placeholder: 'e.g., English (Native), Spanish (Fluent)' },
      { name: 'achievements', label: 'Achievements', multiline: 3, placeholder: 'e.g., Led team of 10 engineers, Increased system performance by 40%...', span: 2 },
    ],
  },
  {
    key: 'links', title: 'Links and bio', toneName: 'purple',
    fields: [
      { name: 'linkedin_url', label: 'LinkedIn', type: 'url', placeholder: 'https://linkedin.com/in/yourprofile' },
      { name: 'website_url', label: 'Portfolio or website', type: 'url', placeholder: 'https://yourportfolio.com' },
      { name: 'bio', label: 'Bio', multiline: 3, placeholder: 'A brief professional summary about yourself...', span: 2 },
    ],
  },
];

function displayValue(field, value) {
  if (value === null || value === undefined || String(value).trim() === '') return null;
  if (field.name === 'total_experience') return `${value} years`;
  if (field.type === 'url') {
    return (
      <a href={value} target="_blank" rel="noopener noreferrer" className="break-all text-action-link hover:underline">
        {field.name === 'linkedin_url' ? 'View profile' : 'Visit site'}
      </a>
    );
  }
  return value;
}

function SectionCard({ section, profile, editing, form, onChange, delay }) {
  const t = tone(section.toneName);
  return (
    <Appear delay={delay}>
      <Card className="!p-6 md:!p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className={cx('h-5 w-1 rounded-full', t.bg)} aria-hidden="true" />
          <h2 className="font-display text-[21px] font-semibold tracking-tight">{section.title}</h2>
        </div>
        {editing ? (
          <div className="grid gap-4 sm:grid-cols-2">
            {section.fields.map((field) => {
              const common = {
                name: field.name, label: field.label, placeholder: field.placeholder,
                value: form[field.name] ?? '', onChange, className: field.span === 2 ? 'sm:col-span-2' : '',
              };
              return field.multiline
                ? <TextArea key={field.name} rows={field.multiline} {...common} />
                : <TextField key={field.name} type={field.type || 'text'} min={field.min} max={field.max} step={field.step} {...common} />;
            })}
          </div>
        ) : (
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
            {section.key === 'personal' && (
              <div className="sm:col-span-2">
                <dt className="text-[13px] text-silver">Email</dt>
                <dd className="mt-0.5 text-[15px] text-ink">{profile.email}</dd>
              </div>
            )}
            {section.fields.map((field) => {
              const value = displayValue(field, profile[field.name]);
              return (
                <div key={field.name} className={field.span === 2 ? 'sm:col-span-2' : ''}>
                  <dt className="text-[13px] text-silver">{field.label}</dt>
                  <dd className={cx('mt-0.5 whitespace-pre-line text-[15px]', value ? 'text-ink' : 'text-silver')}>{value || 'Not set'}</dd>
                </div>
              );
            })}
          </dl>
        )}
      </Card>
    </Appear>
  );
}

function Profile() {
  const { notify } = useFeedback();
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
    const [profileResponse, historyResponse] = await Promise.all([api.get('/profile'), api.get('/profile/history')]);
    setProfile(profileResponse.data);
    setHistory(historyResponse.data.history || []);
    setForm(editFormFrom(profileResponse.data));
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
      notify('Profile updated successfully!');
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
      const response = await api.post('/profile/upload-resume', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      if (response.data.message) {
        notify('Resume uploaded successfully!');
        await load();
      }
    } catch (err) {
      setResumeError(errorMessage(err, 'Failed to upload resume'));
    } finally {
      setResumeUploading(false);
    }
  };

  const downloadResume = async () => {
    try {
      const response = await api.get('/profile/download-resume', { responseType: 'blob' });
      downloadBlob(response.data, profile.profile_resume_filename || 'profile_resume.pdf');
    } catch (err) {
      notify('Failed to download resume', 'error');
    }
  };

  if (loading) {
    return (
      <AppShell>
        <Skeleton className="mb-10 h-28 w-2/3" />
        <div className="grid gap-5 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}</div>
      </AppShell>
    );
  }

  if (error || !profile) {
    return <AppShell><Notice>{error || 'Failed to load profile data'}</Notice></AppShell>;
  }

  const completion = profileCompletion(profile);
  const initial = (profile.full_name || profile.email || 'U').charAt(0).toUpperCase();

  return (
    <AppShell>
      <PageHeader
        eyebrow="Profile"
        toneName="orange"
        title={profile.full_name || 'Complete your profile'}
        subtitle={[
          [profile.current_work, profile.current_company].filter(Boolean).join(' at '),
          profile.current_location,
        ].filter(Boolean).join(', ') || profile.email}
        actions={editing ? (
          <>
            <Button variant="secondary" onClick={cancelEditing} disabled={saving}>Cancel</Button>
            <Button onClick={save} loading={saving}>Save changes</Button>
          </>
        ) : (
          <Button variant="dark" onClick={startEditing}>Edit profile</Button>
        )}
      />

      {saveError && <Notice className="mb-6">{saveError}</Notice>}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <div className="space-y-5">
          {SECTIONS.map((section, i) => (
            <SectionCard key={section.key} section={section} profile={profile} editing={editing} form={form} onChange={onChange} delay={0.05 * i} />
          ))}
          <AnimatePresence>
            {editing && (
              <motion.div
                className="sticky bottom-4 z-10 flex justify-end gap-3 rounded-full bg-white/85 p-2 shadow-[0_10px_40px_-12px_rgba(0,0,0,0.3)] ring-1 ring-black/5 backdrop-blur-xl"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 16 }}
                transition={{ duration: 0.35, ease: EASE }}
              >
                <Button variant="secondary" onClick={cancelEditing} disabled={saving}>Cancel</Button>
                <Button onClick={save} loading={saving}>Save changes</Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <aside className="space-y-5">
          <Appear delay={0.1}>
            <Card className="!p-6 text-center">
              <div className="relative mx-auto w-fit">
                <ScoreRing value={completion} size={132} stroke={8} toneName="orange">
                  <span className="flex h-[96px] w-[96px] items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff9500,#ff2d55)] font-display text-[40px] font-semibold text-white">
                    {initial}
                  </span>
                </ScoreRing>
              </div>
              <p className="mt-4 font-display text-[28px] font-semibold tracking-tight tabular-nums">{completion}%</p>
              <p className="text-[14px] text-graphite">profile complete</p>
            </Card>
          </Appear>

          <Appear delay={0.15}>
            <Card className="!p-6">
              <h2 className="mb-4 font-display text-[19px] font-semibold tracking-tight">Profile resume</h2>
              {profile.profile_resume_filename ? (
                <div className="mb-4 rounded-2xl bg-green-soft p-4">
                  <p className="truncate text-[14px] font-medium text-green-ink" title={profile.profile_resume_filename}>{profile.profile_resume_filename}</p>
                  <p className="text-[12px] text-green-ink/80">
                    Uploaded {profile.profile_resume_uploaded_at ? dateLabel(profile.profile_resume_uploaded_at) : 'recently'}
                  </p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={downloadResume}>Download</Button>
                </div>
              ) : (
                <p className="mb-4 text-[14px] text-graphite">No profile resume uploaded. HR teams see the resume you add here.</p>
              )}
              <Dropzone compact onFile={uploadResume} busy={resumeUploading} title={profile.profile_resume_filename ? 'Replace resume' : 'Add your resume'} />
              {resumeError && <Notice className="mt-3">{resumeError}</Notice>}
            </Card>
          </Appear>

          <Appear delay={0.2}>
            <Card className="!p-6">
              <h2 className="mb-4 font-display text-[19px] font-semibold tracking-tight">Profile history</h2>
              {history.length > 0 ? (
                <ol className="relative space-y-5 border-l border-hairline pl-5">
                  {history.slice(0, 10).map((entry, i) => (
                    <li key={`${entry.changed_at}-${i}`} className="relative">
                      <span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-purple ring-4 ring-white" aria-hidden="true" />
                      <p className="text-[12px] text-silver">Changed on {dateTimeLabel(entry.changed_at)}</p>
                      <p className="text-[14px] text-ink">{entry.full_name || 'No name'}{entry.current_work ? `, ${entry.current_work}` : ''}</p>
                      <p className="text-[12px] text-graphite">
                        {[entry.phone_number, entry.address, entry.age ? `Age ${entry.age}` : null].filter(Boolean).join(' / ') || 'No contact details'}
                      </p>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[14px] text-graphite">Earlier versions of your profile appear here after you edit it.</p>
              )}
            </Card>
          </Appear>
        </aside>
      </div>
    </AppShell>
  );
}

export default Profile;
