import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import {
  UsersIcon, DocumentTextIcon, DocumentDuplicateIcon, ChartBarIcon, IdentificationIcon, MagnifyingGlassIcon,
  AdjustmentsHorizontalIcon, ArrowDownTrayIcon, ArrowPathIcon, BriefcaseIcon, BuildingOfficeIcon, ClockIcon,
  MapPinIcon, Squares2X2Icon, TableCellsIcon, ChevronLeftIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline';
import api from '../api';
import AppShell, { PageHeader } from '../components/ui/AppShell';
import {
  Badge, Button, Card, Chip, EmptyState, Meter, Notice, Segmented, SelectField, Skeleton, StatTile, TextField, EASE, cx,
} from '../components/ui/primitives';
import { Modal, useFeedback } from '../components/ui/overlays';
import { scoreTone } from '../components/ui/tones';
import { dateLabel, downloadBlob, toCsv } from '../lib/format';

const PER_PAGE = 12;
const AVATAR_GRADIENTS = [
  'from-[#30b0c7] to-[#007aff]', 'from-[#34c759] to-[#30b0c7]', 'from-[#ff9500] to-[#ff2d55]',
  'from-[#af52de] to-[#5856d6]', 'from-[#ff2d55] to-[#af52de]', 'from-[#5856d6] to-[#007aff]',
];
const SCORE_BUCKET_TONE = { '0-40': 'red', '41-60': 'orange', '61-80': 'yellow', '81-100': 'green' };
const EXPERIENCE_TONES = ['teal', 'blue', 'indigo', 'purple'];

// The API returns these as JSON objects, whose key order is alphabetical; show them in range order
const inOrder = (obj, order) => order.filter((k) => k in (obj || {})).map((k) => [k, obj[k]]);

function Avatar({ user, size = 'h-12 w-12 text-[17px]' }) {
  const letter = (user.full_name || user.email || '?')[0].toUpperCase();
  return (
    <span className={cx('flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br font-semibold text-white', AVATAR_GRADIENTS[user.id % AVATAR_GRADIENTS.length], size)}>
      {letter}
    </span>
  );
}

function ScoreBadge({ score }) {
  if (!score) return <span className="text-[13px] text-silver">N/A</span>;
  return <Badge toneName={scoreTone(score)}>{Math.round(score)}%</Badge>;
}

function CandidateCard({ user, selected, onToggle, onView, onDownload, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: EASE, delay: Math.min(index, 12) * 0.03 }}
      className={cx(
        'flex flex-col rounded-[24px] bg-white p-6 ring-1 transition-shadow hover:shadow-[0_20px_50px_-24px_rgba(0,0,0,0.25)]',
        selected ? 'ring-2 ring-teal' : 'ring-black/[0.05]'
      )}
    >
      <div className="flex items-start gap-3">
        <Avatar user={user} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-[17px] font-semibold text-ink">{user.full_name || 'No Name'}</h3>
          <p className="truncate text-[13px] text-graphite">{user.email}</p>
        </div>
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(user.id)}
          aria-label={`Select ${user.full_name || user.email}`}
          className="mt-1 h-4 w-4 rounded accent-[#30b0c7]"
        />
      </div>

      <div className="mt-5 space-y-2 text-[14px] text-ink/85">
        {user.current_work && <p className="flex items-center gap-2"><BriefcaseIcon className="h-4 w-4 text-silver" />{user.current_work}</p>}
        {user.current_company && <p className="flex items-center gap-2"><BuildingOfficeIcon className="h-4 w-4 text-silver" />{user.current_company}</p>}
        {user.total_experience ? <p className="flex items-center gap-2"><ClockIcon className="h-4 w-4 text-silver" />{user.total_experience} years</p> : null}
        {user.current_location && <p className="flex items-center gap-2"><MapPinIcon className="h-4 w-4 text-silver" />{user.current_location}</p>}
      </div>

      {user.all_skills?.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {user.all_skills.slice(0, 4).map((s) => <Chip key={s} toneName="teal" className="!text-[12px]">{s}</Chip>)}
          {user.all_skills.length > 4 && <span className="self-center text-[12px] text-silver">+{user.all_skills.length - 4}</span>}
        </div>
      )}

      <div className="mt-5 grid grid-cols-3 gap-2 rounded-2xl bg-mist p-3 text-center">
        <div>
          <p className="text-[17px] font-semibold tabular-nums">{user.resume_count}</p>
          <p className="text-[11px] text-graphite">Resumes</p>
        </div>
        <div>
          <ScoreBadge score={user.latest_score} />
          <p className="mt-0.5 text-[11px] text-graphite">Latest score</p>
        </div>
        <div>
          <p className="text-[13px] font-semibold">{user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}</p>
          <p className="text-[11px] text-graphite">Joined</p>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button size="sm" className="flex-1" onClick={() => onView(user)}>View details</Button>
        {user.profile_resume_filename && (
          <Button size="sm" variant="secondary" onClick={() => onDownload(user.id)}>
            <ArrowDownTrayIcon className="h-4 w-4" /> Resume
          </Button>
        )}
        {user.linkedin_url && (
          <a href={user.linkedin_url} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 items-center rounded-full bg-blue-soft px-3.5 text-[13px] font-medium text-blue-ink hover:bg-[#dcebff]">
            LinkedIn
          </a>
        )}
      </div>
    </motion.div>
  );
}

