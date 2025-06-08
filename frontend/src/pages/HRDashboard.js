import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const HRDashboard = () => {
    const navigate = useNavigate();
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({});
    const [analytics, setAnalytics] = useState({});
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState(null);
    const [userDetails, setUserDetails] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterBy, setFilterBy] = useState('all');
    const [sortBy, setSortBy] = useState('created_at');
    const [error, setError] = useState('');
    
    // Advanced filters
    const [jobRoleFilter, setJobRoleFilter] = useState('');
    const [locationFilter, setLocationFilter] = useState('');
    const [companyFilter, setCompanyFilter] = useState('');
    const [skillsFilter, setSkillsFilter] = useState('');
    const [minExperience, setMinExperience] = useState('');
    const [maxExperience, setMaxExperience] = useState('');
    const [minScore, setMinScore] = useState('');
    const [hasResume, setHasResume] = useState('');
    
    // Data for dropdowns
    const [jobRoles, setJobRoles] = useState([]);
    const [locations, setLocations] = useState([]);
    const [companies, setCompanies] = useState([]);
    const [skills, setSkills] = useState([]);
    
    // UI states
    const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
    const [selectedUsers, setSelectedUsers] = useState([]);
    const [viewMode, setViewMode] = useState('grid'); // 'grid' or 'table'
    const [showAnalytics, setShowAnalytics] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/auth', { replace: true });
            return;
        }

        fetchHRData();
        fetchDropdownData();
    }, [navigate]);

    const fetchHRData = async () => {
        try {
            const token = localStorage.getItem('token');
            
            // Build query parameters
            const params = new URLSearchParams();
            if (jobRoleFilter) params.append('job_role', jobRoleFilter);
            if (locationFilter) params.append('location', locationFilter);
            if (companyFilter) params.append('company', companyFilter);
            if (skillsFilter) params.append('skills', skillsFilter);
            if (minExperience) params.append('min_experience', minExperience);
            if (maxExperience) params.append('max_experience', maxExperience);
            if (minScore) params.append('min_score', minScore);
            if (hasResume) params.append('has_resume', hasResume);
            
            const [usersResponse, statsResponse, analyticsResponse] = await Promise.all([
                axios.get(`http://localhost:5000/hr/all-users?${params.toString()}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                axios.get('http://localhost:5000/hr/stats', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                axios.get('http://localhost:5000/hr/analytics', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            setUsers(usersResponse.data.users);
            setStats(statsResponse.data);
            setAnalytics(analyticsResponse.data);
        } catch (err) {
            console.error('Error fetching HR data:', err);
            if (err.response?.status === 403) {
                setError('Access denied. HR privileges required.');
            } else if (err.response?.status === 401) {
                localStorage.removeItem('token');
                navigate('/auth', { replace: true });
            } else {
                setError('Failed to load HR data');
            }
        } finally {
            setLoading(false);
        }
    };

    const fetchDropdownData = async () => {
        try {
            const token = localStorage.getItem('token');
            const [rolesResponse, locationsResponse, companiesResponse, skillsResponse] = await Promise.all([
                axios.get('http://localhost:5000/hr/job-roles', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                axios.get('http://localhost:5000/hr/locations', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                axios.get('http://localhost:5000/hr/companies', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                axios.get('http://localhost:5000/hr/skills', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            setJobRoles(rolesResponse.data.job_roles);
            setLocations(locationsResponse.data.locations);
            setCompanies(companiesResponse.data.companies);
            setSkills(skillsResponse.data.skills);
        } catch (err) {
            console.error('Error fetching dropdown data:', err);
        }
    };

    const fetchUserDetails = async (userId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`http://localhost:5000/hr/user/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setUserDetails(response.data);
        } catch (err) {
            console.error('Error fetching user details:', err);
            setError('Failed to load user details');
        }
    };

    const downloadUserResume = async (userId) => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get(`http://localhost:5000/hr/download-profile-resume/${userId}`, {
                headers: { 'Authorization': `Bearer ${token}` },
                responseType: 'blob'
            });

            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', `user_${userId}_resume.pdf`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('Error downloading resume:', err);
            setError('Failed to download resume');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userEmail');
        navigate('/auth', { replace: true });
    };

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
    };

    const applyAdvancedFilters = () => {
        setLoading(true);
        fetchHRData();
    };

    const exportToCSV = () => {
        const csvData = filteredUsers.map(user => ({
            Name: user.full_name || 'N/A',
            Email: user.email,
            Position: user.current_work || 'N/A',
            Company: user.current_company || 'N/A',
            Location: user.current_location || 'N/A',
            Experience: user.total_experience ? `${user.total_experience} years` : 'N/A',
            Score: user.latest_score || 'N/A',
            Skills: user.all_skills ? user.all_skills.join(', ') : 'N/A',
            HasResume: user.profile_resume_filename ? 'Yes' : 'No'
        }));

        const csvString = [
            Object.keys(csvData[0]).join(','),
            ...csvData.map(row => Object.values(row).join(','))
        ].join('\n');

        const blob = new Blob([csvString], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `candidates_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        window.URL.revokeObjectURL(url);
    };

    const toggleUserSelection = (userId) => {
        setSelectedUsers(prev => 
            prev.includes(userId) 
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

    const selectAllUsers = () => {
        setSelectedUsers(filteredUsers.map(user => user.id));
    };

    const clearSelection = () => {
        setSelectedUsers([]);
    };

    const filteredUsers = users.filter(user => {
        const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             user.current_work?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                             user.current_company?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesFilter = filterBy === 'all' || 
                             (filterBy === 'with_resume' && user.profile_resume_filename) ||
                             (filterBy === 'without_resume' && !user.profile_resume_filename) ||
                             (filterBy === 'high_score' && user.latest_score >= 75);

        return matchesSearch && matchesFilter;
    }).sort((a, b) => {
        switch (sortBy) {
            case 'name':
                return (a.full_name || '').localeCompare(b.full_name || '');
            case 'experience':
                return (b.total_experience || 0) - (a.total_experience || 0);
            case 'score':
                return (b.latest_score || 0) - (a.latest_score || 0);
            case 'created_at':
            default:
                return new Date(b.created_at || 0) - new Date(a.created_at || 0);
        }
    });

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
            {/* Header */}
            <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex justify-between items-center h-16">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500 rounded-lg">
                                <span className="text-white text-xl">👔</span>
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900 dark:text-white">HR Dashboard</h1>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Manage candidate profiles</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={() => setShowAnalytics(!showAnalytics)}
                                className="px-4 py-2 bg-purple-500 hover:bg-purple-600 text-white rounded-lg transition-colors"
                            >
                                📊 Analytics
                            </button>
                            <button
                                onClick={handleLogout}
                                className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {error && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                        {error}
                    </div>
                </div>
            )}

            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                                <span className="text-blue-600 dark:text-blue-400">👥</span>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_users || 0}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Total Users</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                                <span className="text-green-600 dark:text-green-400">📄</span>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.users_with_resume || 0}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">With Resume</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                                <span className="text-purple-600 dark:text-purple-400">📊</span>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total_resumes || 0}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Total Resumes</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 rounded-lg">
                                <span className="text-orange-600 dark:text-orange-400">⭐</span>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.average_score || 0}%</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Avg Score</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
                                <span className="text-indigo-600 dark:text-indigo-400">✅</span>
                            </div>
                            <div>
                                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.users_with_profiles || 0}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">Complete Profiles</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Basic Filters and Search */}
                <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-8">
                    <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Search & Filter Candidates</h3>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-colors text-sm"
                            >
                                {showAdvancedFilters ? '🔼 Hide Filters' : '🔽 Advanced Filters'}
                            </button>
                            <button
                                onClick={clearAllFilters}
                                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-colors text-sm"
                            >
                                Clear All
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Search Users
                            </label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Search by name, email, position..."
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Quick Filter
                            </label>
                            <select
                                value={filterBy}
                                onChange={(e) => setFilterBy(e.target.value)}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            >
                                <option value="all">All Users</option>
                                <option value="with_resume">With Resume</option>
                                <option value="without_resume">Without Resume</option>
                                <option value="high_score">High Score (75+)</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                Sort By
                            </label>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                            >
                                <option value="created_at">Registration Date</option>
                                <option value="name">Name</option>
                                <option value="experience">Experience</option>
                                <option value="score">Latest Score</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                View Mode
                            </label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setViewMode('grid')}
                                    className={`px-3 py-2 rounded-lg transition-colors ${
                                        viewMode === 'grid' 
                                            ? 'bg-blue-500 text-white' 
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                >
                                    📱
                                </button>
                                <button
                                    onClick={() => setViewMode('table')}
                                    className={`px-3 py-2 rounded-lg transition-colors ${
                                        viewMode === 'table' 
                                            ? 'bg-blue-500 text-white' 
                                            : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                                    }`}
                                >
                                    📊
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Advanced Filters */}
                    {showAdvancedFilters && (
                        <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Job Role
                                    </label>
                                    <select
                                        value={jobRoleFilter}
                                        onChange={(e) => setJobRoleFilter(e.target.value)}
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="">All Job Roles</option>
                                        {jobRoles.map(role => (
                                            <option key={role} value={role}>{role}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Location
                                    </label>
                                    <select
                                        value={locationFilter}
                                        onChange={(e) => setLocationFilter(e.target.value)}
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="">All Locations</option>
                                        {locations.map(location => (
                                            <option key={location} value={location}>{location}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Company
                                    </label>
                                    <select
                                        value={companyFilter}
                                        onChange={(e) => setCompanyFilter(e.target.value)}
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="">All Companies</option>
                                        {companies.map(company => (
                                            <option key={company} value={company}>{company}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Skills
                                    </label>
                                    <select
                                        value={skillsFilter}
                                        onChange={(e) => setSkillsFilter(e.target.value)}
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="">All Skills</option>
                                        {skills.map(skill => (
                                            <option key={skill} value={skill}>{skill}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Min Experience
                                    </label>
                                    <input
                                        type="number"
                                        value={minExperience}
                                        onChange={(e) => setMinExperience(e.target.value)}
                                        placeholder="0"
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Max Experience
                                    </label>
                                    <input
                                        type="number"
                                        value={maxExperience}
                                        onChange={(e) => setMaxExperience(e.target.value)}
                                        placeholder="20"
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Min Score
                                    </label>
                                    <input
                                        type="number"
                                        value={minScore}
                                        onChange={(e) => setMinScore(e.target.value)}
                                        placeholder="0"
                                        min="0"
                                        max="100"
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                        Has Resume
                                    </label>
                                    <select
                                        value={hasResume}
                                        onChange={(e) => setHasResume(e.target.value)}
                                        className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-700 dark:text-white"
                                    >
                                        <option value="">All</option>
                                        <option value="true">Yes</option>
                                        <option value="false">No</option>
                                    </select>
                                </div>

                                <div className="flex items-end">
                                    <button
                                        onClick={applyAdvancedFilters}
                                        className="w-full px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors"
                                    >
                                        Apply Filters
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Action Bar */}
                    <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-200 dark:border-gray-600">
                        <div className="flex items-center gap-4">
                            <span className="text-sm text-gray-600 dark:text-gray-400">
                                {filteredUsers.length} candidates found
                            </span>
                            {selectedUsers.length > 0 && (
                                <span className="text-sm text-blue-600 dark:text-blue-400">
                                    {selectedUsers.length} selected
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2">
                            {selectedUsers.length > 0 && (
                                <button
                                    onClick={clearSelection}
                                    className="px-3 py-1 bg-gray-500 hover:bg-gray-600 text-white rounded text-sm transition-colors"
                                >
                                    Clear Selection
                                </button>
                            )}
                            <button
                                onClick={selectAllUsers}
                                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
                            >
                                Select All
                            </button>
                            <button
                                onClick={exportToCSV}
                                className="px-3 py-1 bg-green-500 hover:bg-green-600 text-white rounded text-sm transition-colors"
                            >
                                📤 Export CSV
                            </button>
                            <button
                                onClick={fetchHRData}
                                className="px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm transition-colors"
                            >
                                🔄 Refresh
                            </button>
                        </div>
                    </div>
                </div>

                {/* Users Grid/Table */}
                {viewMode === 'grid' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredUsers.map((user) => (
                            <div key={user.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                                <div className="p-6">
                                    {/* User Header */}
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <div className="relative">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUsers.includes(user.id)}
                                                    onChange={() => toggleUserSelection(user.id)}
                                                    className="absolute top-0 left-0 w-4 h-4 z-10"
                                                />
                                                <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                                    <span className="text-white font-bold text-lg">
                                                        {user.full_name ? user.full_name[0].toUpperCase() : user.email[0].toUpperCase()}
                                                    </span>
                                                </div>
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-gray-900 dark:text-white">
                                                    {user.full_name || 'No Name'}
                                                </h3>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">{user.email}</p>
                                            </div>
                                        </div>
                                        {user.latest_score && (
                                            <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                user.latest_score >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400' :
                                                user.latest_score >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400' :
                                                'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400'
                                            }`}>
                                                {user.latest_score}%
                                            </div>
                                        )}
                                    </div>

                                {/* User Info */}
                                <div className="space-y-2 mb-4">
                                    {user.current_work && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400">💼</span>
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{user.current_work}</span>
                                        </div>
                                    )}
                                    {user.current_company && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400">🏢</span>
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{user.current_company}</span>
                                        </div>
                                    )}
                                    {user.total_experience && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400">⏱️</span>
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{user.total_experience} years</span>
                                        </div>
                                    )}
                                    {user.current_location && (
                                        <div className="flex items-center gap-2">
                                            <span className="text-gray-400">📍</span>
                                            <span className="text-sm text-gray-700 dark:text-gray-300">{user.current_location}</span>
                                        </div>
                                    )}
                                </div>

                                {/* Stats */}
                                <div className="flex justify-between items-center mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">{user.resume_count}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Resumes</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                                            {user.profile_resume_filename ? '✅' : '❌'}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Profile Resume</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-bold text-gray-900 dark:text-white">
                                            {user.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
                                        </p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Joined</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => {
                                            setSelectedUser(user);
                                            fetchUserDetails(user.id);
                                        }}
                                        className="flex-1 px-3 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                                    >
                                        View Details
                                    </button>
                                    {user.profile_resume_filename && (
                                        <button
                                            onClick={() => downloadUserResume(user.id)}
                                            className="px-3 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                                        >
                                            📄
                                        </button>
                                    )}
                                    {user.linkedin_url && (
                                        <a
                                            href={user.linkedin_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
                                        >
                                            💼
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                ) : (
                    // Table View
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            <input
                                                type="checkbox"
                                                checked={selectedUsers.length === filteredUsers.length && filteredUsers.length > 0}
                                                onChange={selectedUsers.length === filteredUsers.length ? clearSelection : selectAllUsers}
                                                className="w-4 h-4"
                                            />
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Candidate
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Position & Company
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Location
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Experience
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Score
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Skills
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                                            Actions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                                    {filteredUsers.map((user) => (
                                        <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedUsers.includes(user.id)}
                                                    onChange={() => toggleUserSelection(user.id)}
                                                    className="w-4 h-4"
                                                />
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="flex items-center">
                                                    <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                                                        <span className="text-white font-bold text-sm">
                                                            {user.full_name ? user.full_name[0].toUpperCase() : user.email[0].toUpperCase()}
                                                        </span>
                                                    </div>
                                                    <div className="ml-4">
                                                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                                                            {user.full_name || 'No Name'}
                                                        </div>
                                                        <div className="text-sm text-gray-500 dark:text-gray-400">
                                                            {user.email}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm text-gray-900 dark:text-white">
                                                    {user.current_work || 'N/A'}
                                                </div>
                                                <div className="text-sm text-gray-500 dark:text-gray-400">
                                                    {user.current_company || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {user.current_location || 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                                                {user.total_experience ? `${user.total_experience} years` : 'N/A'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {user.latest_score ? (
                                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        user.latest_score >= 80 ? 'bg-green-100 text-green-800' :
                                                        user.latest_score >= 60 ? 'bg-yellow-100 text-yellow-800' :
                                                        'bg-red-100 text-red-800'
                                                    }`}>
                                                        {user.latest_score}%
                                                    </span>
                                                ) : (
                                                    <span className="text-gray-400">N/A</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="flex flex-wrap gap-1 max-w-xs">
                                                    {user.all_skills && user.all_skills.slice(0, 3).map((skill, index) => (
                                                        <span key={index} className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded">
                                                            {skill}
                                                        </span>
                                                    ))}
                                                    {user.all_skills && user.all_skills.length > 3 && (
                                                        <span className="text-xs text-gray-500">+{user.all_skills.length - 3} more</span>
                                                    )}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedUser(user);
                                                            fetchUserDetails(user.id);
                                                        }}
                                                        className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                                    >
                                                        View
                                                    </button>
                                                    {user.profile_resume_filename && (
                                                        <button
                                                            onClick={() => downloadUserResume(user.id)}
                                                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                                                        >
                                                            Resume
                                                        </button>
                                                    )}
                                                    {user.linkedin_url && (
                                                        <a
                                                            href={user.linkedin_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300"
                                                        >
                                                            LinkedIn
                                                        </a>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {filteredUsers.length === 0 && (
                    <div className="text-center py-12">
                        <div className="text-gray-400 text-6xl mb-4">👥</div>
                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No users found</h3>
                        <p className="text-gray-500 dark:text-gray-400">Try adjusting your search or filter criteria.</p>
                    </div>
                )}
            </div>

            {/* User Details Modal */}
            {selectedUser && userDetails && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    {userDetails.full_name || userDetails.email}
                                </h3>
                                <button
                                    onClick={() => {
                                        setSelectedUser(null);
                                        setUserDetails(null);
                                    }}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Personal Info */}
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">👤 Personal Information</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-gray-500">Email:</span> {userDetails.email}</div>
                                    <div><span className="text-gray-500">Phone:</span> {userDetails.phone_number || 'N/A'}</div>
                                    <div><span className="text-gray-500">Age:</span> {userDetails.age || 'N/A'}</div>
                                    <div><span className="text-gray-500">Address:</span> {userDetails.address || 'N/A'}</div>
                                </div>
                            </div>

                            {/* Professional Info */}
                            <div>
                                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">💼 Professional Information</h4>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <div><span className="text-gray-500">Position:</span> {userDetails.current_work || 'N/A'}</div>
                                    <div><span className="text-gray-500">Company:</span> {userDetails.current_company || 'N/A'}</div>
                                    <div><span className="text-gray-500">Location:</span> {userDetails.current_location || 'N/A'}</div>
                                    <div><span className="text-gray-500">Experience:</span> {userDetails.total_experience ? `${userDetails.total_experience} years` : 'N/A'}</div>
                                </div>
                            </div>

                            {/* Skills & Education */}
                            {(userDetails.skills_summary || userDetails.education) && (
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">🎓 Skills & Education</h4>
                                    {userDetails.education && <div className="mb-2"><span className="text-gray-500">Education:</span> {userDetails.education}</div>}
                                    {userDetails.skills_summary && (
                                        <div>
                                            <span className="text-gray-500">Skills:</span>
                                            <div className="mt-1 p-2 bg-blue-50 dark:bg-blue-900/20 rounded text-blue-800 dark:text-blue-200 text-sm">
                                                {userDetails.skills_summary}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Resume History */}
                            {userDetails.resume_history && userDetails.resume_history.length > 0 && (
                                <div>
                                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">📄 Resume History</h4>
                                    <div className="space-y-2">
                                        {userDetails.resume_history.map((resume, index) => (
                                            <div key={index} className="flex justify-between items-center p-3 border border-gray-200 dark:border-gray-600 rounded">
                                                <div>
                                                    <p className="font-medium">{resume.filename}</p>
                                                    <p className="text-sm text-gray-500">
                                                        {new Date(resume.uploaded_at).toLocaleDateString()} • Score: {resume.score || 'N/A'}%
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Analytics Modal */}
            {showAnalytics && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                                    📊 Analytics Dashboard
                                </h3>
                                <button
                                    onClick={() => setShowAnalytics(false)}
                                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                                >
                                    ✕
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-8">
                            {/* Summary Stats */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="bg-gradient-to-r from-blue-500 to-blue-600 p-6 rounded-lg text-white">
                                    <h4 className="text-lg font-semibold mb-2">Total Candidates</h4>
                                    <p className="text-3xl font-bold">{analytics.total_candidates || 0}</p>
                                </div>
                                <div className="bg-gradient-to-r from-green-500 to-green-600 p-6 rounded-lg text-white">
                                    <h4 className="text-lg font-semibold mb-2">Average Score</h4>
                                    <p className="text-3xl font-bold">{Math.round(analytics.average_score || 0)}%</p>
                                </div>
                                <div className="bg-gradient-to-r from-purple-500 to-purple-600 p-6 rounded-lg text-white">
                                    <h4 className="text-lg font-semibold mb-2">Active Profiles</h4>
                                    <p className="text-3xl font-bold">{stats.users_with_profiles || 0}</p>
                                </div>
                            </div>

                            {/* Job Roles Distribution */}
                            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Top Job Roles
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(analytics.job_role_distribution || {}).slice(0, 10).map(([role, count]) => (
                                        <div key={role} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded">
                                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{role}</span>
                                            <span className="ml-2 px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded">
                                                {count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Experience Distribution */}
                            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Experience Distribution
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {Object.entries(analytics.experience_distribution || {}).map(([range, count]) => (
                                        <div key={range} className="text-center bg-white dark:bg-gray-800 p-4 rounded">
                                            <p className="text-2xl font-bold text-gray-900 dark:text-white">{count}</p>
                                            <p className="text-sm text-gray-500 dark:text-gray-400">{range} years</p>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Score Distribution */}
                            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Score Distribution
                                </h4>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {Object.entries(analytics.score_distribution || {}).map(([range, count]) => {
                                        const colorClass = range === '81-100' ? 'bg-green-500' :
                                                          range === '61-80' ? 'bg-yellow-500' :
                                                          range === '41-60' ? 'bg-orange-500' : 'bg-red-500';
                                        return (
                                            <div key={range} className={`${colorClass} text-white p-4 rounded text-center`}>
                                                <p className="text-2xl font-bold">{count}</p>
                                                <p className="text-sm">{range}%</p>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Top Locations */}
                            <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg">
                                <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                                    Top Locations
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {Object.entries(analytics.location_distribution || {}).slice(0, 8).map(([location, count]) => (
                                        <div key={location} className="flex justify-between items-center bg-white dark:bg-gray-800 p-3 rounded">
                                            <span className="text-sm font-medium text-gray-900 dark:text-white truncate">{location}</span>
                                            <span className="ml-2 px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-xs rounded">
                                                {count}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default HRDashboard; 