function CandidateTable({ users, selectedUsers, onToggle, allSelected, onToggleAll, onView, onDownload }) {
  return (
    <Card className="overflow-hidden !p-0">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-[14px]">
          <thead className="border-b border-black/[0.06] bg-[#fbfbfd] text-[12px] uppercase tracking-[0.06em] text-silver">
            <tr>
              <th className="px-5 py-3"><input type="checkbox" checked={allSelected} onChange={onToggleAll} aria-label="Select all on this page" className="h-4 w-4 accent-[#30b0c7]" /></th>
              <th className="px-5 py-3 font-medium">Candidate</th>
              <th className="px-5 py-3 font-medium">Position and company</th>
              <th className="px-5 py-3 font-medium">Location</th>
              <th className="px-5 py-3 font-medium">Experience</th>
              <th className="px-5 py-3 font-medium">Score</th>
              <th className="px-5 py-3 font-medium">Skills</th>
              <th className="px-5 py-3 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.05]">
            {users.map((user) => (
              <tr key={user.id} className={cx('transition-colors hover:bg-[#fbfbfd]', selectedUsers.includes(user.id) && 'bg-teal-soft/60')}>
                <td className="px-5 py-4">
                  <input type="checkbox" checked={selectedUsers.includes(user.id)} onChange={() => onToggle(user.id)} aria-label={`Select ${user.full_name || user.email}`} className="h-4 w-4 accent-[#30b0c7]" />
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-3">
                    <Avatar user={user} size="h-9 w-9 text-[14px]" />
                    <div className="min-w-0">
                      <p className="font-medium text-ink">{user.full_name || 'No Name'}</p>
                      <p className="text-[13px] text-graphite">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <p className="text-ink">{user.current_work || 'N/A'}</p>
                  <p className="text-[13px] text-graphite">{user.current_company || 'N/A'}</p>
                </td>
                <td className="whitespace-nowrap px-5 py-4 text-ink">{user.current_location || 'N/A'}</td>
                <td className="whitespace-nowrap px-5 py-4 text-ink">{user.total_experience ? `${user.total_experience} years` : 'N/A'}</td>
                <td className="px-5 py-4"><ScoreBadge score={user.latest_score} /></td>
                <td className="px-5 py-4">
                  <div className="flex max-w-xs flex-wrap gap-1">
                    {user.all_skills?.slice(0, 3).map((s) => <Chip key={s} toneName="teal" className="!px-2 !py-0.5 !text-[12px]">{s}</Chip>)}
                    {user.all_skills?.length > 3 && <span className="text-[12px] text-silver">+{user.all_skills.length - 3} more</span>}
                  </div>
                </td>
                <td className="whitespace-nowrap px-5 py-4">
                  <div className="flex gap-3 text-[13px] font-medium">
                    <button type="button" onClick={() => onView(user)} className="text-action-link hover:underline">View</button>
                    {user.profile_resume_filename && <button type="button" onClick={() => onDownload(user.id)} className="text-green-ink hover:underline">Resume</button>}
                    {user.linkedin_url && <a href={user.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-ink hover:underline">LinkedIn</a>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function DetailRow({ label, value }) {
  return (
    <div>
      <dt className="text-[12px] text-silver">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-[15px] text-ink">{value || 'N/A'}</dd>
    </div>
  );
}

function CandidateDetails({ details }) {
  if (!details) {
    return <div className="space-y-4"><Skeleton className="h-20" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>;
  }
  return (
    <div className="space-y-7">
      <div className="flex items-center gap-4">
        <Avatar user={details} size="h-16 w-16 text-[24px]" />
        <div>
          <p className="font-display text-[24px] font-semibold tracking-tight">{details.full_name || details.email}</p>
          <p className="text-[14px] text-graphite">{[details.current_work, details.current_company].filter(Boolean).join(' at ') || details.email}</p>
        </div>
      </div>

      <section>
        <h3 className="mb-3 text-[13px] font-semibold text-orange-ink">Personal information</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="Email" value={details.email} />
          <DetailRow label="Phone" value={details.phone_number} />
          <DetailRow label="Age" value={details.age} />
          <DetailRow label="Address" value={details.address} />
        </dl>
      </section>

      <section>
        <h3 className="mb-3 text-[13px] font-semibold text-blue-ink">Professional information</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <DetailRow label="Position" value={details.current_work} />
          <DetailRow label="Company" value={details.current_company} />
          <DetailRow label="Location" value={details.current_location} />
          <DetailRow label="Experience" value={details.total_experience ? `${details.total_experience} years` : null} />
        </dl>
      </section>

      {(details.skills_summary || details.education || details.certifications || details.languages || details.achievements) && (
        <section>
          <h3 className="mb-3 text-[13px] font-semibold text-green-ink">Skills and education</h3>
          <dl className="grid gap-4 sm:grid-cols-2">
            {details.education && <DetailRow label="Education" value={details.education} />}
            {details.languages && <DetailRow label="Languages" value={details.languages} />}
            {details.certifications && <DetailRow label="Certifications" value={details.certifications} />}
            {details.achievements && <DetailRow label="Achievements" value={details.achievements} />}
          </dl>
          {details.skills_summary && (
            <p className="mt-4 rounded-2xl bg-green-soft p-4 text-[14px] text-green-ink">{details.skills_summary}</p>
          )}
        </section>
      )}

      {(details.bio || details.linkedin_url || details.website_url) && (
        <section>
          <h3 className="mb-3 text-[13px] font-semibold text-purple-ink">Links and bio</h3>
          {details.bio && <p className="text-[15px] leading-[1.55] text-ink">{details.bio}</p>}
          <div className="mt-3 flex gap-4 text-[14px]">
            {details.linkedin_url && <a href={details.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-action-link hover:underline">LinkedIn profile</a>}
            {details.website_url && <a href={details.website_url} target="_blank" rel="noopener noreferrer" className="text-action-link hover:underline">Website</a>}
          </div>
        </section>
      )}

      {details.resume_history?.length > 0 && (
        <section>
          <h3 className="mb-3 text-[13px] font-semibold text-teal-ink">Resume history</h3>
          <ul className="divide-y divide-black/[0.06] rounded-2xl ring-1 ring-black/[0.06]">
            {details.resume_history.map((resume) => (
              <li key={resume.id} className="flex items-center justify-between gap-4 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-medium">{resume.filename}</p>
                  <p className="text-[12px] text-silver">{dateLabel(resume.uploaded_at)}{resume.skills?.length ? `, ${resume.skills.length} skills` : ''}</p>
                </div>
                <ScoreBadge score={resume.score} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {details.profile_history?.length > 0 && (
        <section>
          <h3 className="mb-3 text-[13px] font-semibold text-graphite">Recent profile changes</h3>
          <ul className="space-y-2 text-[14px]">
            {details.profile_history.map((change, i) => (
              <li key={`${change.changed_at}-${i}`} className="flex justify-between gap-4">
                <span className="text-ink">{change.current_work || 'No position'}{change.current_company ? ` at ${change.current_company}` : ''}</span>
                <span className="shrink-0 text-silver">{dateLabel(change.changed_at)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function DistributionList({ title, entries, toneFor, suffix = '' }) {
  const max = Math.max(1, ...entries.map(([, v]) => v));
  return (
    <section>
      <h3 className="mb-4 font-display text-[19px] font-semibold tracking-tight">{title}</h3>
      {entries.length === 0 ? <p className="text-[14px] text-graphite">No data yet.</p> : (
        <div className="space-y-3">
          {entries.map(([label, value], i) => (
            <div key={label}>
              <div className="mb-1 flex justify-between text-[14px]">
                <span className="truncate text-ink">{label}{suffix}</span>
                <span className="font-semibold tabular-nums">{value}</span>
              </div>
              <Meter value={(value / max) * 100} toneName={toneFor(label, i)} delay={i * 0.05} />
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function AnalyticsPanel({ analytics, stats }) {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatTile label="Total candidates" value={analytics.total_candidates || 0} toneName="teal" icon={UsersIcon} />
        <StatTile label="Average score" value={`${Math.round(analytics.average_score || 0)}%`} toneName={scoreTone(analytics.average_score || 0)} icon={ChartBarIcon} />
        <StatTile label="Active profiles" value={stats.users_with_profiles || 0} toneName="orange" icon={IdentificationIcon} />
      </div>
      <div className="grid gap-8 md:grid-cols-2">
        <DistributionList title="Top job roles" entries={Object.entries(analytics.job_role_distribution || {}).slice(0, 10)} toneFor={(_, i) => ['teal', 'blue', 'indigo', 'purple', 'pink'][i % 5]} />
        <DistributionList title="Top locations" entries={Object.entries(analytics.location_distribution || {}).slice(0, 8)} toneFor={(_, i) => ['green', 'teal', 'blue'][i % 3]} />
        <DistributionList title="Experience" entries={inOrder(analytics.experience_distribution, ['0-2', '3-5', '6-10', '10+'])} toneFor={(_, i) => EXPERIENCE_TONES[i % 4]} suffix=" years" />
        <DistributionList title="Resume scores" entries={inOrder(analytics.score_distribution, ['0-40', '41-60', '61-80', '81-100'])} toneFor={(label) => SCORE_BUCKET_TONE[label] || 'gray'} suffix="%" />
      </div>
    </div>
  );
}

const HRDashboard = () => {
  const { notify } = useFeedback();
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState({});
  const [analytics, setAnalytics] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [userDetails, setUserDetails] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterBy, setFilterBy] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [error, setError] = useState('');

  const [jobRoleFilter, setJobRoleFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');
  const [companyFilter, setCompanyFilter] = useState('');
  const [skillsFilter, setSkillsFilter] = useState('');
  const [minExperience, setMinExperience] = useState('');
  const [maxExperience, setMaxExperience] = useState('');
  const [minScore, setMinScore] = useState('');
  const [hasResume, setHasResume] = useState('');

  const [jobRoles, setJobRoles] = useState([]);
  const [locations, setLocations] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [skills, setSkills] = useState([]);

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [viewMode, setViewMode] = useState('grid');
  const [showAnalytics, setShowAnalytics] = useState(false);

  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });
  const [reloadKey, setReloadKey] = useState(0);
  const isFirstLoad = useRef(true);

  useEffect(() => {
    fetchDropdownData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Debounce typing in the search box; page, sort and filter changes load almost immediately
    const delay = isFirstLoad.current ? 0 : 300;
    isFirstLoad.current = false;
    const timer = setTimeout(() => fetchHRData(page), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, sortBy, searchTerm, reloadKey]);

  const fetchHRData = async (pageToLoad = page) => {
    setRefreshing(true);
    try {
      const params = new URLSearchParams();
      if (jobRoleFilter) params.append('job_role', jobRoleFilter);
      if (locationFilter) params.append('location', locationFilter);
      if (companyFilter) params.append('company', companyFilter);
      if (skillsFilter) params.append('skills', skillsFilter);
      if (minExperience) params.append('min_experience', minExperience);
      if (maxExperience) params.append('max_experience', maxExperience);
      if (minScore) params.append('min_score', minScore);
      if (hasResume) params.append('has_resume', hasResume);
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      params.append('sort', sortBy);
      params.append('page', pageToLoad);
      params.append('per_page', PER_PAGE);

      const [usersResponse, statsResponse, analyticsResponse] = await Promise.all([
        api.get(`/hr/all-users?${params.toString()}`),
        api.get('/hr/stats'),
        api.get('/hr/analytics'),
      ]);
      setUsers(usersResponse.data.users);
      setPagination({ total: usersResponse.data.total_users, pages: usersResponse.data.pages });
      setStats(statsResponse.data);
      setAnalytics(analyticsResponse.data);
      setError('');
    } catch (err) {
      if (err.response?.status === 403) setError('Access denied. HR privileges required.');
      else if (err.response?.status !== 401) setError('Failed to load HR data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const fetchDropdownData = async () => {
    try {
      const [roles, locs, comps, skillList] = await Promise.all([
        api.get('/hr/job-roles'), api.get('/hr/locations'), api.get('/hr/companies'), api.get('/hr/skills'),
      ]);
      setJobRoles(roles.data.job_roles);
      setLocations(locs.data.locations);
      setCompanies(comps.data.companies);
      setSkills(skillList.data.skills);
    } catch (err) {
      console.error('Error fetching dropdown data:', err);
    }
  };

  const openDetails = async (user) => {
    setSelectedUser(user);
    setUserDetails(null);
    try {
      const response = await api.get(`/hr/user/${user.id}`);
      setUserDetails(response.data);
    } catch (err) {
      setSelectedUser(null);
      notify('Failed to load user details', 'error');
    }
  };

  const closeDetails = () => { setSelectedUser(null); setUserDetails(null); };

  const downloadUserResume = async (userId) => {
    try {
      const response = await api.get(`/hr/download-profile-resume/${userId}`, { responseType: 'blob' });
      downloadBlob(response.data, `user_${userId}_resume.pdf`);
    } catch (err) {
      notify('Failed to download resume', 'error');
    }
  };

  const reload = () => { setPage(1); setReloadKey((k) => k + 1); };

  const clearAllFilters = () => {
    setSearchTerm('');
    setFilterBy('all');
    setJobRoleFilter('');
    setLocationFilter('');
    setCompanyFilter('');
    setSkillsFilter('');
    setMinExperience('');
    setMaxExperience('');
    setMinScore('');
    setHasResume('');
    reload();
  };

  const filteredUsers = users.filter((user) => (
    filterBy === 'all'
    || (filterBy === 'with_resume' && user.profile_resume_filename)
    || (filterBy === 'without_resume' && !user.profile_resume_filename)
    || (filterBy === 'high_score' && user.latest_score >= 75)
  ));

  const exportToCSV = () => {
    const pool = selectedUsers.length ? filteredUsers.filter((u) => selectedUsers.includes(u.id)) : filteredUsers;
    if (pool.length === 0) { notify('No candidates to export', 'info'); return; }
    const csv = toCsv(pool.map((user) => ({
      Name: user.full_name || 'N/A',
      Email: user.email,
      Position: user.current_work || 'N/A',
      Company: user.current_company || 'N/A',
      Location: user.current_location || 'N/A',
      Experience: user.total_experience ? `${user.total_experience} years` : 'N/A',
      Score: user.latest_score || 'N/A',
      Skills: user.all_skills ? user.all_skills.join(', ') : 'N/A',
      HasResume: user.profile_resume_filename ? 'Yes' : 'No',
    })));
    downloadBlob(csv, `candidates_${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
    notify(`Exported ${pool.length} candidate${pool.length === 1 ? '' : 's'}`);
  };

  const toggleUserSelection = (userId) => setSelectedUsers((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));
  const allSelected = filteredUsers.length > 0 && filteredUsers.every((u) => selectedUsers.includes(u.id));
  const selectAllUsers = () => setSelectedUsers(filteredUsers.map((u) => u.id));
  const clearSelection = () => setSelectedUsers([]);

  const activeFilterCount = [jobRoleFilter, locationFilter, companyFilter, skillsFilter, minExperience, maxExperience, minScore, hasResume].filter(Boolean).length;

  return (
    <AppShell wide>
      <PageHeader
        eyebrow="For HR teams"
        toneName="teal"
        title="Find the right candidate."
        subtitle="Search, filter and compare every candidate profile in one place."
        actions={(
          <>
            <Button variant="outline" onClick={() => setShowAnalytics(true)}><ChartBarIcon className="h-4 w-4 text-teal" /> Analytics</Button>
            <Button variant="dark" onClick={exportToCSV}><ArrowDownTrayIcon className="h-4 w-4" /> Export CSV</Button>
          </>
        )}
      />

      {error && <Notice className="mb-6">{error}</Notice>}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {loading ? [0, 1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[112px]" />) : (
          <>
            <StatTile label="Total users" value={stats.total_users || 0} toneName="teal" icon={UsersIcon} />
            <StatTile label="With resume" value={stats.users_with_resume || 0} toneName="green" icon={DocumentTextIcon} />
            <StatTile label="Total resumes" value={stats.total_resumes || 0} toneName="purple" icon={DocumentDuplicateIcon} />
            <StatTile label="Average score" value={`${stats.average_score || 0}%`} toneName={scoreTone(stats.average_score || 0)} icon={ChartBarIcon} />
            <StatTile label="Complete profiles" value={stats.users_with_profiles || 0} toneName="orange" icon={IdentificationIcon} />
          </>
        )}
      </div>

      {/* Toolbar */}
      <Card className="mt-6 !p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-silver" aria-hidden="true" />
            <input
              type="search"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setPage(1); }}
              placeholder="Search by name, email, position..."
              aria-label="Search candidates"
              className="block w-full rounded-full border border-hairline bg-mist/60 py-2.5 pl-11 pr-4 text-[15px] placeholder:text-silver focus:border-action focus:bg-white focus:outline-none focus:ring-4 focus:ring-action/15"
            />
          </div>
          <Segmented
            label="Quick filter"
            value={filterBy}
            onChange={setFilterBy}
            options={[
              { value: 'all', label: 'All' }, { value: 'with_resume', label: 'With resume' },
              { value: 'without_resume', label: 'No resume' }, { value: 'high_score', label: 'Score 75+' },
            ]}
          />
          <div className="flex flex-wrap items-center gap-3">
            <SelectField
              aria-label="Sort by"
              value={sortBy}
              onChange={(e) => { setSortBy(e.target.value); setPage(1); }}
              options={[
                { value: 'created_at', label: 'Newest first' }, { value: 'name', label: 'Name' },
                { value: 'experience', label: 'Experience' }, { value: 'score', label: 'Latest score' },
              ]}
              className="w-40"
            />
            <Button variant={showAdvancedFilters ? 'dark' : 'secondary'} onClick={() => setShowAdvancedFilters((v) => !v)} aria-expanded={showAdvancedFilters}>
              <AdjustmentsHorizontalIcon className="h-4 w-4" /> Filters
              {activeFilterCount > 0 && <span className="rounded-full bg-teal px-1.5 text-[11px] text-white">{activeFilterCount}</span>}
            </Button>
          </div>
        </div>

        <motion.div
          initial={false}
          animate={{ height: showAdvancedFilters ? 'auto' : 0, opacity: showAdvancedFilters ? 1 : 0 }}
          transition={{ duration: 0.35, ease: EASE }}
          className="overflow-hidden"
        >
          <div className="mt-5 grid gap-4 border-t border-black/[0.06] pt-5 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField label="Job role" value={jobRoleFilter} onChange={(e) => setJobRoleFilter(e.target.value)} options={jobRoles} placeholder="All job roles" />
            <SelectField label="Location" value={locationFilter} onChange={(e) => setLocationFilter(e.target.value)} options={locations} placeholder="All locations" />
            <SelectField label="Company" value={companyFilter} onChange={(e) => setCompanyFilter(e.target.value)} options={companies} placeholder="All companies" />
            <SelectField label="Skills" value={skillsFilter} onChange={(e) => setSkillsFilter(e.target.value)} options={skills} placeholder="All skills" />
            <TextField label="Min experience" type="number" value={minExperience} onChange={(e) => setMinExperience(e.target.value)} placeholder="0" />
            <TextField label="Max experience" type="number" value={maxExperience} onChange={(e) => setMaxExperience(e.target.value)} placeholder="20" />
            <TextField label="Min score" type="number" min="0" max="100" value={minScore} onChange={(e) => setMinScore(e.target.value)} placeholder="0" />
            <SelectField label="Has resume" value={hasResume} onChange={(e) => setHasResume(e.target.value)} options={[{ value: 'true', label: 'Yes' }, { value: 'false', label: 'No' }]} placeholder="All" />
          </div>
          <div className="mt-5 flex justify-end gap-3">
            <Button variant="secondary" onClick={clearAllFilters}>Clear all</Button>
            <Button onClick={reload}>Apply filters</Button>
          </div>
        </motion.div>
      </Card>

      {/* Action bar */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-[14px]">
          <span className="font-medium text-ink">{pagination.total} candidates found</span>
          {selectedUsers.length > 0 && <Badge toneName="teal">{selectedUsers.length} selected</Badge>}
          {refreshing && !loading && <span className="text-[13px] text-silver">Updating...</span>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedUsers.length > 0 && <Button size="sm" variant="ghost" onClick={clearSelection}>Clear selection</Button>}
          <Button size="sm" variant="secondary" onClick={selectAllUsers}>Select all</Button>
          <Button size="sm" variant="secondary" onClick={() => fetchHRData(page)}><ArrowPathIcon className="h-4 w-4" /> Refresh</Button>
          <Segmented
            label="View mode"
            value={viewMode}
            onChange={setViewMode}
            options={[
              { value: 'grid', label: <span className="flex items-center gap-1"><Squares2X2Icon className="h-4 w-4" />Grid</span> },
              { value: 'table', label: <span className="flex items-center gap-1"><TableCellsIcon className="h-4 w-4" />Table</span> },
            ]}
          />
        </div>
      </div>

      <div className="mt-5">
        {loading ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-80" />)}</div>
        ) : filteredUsers.length === 0 ? (
          <Card>
            <EmptyState icon={UsersIcon} toneName="teal" title="No users found">Try adjusting your search or filter criteria.</EmptyState>
          </Card>
        ) : viewMode === 'grid' ? (
          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {filteredUsers.map((user, i) => (
              <CandidateCard key={user.id} index={i} user={user} selected={selectedUsers.includes(user.id)} onToggle={toggleUserSelection} onView={openDetails} onDownload={downloadUserResume} />
            ))}
          </div>
        ) : (
          <CandidateTable
            users={filteredUsers}
            selectedUsers={selectedUsers}
            onToggle={toggleUserSelection}
            allSelected={allSelected}
            onToggleAll={allSelected ? clearSelection : selectAllUsers}
            onView={openDetails}
            onDownload={downloadUserResume}
          />
        )}
      </div>

      {pagination.pages > 1 && (
        <nav className="mt-10 flex items-center justify-center gap-2" aria-label="Candidate pages">
          <button
            type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-mist disabled:opacity-30" aria-label="Previous page"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
          {Array.from({ length: pagination.pages }, (_, i) => i + 1)
            .filter((n) => n === 1 || n === pagination.pages || Math.abs(n - page) <= 1)
            .map((n, i, arr) => (
              <React.Fragment key={n}>
                {i > 0 && n - arr[i - 1] > 1 && <span className="px-1 text-silver">...</span>}
                <button
                  type="button"
                  onClick={() => setPage(n)}
                  aria-current={n === page ? 'page' : undefined}
                  className={cx('h-9 min-w-9 rounded-full px-3 text-[14px] tabular-nums transition-colors', n === page ? 'bg-ink text-white' : 'text-ink hover:bg-mist')}
                >
                  {n}
                </button>
              </React.Fragment>
            ))}
          <button
            type="button" onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))} disabled={page >= pagination.pages}
            className="flex h-9 w-9 items-center justify-center rounded-full text-ink hover:bg-mist disabled:opacity-30" aria-label="Next page"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
          <span className="ml-3 text-[13px] text-graphite">Page {page} of {pagination.pages}</span>
        </nav>
      )}

      <Modal open={Boolean(selectedUser)} onClose={closeDetails} title="Candidate details" size="md">
        <CandidateDetails details={userDetails} />
      </Modal>

      <Modal open={showAnalytics} onClose={() => setShowAnalytics(false)} title="Analytics" size="xl">
        <AnalyticsPanel analytics={analytics} stats={stats} />
      </Modal>
    </AppShell>
  );
};

export default HRDashboard;
