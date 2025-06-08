import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const Home = () => {
    const navigate = useNavigate();
    const [dark, setDark] = useState(false);
    const [profile, setProfile] = useState({
        email: '',
        full_name: '',
        phone_number: '',
        address: '',
        age: '',
        current_work: '',
        current_company: '',
        current_location: '',
        total_experience: '',
        linkedin_url: '',
        website_url: '',
        bio: '',
        is_admin: false
    });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [profileMessage, setProfileMessage] = useState('');
    const [userProfile, setUserProfile] = useState({
        email: localStorage.getItem('email') || '',
        full_name: '',
        phone_number: '',
        address: '',
        age: '',
        current_work: '',
        current_company: '',
        current_location: '',
        total_experience: '',
        linkedin_url: '',
        website_url: '',
        bio: ''
    });
    const [editForm, setEditForm] = useState({
        full_name: '',
        phone_number: '',
        address: '',
        age: '',
        current_work: '',
        current_company: '',
        current_location: '',
        total_experience: '',
        linkedin_url: '',
        website_url: '',
        bio: '',
        skills_summary: '',
        education: '',
        certifications: '',
        languages: '',
        achievements: ''
    });
    const [resumeHistory, setResumeHistory] = useState([]);
    const [userStats, setUserStats] = useState({
        totalResumes: 0,
        averageScore: 0,
        topSkills: [],
        lastUpload: null
    });
    const [profileHistory, setProfileHistory] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [uploadError, setUploadError] = useState('');
    const [profileResumeUploading, setProfileResumeUploading] = useState(false);
    const [profileResumeMessage, setProfileResumeMessage] = useState('');
    const [isAdmin, setIsAdmin] = useState(false);
    const [showAllUsers, setShowAllUsers] = useState(false);
    const [allUsers, setAllUsers] = useState([]);
    const [quickStats, setQuickStats] = useState({
        totalUploads: 0,
        thisWeekUploads: 0,
        improvementTips: [],
        nextGoals: []
    });

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) {
            navigate('/auth', { replace: true });
            return;
        }

        const fetchProfileData = async () => {
            try {
                const [profileResponse, historyResponse] = await Promise.all([
                    axios.get('http://localhost:5000/profile', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    }),
                    axios.get('http://localhost:5000/profile/history', {
                        headers: { 'Authorization': `Bearer ${token}` }
                    })
                ]);

                setProfile(profileResponse.data);
                setProfileHistory(historyResponse.data.history);
                setUserProfile(profileResponse.data);
                setEditForm({
                    full_name: profileResponse.data.full_name || '',
                    phone_number: profileResponse.data.phone_number || '',
                    address: profileResponse.data.address || '',
                    age: profileResponse.data.age || '',
                    current_work: profileResponse.data.current_work || '',
                    current_company: profileResponse.data.current_company || '',
                    current_location: profileResponse.data.current_location || '',
                    total_experience: profileResponse.data.total_experience || '',
                    linkedin_url: profileResponse.data.linkedin_url || '',
                    website_url: profileResponse.data.website_url || '',
                    bio: profileResponse.data.bio || '',
                    skills_summary: profileResponse.data.skills_summary || '',
                    education: profileResponse.data.education || '',
                    certifications: profileResponse.data.certifications || '',
                    languages: profileResponse.data.languages || '',
                    achievements: profileResponse.data.achievements || ''
                });
            } catch (err) {
                console.error('Profile fetch error:', err);
                if (err.response?.status === 401 || err.response?.status === 422) {
                    localStorage.removeItem('token');
                    localStorage.removeItem('userEmail');
                    navigate('/auth', { replace: true });
                } else {
                    setError('Failed to load profile data');
                }
            } finally {
                setLoading(false);
            }
        };

        fetchProfileData();
        fetchResumeHistory();
    }, [navigate]);

    useEffect(() => {
        if (dark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [dark]);

    const handleProfileEdit = () => {
        setIsEditing(true);
        setProfileMessage('');
    };

    const handleEditChange = (e) => {
        const { name, value } = e.target;
        setEditForm(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleProfileSave = async () => {
        try {
        const token = localStorage.getItem('token');
            const response = await axios.put('http://localhost:5000/update-profile', editForm, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.data.user) {
                setUserProfile(response.data.user);
                setProfile(response.data.user);
                setIsEditing(false);
                setProfileMessage('Profile updated successfully!');
                setTimeout(() => setProfileMessage(''), 3000);
                
                // Refresh profile data
                const profileResponse = await axios.get('http://localhost:5000/profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setUserProfile(profileResponse.data);
                setProfile(profileResponse.data);
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            setProfileMessage(error.response?.data?.error || 'Failed to update profile');
        }
    };

    const handleProfileResumeUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        if (file.type !== 'application/pdf') {
            setProfileResumeMessage('Please upload a PDF file');
            return;
        }

        if (file.size > 16 * 1024 * 1024) {
            setProfileResumeMessage('File size should be less than 16MB');
            return;
        }

        setProfileResumeUploading(true);
        setProfileResumeMessage('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('http://localhost:5000/profile/upload-resume', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.message) {
                setProfileResumeMessage('Resume uploaded successfully!');
                
                // Refresh profile data to get updated resume info
                const profileResponse = await axios.get('http://localhost:5000/profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                setUserProfile(profileResponse.data);
                setProfile(profileResponse.data);
                
                setTimeout(() => setProfileResumeMessage(''), 3000);
            }
        } catch (error) {
            console.error('Profile resume upload error:', error);
            setProfileResumeMessage(error.response?.data?.error || 'Failed to upload resume');
        } finally {
            setProfileResumeUploading(false);
            event.target.value = '';
        }
    };

    const downloadProfileResume = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('http://localhost:5000/profile/download-resume', {
                headers: { 'Authorization': `Bearer ${token}` },
                responseType: 'blob'
            });

            // Create download link
            const url = window.URL.createObjectURL(new Blob([response.data]));
            const link = document.createElement('a');
            link.href = url;
            link.setAttribute('download', userProfile.profile_resume_filename || 'profile_resume.pdf');
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error('Download error:', error);
            setProfileResumeMessage('Failed to download resume');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userEmail');
        setProfile({
            email: '',
            full_name: '',
            phone_number: '',
            address: '',
            age: '',
            is_admin: false
        });
        navigate('/auth', { replace: true });
    };

    const handleProfileUpdate = async (e) => {
        e.preventDefault();
        const token = localStorage.getItem('token');
        
        try {
            const response = await axios.put('http://localhost:5000/update-profile', profile, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            // Refresh profile data after update
            const [profileResponse, historyResponse] = await Promise.all([
                axios.get('http://localhost:5000/profile', {
                    headers: { 'Authorization': `Bearer ${token}` }
                }),
                axios.get('http://localhost:5000/profile/history', {
                    headers: { 'Authorization': `Bearer ${token}` }
                })
            ]);

            setProfile(profileResponse.data);
            setProfileHistory(historyResponse.data.history);
            setUserProfile(profileResponse.data);
            setEditForm({
                full_name: profileResponse.data.full_name || '',
                phone_number: profileResponse.data.phone_number || '',
                address: profileResponse.data.address || '',
                age: profileResponse.data.age || ''
            });
            setError('');
            setProfileMessage('Profile updated successfully');
        } catch (err) {
            console.error('Profile update error:', err);
            if (err.response?.status === 401 || err.response?.status === 422) {
                localStorage.removeItem('token');
                localStorage.removeItem('userEmail');
                navigate('/auth', { replace: true });
            } else {
                setError('Failed to update profile');
            }
        }
    };

    const calculateUserStats = (resumes) => {
        if (!resumes || resumes.length === 0) {
            return {
                totalResumes: 0,
                averageScore: 0,
                topSkills: [],
                lastUpload: null
            };
        }

        // Calculate total resumes
        const totalResumes = resumes.length;

        // Calculate average score
        const averageScore = Math.round(
            resumes.reduce((acc, curr) => acc + (curr.score || 0), 0) / totalResumes
        );

        // Get top skills using utility function
        const skillCounts = {};
        resumes.forEach(resume => {
            const skills = normalizeSkills(resume.skills);
            skills.forEach(skill => {
                skillCounts[skill] = (skillCounts[skill] || 0) + 1;
            });
        });
        const topSkills = Object.entries(skillCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 5)
            .map(([skill]) => skill);

        // Get last upload
        const lastUpload = resumes[0] ? new Date(resumes[0].timestamp || resumes[0].uploaded_at).toLocaleDateString() : null;

        return {
            totalResumes,
            averageScore,
            topSkills,
            lastUpload
        };
    };

    const handleFileUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // Check file type
        if (file.type !== 'application/pdf') {
            setUploadError('Please upload a PDF file');
            return;
        }

        // Check file size (16MB limit)
        if (file.size > 16 * 1024 * 1024) {
            setUploadError('File size should be less than 16MB');
            return;
        }

        setUploading(true);
        setUploadError('');

        const formData = new FormData();
        formData.append('file', file);

        try {
            const token = localStorage.getItem('token');
            const response = await axios.post('http://localhost:5000/upload-resume', formData, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            if (response.data.skills) {
                // Show success message with better UX
                setUploadError('');
                
                // Create a temporary success message
                const tempDiv = document.createElement('div');
                tempDiv.className = 'fixed top-4 right-4 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300';
                tempDiv.innerHTML = '✅ Resume uploaded and analyzed successfully!';
                document.body.appendChild(tempDiv);
                
                setTimeout(() => {
                    tempDiv.remove();
                }, 3000);
                
                // Refresh resume history
                await fetchResumeHistory();
            }
        } catch (err) {
            console.error('Upload error:', err);
            setUploadError(err.response?.data?.message || 'Failed to upload resume');
        } finally {
            setUploading(false);
            // Clear the file input
            event.target.value = '';
        }
    };

    const fetchResumeHistory = async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await axios.get('http://localhost:5000/resume-history', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const resumes = response.data.resumes || [];
            setResumeHistory(resumes);
            
            // Calculate stats
            const stats = calculateUserStats(resumes);
            setUserStats(stats);
            
            // Calculate quick stats
            const quickStatsData = calculateQuickStats(resumes);
            setQuickStats(quickStatsData);
        } catch (err) {
            console.error('Error fetching resume history:', err);
        }
    };

    const handleDeleteResume = async (resumeId, filename) => {
        if (!window.confirm(`Are you sure you want to delete "${filename}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const token = localStorage.getItem('token');
            await axios.delete(`http://localhost:5000/resume-history/${resumeId}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            // Show success message
            const tempDiv = document.createElement('div');
            tempDiv.className = 'fixed top-4 right-4 bg-red-500 text-white px-6 py-3 rounded-lg shadow-lg z-50 transform transition-all duration-300';
            tempDiv.innerHTML = '🗑️ Resume deleted successfully!';
            document.body.appendChild(tempDiv);
            
            setTimeout(() => {
                tempDiv.remove();
            }, 3000);

            // Refresh the resume history
            await fetchResumeHistory();
        } catch (err) {
            console.error('Error deleting resume:', err);
            alert(err.response?.data?.error || 'Failed to delete resume');
        }
    };

    // Utility function to normalize skills data
    const normalizeSkills = (skills) => {
        if (!skills) return [];
        
        if (typeof skills === 'string') {
            return skills.split(',').map(skill => skill.trim()).filter(skill => skill);
        } else if (Array.isArray(skills)) {
            return skills.map(skill => String(skill).trim()).filter(skill => skill);
        } else if (typeof skills === 'object') {
            return Object.values(skills).flat().map(skill => String(skill).trim()).filter(skill => skill);
        }
        
        return [];
    };

    const calculateQuickStats = (resumes) => {
        const totalUploads = resumes.length;
        
        // Calculate this week uploads
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        const thisWeekUploads = resumes.filter(resume => {
            const uploadDate = new Date(resume.timestamp || resume.uploaded_at);
            return uploadDate > oneWeekAgo;
        }).length;

        // Generate improvement tips based on average score
        let improvementTips = [];
        if (totalUploads > 0) {
            const averageScore = Math.round(
                resumes.reduce((acc, curr) => acc + (curr.score || 0), 0) / totalUploads
            );
            
            if (averageScore < 70) {
                improvementTips = [
                    "Add more quantified achievements",
                    "Include industry-specific keywords",
                    "Improve resume structure"
                ];
            } else if (averageScore < 85) {
                improvementTips = [
                    "Enhance technical skills section",
                    "Add more action verbs",
                    "Optimize for ATS compatibility"
                ];
            } else {
                improvementTips = [
                    "Your resume is performing well!",
                    "Keep updating with new skills",
                    "Tailor for specific job applications"
                ];
            }
        }

        // Generate next goals
        const nextGoals = [
            "Upload updated resume monthly",
            "Achieve 90+ resume score",
            "Explore salary predictions",
            "Get personalized job recommendations"
        ];

        return {
            totalUploads,
            thisWeekUploads,
            improvementTips,
            nextGoals
        };
    };

    if (loading) {
    return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-xl">Loading...</div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <div className="text-xl text-red-600">{error}</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-gray-800 dark:text-white relative">
            {/* Enhanced Profile Details - Fixed Top Left */}
            {profile && (
                <div className="fixed top-4 left-4 z-[100]">
                    <button
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center space-x-3 bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl rounded-2xl px-4 py-3 shadow-xl hover:bg-white dark:hover:bg-gray-800 transition-all duration-300 border border-white/30 dark:border-gray-700/40 min-w-[240px]"
                    >
                        <div className="relative flex-shrink-0">
                            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold text-lg shadow-lg">
                                {userProfile.full_name ? userProfile.full_name.charAt(0).toUpperCase() : userProfile.email.charAt(0).toUpperCase()}
                            </div>
                            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-white dark:border-gray-800"></div>
                        </div>
                        <div className="text-left flex-1 min-w-0">
                            <div className="font-semibold text-gray-900 dark:text-white text-sm truncate">
                                {userProfile.full_name || 'Complete Profile'}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 truncate">
                                {userProfile.current_work || userProfile.email}
                            </div>
                        </div>
                        <span className="text-gray-400 dark:text-gray-500 transition-transform duration-200 flex-shrink-0" style={{transform: isProfileOpen ? 'rotate(180deg)' : 'rotate(0deg)'}}>
                            ▼
                        </span>
                    </button>

                    {isProfileOpen && (
        <motion.div
                            initial={{ opacity: 0, y: -20, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -20, scale: 0.95 }}
                            className="absolute top-full left-0 mt-3 w-[420px] bg-white/98 dark:bg-gray-800/98 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/30 dark:border-gray-700/40 overflow-hidden max-h-[calc(100vh-100px)]"
                        >
                                {/* Header */}
                                <div className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 dark:from-blue-500/20 dark:to-purple-500/20 p-4 border-b border-gray-200/50 dark:border-gray-700/50">
                                    <div className="flex justify-between items-center">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
                                                👤
                                            </div>
                                            <h3 className="text-lg font-bold text-gray-900 dark:text-white">Professional Profile</h3>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!isEditing ? (
                                                <button
                                                    onClick={handleProfileEdit}
                                                    className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                                                >
                                                    ✏️ Edit
                                                </button>
                                            ) : (
                                                <div className="flex gap-2">
                                                    <button
                                                        onClick={() => {setIsEditing(false); setProfileMessage('');}}
                                                        className="px-3 py-1.5 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-colors"
                                                    >
                                                        ✕ Cancel
                                                    </button>
                                                    <button
                                                        onClick={handleProfileSave}
                                                        className="px-3 py-1.5 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
                                                    >
                                                        💾 Save
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    
                                    {profileMessage && (
        <motion.div
                                            initial={{ opacity: 0, y: -10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className={`mt-3 p-2 rounded-lg text-sm ${
                                                profileMessage.includes('success') 
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                                    : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                            }`}
                                        >
                                            {profileMessage}
                                        </motion.div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-4 max-h-96 overflow-y-auto">
                                    {isEditing ? (
                                        <div className="space-y-4">
                                            {/* Personal Information */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                    👤 Personal Information
                                                </h4>
                                                <div className="grid grid-cols-1 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Email (Read-only)</label>
                                                        <input
                                                            type="email"
                                                            value={userProfile.email}
                                                            disabled
                                                            className="w-full p-2 text-sm rounded-lg border bg-gray-100 dark:bg-gray-700 dark:border-gray-600 cursor-not-allowed text-gray-500"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Full Name</label>
                                                        <input
                                                            type="text"
                                                            name="full_name"
                                                            value={editForm.full_name}
                                                            onChange={handleEditChange}
                                                            placeholder="Enter your full name"
                                                            className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Phone</label>
                                                            <input
                                                                type="tel"
                                                                name="phone_number"
                                                                value={editForm.phone_number}
                                                                onChange={handleEditChange}
                                                                placeholder="+1 (555) 123-4567"
                                                                className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Age</label>
                                                            <input
                                                                type="number"
                                                                name="age"
                                                                value={editForm.age}
                                                                onChange={handleEditChange}
                                                                placeholder="25"
                                                                min="18"
                                                                max="100"
                                                                className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Address</label>
                                                        <input
                                                            type="text"
                                                            name="address"
                                                            value={editForm.address}
                                                            onChange={handleEditChange}
                                                            placeholder="City, State, Country"
                                                            className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Professional Information */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                    💼 Professional Information
                                                </h4>
                                                <div className="grid grid-cols-1 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Current Position</label>
                                                        <input
                                                            type="text"
                                                            name="current_work"
                                                            value={editForm.current_work}
                                                            onChange={handleEditChange}
                                                            placeholder="e.g., Senior Software Engineer"
                                                            className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Current Company</label>
                                                        <input
                                                            type="text"
                                                            name="current_company"
                                                            value={editForm.current_company}
                                                            onChange={handleEditChange}
                                                            placeholder="e.g., Tech Corp Inc."
                                                            className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Location</label>
                                                            <input
                                                                type="text"
                                                                name="current_location"
                                                                value={editForm.current_location}
                                                                onChange={handleEditChange}
                                                                placeholder="San Francisco, CA"
                                                                className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Experience (years)</label>
                                                            <input
                                                                type="number"
                                                                name="total_experience"
                                                                value={editForm.total_experience}
                                                                onChange={handleEditChange}
                                                                placeholder="3.5"
                                                                step="0.5"
                                                                min="0"
                                                                max="50"
                                                                className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Advanced Profile Information */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                    🎓 Education & Skills
                                                </h4>
                                                <div className="grid grid-cols-1 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Education Background</label>
                                                        <input
                                                            type="text"
                                                            name="education"
                                                            value={editForm.education}
                                                            onChange={handleEditChange}
                                                            placeholder="e.g., BS Computer Science, Stanford University"
                                                            className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Key Skills Summary</label>
                                                        <textarea
                                                            name="skills_summary"
                                                            value={editForm.skills_summary}
                                                            onChange={handleEditChange}
                                                            placeholder="e.g., Python, JavaScript, React, Node.js, AWS, Docker..."
                                                            rows="2"
                                                            className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-3">
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Certifications</label>
                                                            <textarea
                                                                name="certifications"
                                                                value={editForm.certifications}
                                                                onChange={handleEditChange}
                                                                placeholder="e.g., AWS Solutions Architect, PMP"
                                                                rows="2"
                                                                className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Languages</label>
                                                            <input
                                                                type="text"
                                                                name="languages"
                                                                value={editForm.languages}
                                                                onChange={handleEditChange}
                                                                placeholder="e.g., English (Native), Spanish (Fluent)"
                                                                className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Key Achievements</label>
                                                        <textarea
                                                            name="achievements"
                                                            value={editForm.achievements}
                                                            onChange={handleEditChange}
                                                            placeholder="e.g., Led team of 10 engineers, Increased system performance by 40%..."
                                                            rows="3"
                                                            className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Profile Resume Upload */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                    📄 Profile Resume
                                                </h4>
                                                <div className="space-y-3">
                                                    {userProfile.profile_resume_filename ? (
                                                        <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-green-600 dark:text-green-400">📄</span>
                                                                <div>
                                                                    <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                                                        Resume uploaded
                                                                    </p>
                                                                    <p className="text-xs text-green-600 dark:text-green-400">
                                                                        {userProfile.profile_resume_uploaded_at ? 
                                                                            new Date(userProfile.profile_resume_uploaded_at).toLocaleDateString() : 
                                                                            'Recently uploaded'
                                                                        }
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <button
                                                                onClick={downloadProfileResume}
                                                                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition-colors"
                                                            >
                                                                Download
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-center">
                                                            <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">No profile resume uploaded</p>
                                                        </div>
                                                    )}
                                                    
                                                    <div className="flex items-center gap-2">
                                                        <label className="flex-1 cursor-pointer bg-blue-500 hover:bg-blue-600 text-white text-sm px-4 py-2 rounded-lg transition-colors flex items-center justify-center gap-2">
                                                            {profileResumeUploading ? (
                                                                <>
                                                                    <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                                                                    Uploading...
                                                                </>
                                                            ) : (
                                                                <>
                                                                    📤 Upload New Resume
                                                                </>
                                                            )}
                                                            <input
                                                                type="file"
                                                                accept=".pdf"
                                                                onChange={handleProfileResumeUpload}
                                                                disabled={profileResumeUploading}
                                                                className="hidden"
                                                            />
                                                        </label>
                                                    </div>
                                                    
                                                    {profileResumeMessage && (
                                                        <div className={`p-2 rounded-lg text-xs ${
                                                            profileResumeMessage.includes('success') 
                                                                ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                                                                : 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                                                        }`}>
                                                            {profileResumeMessage}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Links & Bio */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                    🔗 Links & Bio
                                                </h4>
                                                <div className="grid grid-cols-1 gap-3">
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">LinkedIn URL</label>
                                                        <input
                                                            type="url"
                                                            name="linkedin_url"
                                                            value={editForm.linkedin_url}
                                                            onChange={handleEditChange}
                                                            placeholder="https://linkedin.com/in/yourprofile"
                                                            className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Portfolio/Website</label>
                                                        <input
                                                            type="url"
                                                            name="website_url"
                                                            value={editForm.website_url}
                                                            onChange={handleEditChange}
                                                            placeholder="https://yourportfolio.com"
                                                            className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Professional Bio</label>
                                                        <textarea
                                                            name="bio"
                                                            value={editForm.bio}
                                                            onChange={handleEditChange}
                                                            placeholder="A brief professional summary about yourself..."
                                                            rows="3"
                                                            className="w-full p-2 text-sm rounded-lg border border-gray-300 dark:bg-gray-700 dark:border-gray-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all resize-none"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {/* Personal Info Display */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                    👤 Personal Information
                                                </h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-600 dark:text-gray-400">Email:</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{userProfile.email}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-600 dark:text-gray-400">Name:</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{userProfile.full_name || 'Not set'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-600 dark:text-gray-400">Phone:</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{userProfile.phone_number || 'Not set'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-600 dark:text-gray-400">Age:</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{userProfile.age || 'Not set'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-start">
                                                        <span className="text-gray-600 dark:text-gray-400">Address:</span>
                                                        <span className="font-medium text-gray-900 dark:text-white text-right">{userProfile.address || 'Not set'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Professional Info Display */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                    💼 Professional Information
                                                </h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-600 dark:text-gray-400">Position:</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{userProfile.current_work || 'Not set'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-600 dark:text-gray-400">Company:</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{userProfile.current_company || 'Not set'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-600 dark:text-gray-400">Location:</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">{userProfile.current_location || 'Not set'}</span>
                                                    </div>
                                                    <div className="flex justify-between items-center">
                                                        <span className="text-gray-600 dark:text-gray-400">Experience:</span>
                                                        <span className="font-medium text-gray-900 dark:text-white">
                                                            {userProfile.total_experience ? `${userProfile.total_experience} years` : 'Not set'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Education & Skills Display */}
                                            {(userProfile.education || userProfile.skills_summary || userProfile.certifications || userProfile.languages || userProfile.achievements) && (
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                        🎓 Education & Skills
                                                    </h4>
                                                    <div className="space-y-2 text-sm">
                                                        {userProfile.education && (
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-gray-600 dark:text-gray-400">Education:</span>
                                                                <span className="font-medium text-gray-900 dark:text-white text-right max-w-60">{userProfile.education}</span>
                                                            </div>
                                                        )}
                                                        {userProfile.skills_summary && (
                                                            <div>
                                                                <span className="text-gray-600 dark:text-gray-400 block mb-1">Skills:</span>
                                                                <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded-lg">
                                                                    <p className="text-blue-800 dark:text-blue-200 text-xs leading-relaxed">
                                                                        {userProfile.skills_summary}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                        )}
                                                        {userProfile.certifications && (
                                                            <div>
                                                                <span className="text-gray-600 dark:text-gray-400 block mb-1">Certifications:</span>
                                                                <p className="text-gray-900 dark:text-white text-xs leading-relaxed bg-purple-50 dark:bg-purple-900/20 p-2 rounded-lg">
                                                                    {userProfile.certifications}
                                                                </p>
                                                            </div>
                                                        )}
                                                        {userProfile.languages && (
                                                            <div className="flex justify-between items-start">
                                                                <span className="text-gray-600 dark:text-gray-400">Languages:</span>
                                                                <span className="font-medium text-gray-900 dark:text-white text-right max-w-60">{userProfile.languages}</span>
                                                            </div>
                                                        )}
                                                        {userProfile.achievements && (
                                                            <div>
                                                                <span className="text-gray-600 dark:text-gray-400 block mb-1">Achievements:</span>
                                                                <p className="text-gray-900 dark:text-white text-xs leading-relaxed bg-green-50 dark:bg-green-900/20 p-2 rounded-lg">
                                                                    {userProfile.achievements}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Profile Resume Display */}
                                            <div>
                                                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                    📄 Profile Resume
                                                </h4>
                                                {userProfile.profile_resume_filename ? (
                                                    <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-green-600 dark:text-green-400">📄</span>
                                                            <div>
                                                                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                                                                    Resume uploaded
                                                                </p>
                                                                <p className="text-xs text-green-600 dark:text-green-400">
                                                                    {userProfile.profile_resume_uploaded_at ? 
                                                                        new Date(userProfile.profile_resume_uploaded_at).toLocaleDateString() : 
                                                                        'Recently uploaded'
                                                                    }
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={downloadProfileResume}
                                                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg transition-colors"
                                                        >
                                                            Download
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <div className="p-3 bg-gray-50 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-600 rounded-lg text-center">
                                                        <p className="text-sm text-gray-600 dark:text-gray-400">No profile resume uploaded</p>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Links & Bio Display */}
                                            {(userProfile.linkedin_url || userProfile.website_url || userProfile.bio) && (
                                                <div>
                                                    <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 flex items-center gap-2">
                                                        🔗 Links & Bio
                                                    </h4>
                                                    <div className="space-y-2 text-sm">
                                                        {userProfile.linkedin_url && (
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-gray-600 dark:text-gray-400">LinkedIn:</span>
                                                                <a href={userProfile.linkedin_url} target="_blank" rel="noopener noreferrer" 
                                                                   className="text-blue-500 hover:text-blue-600 text-xs truncate max-w-40">
                                                                    View Profile
                                                                </a>
                                                            </div>
                                                        )}
                                                        {userProfile.website_url && (
                                                            <div className="flex justify-between items-center">
                                                                <span className="text-gray-600 dark:text-gray-400">Website:</span>
                                                                <a href={userProfile.website_url} target="_blank" rel="noopener noreferrer" 
                                                                   className="text-blue-500 hover:text-blue-600 text-xs truncate max-w-40">
                                                                    Visit Site
                                                                </a>
                                                            </div>
                                                        )}
                                                        {userProfile.bio && (
                                                            <div>
                                                                <span className="text-gray-600 dark:text-gray-400 block mb-1">Bio:</span>
                                                                <p className="text-gray-900 dark:text-white text-xs leading-relaxed bg-gray-50 dark:bg-gray-700/50 p-2 rounded-lg">
                                                                    {userProfile.bio}
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                    )}
                </div>

                                {/* Footer */}
                                <div className="p-4 border-t border-gray-200/50 dark:border-gray-700/50 bg-gray-50/50 dark:bg-gray-900/50">
                                    <button
                                        onClick={handleLogout}
                                        className="w-full bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 flex items-center justify-center gap-2 shadow-lg"
                                    >
                                        🚪 Sign Out
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </div>
                )}

            {/* 🌙 Theme Toggle */}
            <div className="fixed top-4 right-4 z-50">
                <button
                    onClick={() => setDark(prev => !prev)}
                    className="bg-white/95 dark:bg-gray-800/95 backdrop-blur-xl shadow-xl px-4 py-3 rounded-2xl text-sm font-semibold hover:scale-105 transition-all duration-300 border border-white/30 dark:border-gray-700/40"
                >
                    {dark ? '☀️ Light Mode' : '🌙 Dark Mode'}
                </button>
            </div>

            {/* Main Content Container */}
            <motion.div
                className="flex flex-col items-center justify-center px-4 py-10 min-h-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.8 }}
            >
            <motion.div
                className="w-full max-w-6xl bg-white/40 dark:bg-white/10 backdrop-blur-xl shadow-2xl rounded-3xl p-10 text-center border border-white/20 dark:border-white/10"
                initial={{ y: 50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.8 }}
            >
                <h1 className="text-5xl sm:text-6xl font-extrabold mb-4 drop-shadow-lg">
                    IT Career Navigator
                </h1>
                <p className="text-lg sm:text-xl mb-6 font-medium max-w-3xl mx-auto">
                    Navigate your tech career with AI-powered tools. Predict your salary, discover your dream job, and optimize your resume.
                </p>

                    {/* Auth Button */}
                    {!profile && (
                        <div className="flex justify-center items-center mb-10">
                        <button
                            onClick={() => navigate('/auth')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-semibold shadow-lg transition"
                        >
                            🔐 Login / Register
                        </button>
                        </div>
                    )}

                {/* Quick Upload Section */}
                {profile && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mb-8 bg-gradient-to-r from-emerald-500/20 to-blue-500/20 dark:from-emerald-500/10 dark:to-blue-500/10 rounded-xl p-6 shadow-lg border border-emerald-200 dark:border-emerald-500/30"
                    >
                        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                            <div className="text-center md:text-left">
                                <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-white">
                                    🚀 Quick Resume Analysis
                                </h3>
                                <p className="text-gray-600 dark:text-gray-300 text-sm">
                                    Upload your resume for instant AI-powered analysis and scoring
                                </p>
                </div>
                            <div className="flex flex-col items-center gap-3">
                                <label className="cursor-pointer bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-700 hover:to-blue-700 text-white px-6 py-3 rounded-xl font-semibold shadow-lg transition transform hover:scale-105 flex items-center gap-2">
                                    <span>📤</span>
                                    <span>{uploading ? 'Analyzing...' : 'Upload Resume'}</span>
                                    <input
                                        type="file"
                                        accept=".pdf"
                                        onChange={handleFileUpload}
                                        disabled={uploading}
                                        className="hidden"
                                    />
                                </label>
                                {uploadError && (
                                    <p className="text-red-500 text-xs text-center">{uploadError}</p>
                                )}
                            </div>
                </div>
                    </motion.div>
                )}

                {/* Feature Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 px-4 mb-10">
                    <Card title="📊 Salary Predictor" desc="Know your worth with accurate salary estimates." link="/salary-predictor" color="from-blue-500 to-blue-700" />
                    <Card title="💼 Job Recommender" desc="Find your perfect job match using AI." link="/job-recommender" color="from-purple-500 to-purple-700" />
                    <Card title="📄 Resume Analyzer" desc="Optimize your resume with smart analysis." link="/resume-analyzer" color="from-green-500 to-green-700" />
                </div>

                {/* Enhanced Profile Dashboard */}
                {profile && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4 }}
                        className="mb-10 space-y-6"
                    >
                        {/* Main Stats */}
                        <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-lg">
                            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">📊 Your Dashboard</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 p-4 rounded-lg shadow border border-blue-200 dark:border-blue-700">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-medium text-blue-700 dark:text-blue-300">Total Resumes</h3>
                                            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{userStats.totalResumes}</p>
                                        </div>
                                        <div className="text-3xl">📊</div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 p-4 rounded-lg shadow border border-green-200 dark:border-green-700">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-medium text-green-700 dark:text-green-300">Average Score</h3>
                                            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{userStats.averageScore}%</p>
                                        </div>
                                        <div className="text-3xl">🎯</div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 p-4 rounded-lg shadow border border-purple-200 dark:border-purple-700">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300">This Week</h3>
                                            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{quickStats.thisWeekUploads}</p>
                                        </div>
                                        <div className="text-3xl">📈</div>
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/30 dark:to-orange-800/30 p-4 rounded-lg shadow border border-orange-200 dark:border-orange-700">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="text-sm font-medium text-orange-700 dark:text-orange-300">Last Upload</h3>
                                            <p className="text-xs text-orange-600 dark:text-orange-400 truncate">
                                                {userStats.lastUpload || 'No uploads yet'}
                                            </p>
                                        </div>
                                        <div className="text-3xl">🕒</div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Skills & Tips Section */}
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Top Skills */}
                            <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-lg">
                                <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
                                    ⭐ Top Skills
                                </h3>
                                {userStats.topSkills.length > 0 ? (
                                    <div className="flex flex-wrap gap-2">
                                        {userStats.topSkills.map((skill, idx) => (
                                            <span key={idx} className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-sm">
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 dark:text-gray-400">Upload a resume to see your top skills</p>
                                )}
                            </div>

                            {/* Improvement Tips */}
                            <div className="bg-white/60 dark:bg-gray-800/60 rounded-xl p-6 shadow-lg">
                                <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
                                    💡 Improvement Tips
                                </h3>
                                <div className="space-y-2">
                                    {quickStats.improvementTips.map((tip, idx) => (
                                        <div key={idx} className="flex items-start gap-2">
                                            <span className="text-emerald-500 mt-1">•</span>
                                            <span className="text-sm text-gray-600 dark:text-gray-300">{tip}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Next Goals */}
                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 shadow-lg border border-indigo-200 dark:border-indigo-700">
                            <h3 className="text-lg font-bold mb-4 text-gray-800 dark:text-white flex items-center gap-2">
                                🎯 Your Next Goals
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {quickStats.nextGoals.map((goal, idx) => (
                                    <div key={idx} className="flex items-center gap-3 bg-white/50 dark:bg-gray-800/50 p-3 rounded-lg">
                                        <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                            {idx + 1}
                                        </div>
                                        <span className="text-sm text-gray-700 dark:text-gray-300">{goal}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* Enhanced Resume History */}
                {profile && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.5 }}
                        className="bg-white/60 dark:bg-gray-900/60 p-6 rounded-xl shadow-lg"
                    >
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                                📚 Resume Upload History
                            </h2>
                            <div className="flex items-center gap-2 mt-2 sm:mt-0">
                                <span className="text-sm text-gray-500 dark:text-gray-400">
                                    Total: {resumeHistory.length} uploads
                                </span>
                                {resumeHistory.length > 0 && (
                                    <button 
                                        onClick={fetchResumeHistory}
                                        className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium"
                                    >
                                        🔄 Refresh
                                    </button>
                                )}
                            </div>
                        </div>

                        {resumeHistory.length > 0 ? (
                            <div className="space-y-4">
                                {/* Desktop Table View */}
                                <div className="hidden md:block overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead className="bg-gradient-to-r from-gray-100 to-gray-200 dark:from-gray-700 dark:to-gray-800 text-gray-800 dark:text-white">
                                            <tr>
                                                <th className="px-4 py-3 rounded-l-lg font-semibold">📄 Resume</th>
                                                <th className="px-4 py-3 font-semibold">🎯 Score</th>
                                                <th className="px-4 py-3 font-semibold">⚡ Skills Found</th>
                                                <th className="px-4 py-3 font-semibold">📅 Date</th>
                                                <th className="px-4 py-3 rounded-r-lg font-semibold">🗑️ Actions</th>
                                    </tr>
                                </thead>
                                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                            {resumeHistory.map((resume, idx) => (
                                                <tr key={resume.id} className="bg-white/50 dark:bg-gray-800/50 hover:bg-white/70 dark:hover:bg-gray-800/70 transition-colors">
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                                                                {idx + 1}
                                                            </div>
                                                            <div>
                                                                <p className="font-medium text-gray-900 dark:text-white truncate max-w-[200px]" title={resume.filename}>
                                                                    {resume.filename}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex items-center gap-2">
                                                            <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                                                                (resume.score || 0) >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                                (resume.score || 0) >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                                'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                            }`}>
                                                                {Math.round(resume.score || 0)}%
                                                            </div>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <div className="flex flex-wrap gap-1 max-w-[300px]">
                                                            {(() => {
                                                                const skills = normalizeSkills(resume.skills);
                                                                return (
                                                                    <>
                                                                        {skills.slice(0, 3).map((skill, skillIdx) => (
                                                                            <span key={skillIdx} className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded text-xs">
                                                                                {skill}
                                                                            </span>
                                                                        ))}
                                                                        {skills.length > 3 && (
                                                                            <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                                +{skills.length - 3} more
                                                                            </span>
                                                                        )}
                                                                    </>
                                                                );
                                                            })()}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-300">
                                                        {new Date(resume.timestamp || resume.uploaded_at).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-4 py-3">
                                                        <button
                                                            onClick={() => handleDeleteResume(resume.id, resume.filename)}
                                                            className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                            title="Delete resume"
                                                        >
                                                            🗑️
                                                        </button>
                                                    </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                                {/* Mobile Card View */}
                                <div className="md:hidden space-y-4">
                                    {resumeHistory.map((resume, idx) => (
                                        <div key={resume.id} className="bg-white/70 dark:bg-gray-800/70 p-4 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
                                            <div className="flex items-start justify-between mb-3">
                                                <div className="flex items-center gap-2 flex-1">
                                                    <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center text-blue-600 dark:text-blue-400 text-xs font-bold">
                                                        {idx + 1}
                                                    </div>
                                                    <h3 className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[140px]" title={resume.filename}>
                                                        {resume.filename}
                                                    </h3>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <div className={`px-2 py-1 rounded-full text-xs font-medium ${
                                                        (resume.score || 0) >= 80 ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' :
                                                        (resume.score || 0) >= 60 ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200' :
                                                        'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                                                    }`}>
                                                        {Math.round(resume.score || 0)}%
                                                    </div>
                                                    <button
                                                        onClick={() => handleDeleteResume(resume.id, resume.filename)}
                                                        className="text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                                                        title="Delete resume"
                                                    >
                                                        🗑️
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="mb-2">
                                                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Skills:</p>
                                                <div className="flex flex-wrap gap-1">
                                                    {(() => {
                                                        const skills = normalizeSkills(resume.skills);
                                                        return (
                                                            <>
                                                                {skills.slice(0, 4).map((skill, skillIdx) => (
                                                                    <span key={skillIdx} className="bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 px-2 py-0.5 rounded text-xs">
                                                                        {skill}
                                                                    </span>
                                                                ))}
                                                                {skills.length > 4 && (
                                                                    <span className="text-xs text-gray-500 dark:text-gray-400">
                                                                        +{skills.length - 4} more
                                                                    </span>
                                                                )}
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">
                                                📅 {new Date(resume.timestamp || resume.uploaded_at).toLocaleDateString()}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <div className="text-center py-12">
                                <div className="text-6xl mb-4">📄</div>
                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No resume uploads yet</h3>
                                <p className="text-gray-500 dark:text-gray-400 mb-4">
                                    Upload your first resume to start tracking your analysis history
                                </p>
                                <button
                                    onClick={() => navigate('/resume-analyzer')}
                                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                                >
                                    Upload Resume
                                </button>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* Profile History Section */}
                {profileHistory.length > 0 && (
                    <div className="mt-8">
                        <h3 className="text-lg font-medium text-gray-900 mb-4">Profile History</h3>
                        <div className="bg-gray-50 rounded-lg p-4">
                            <div className="space-y-4">
                                {profileHistory.map((history, index) => (
                                    <div key={index} className="border-b border-gray-200 pb-4 last:border-0">
                                        <p className="text-sm text-gray-500">
                                            Changed on: {new Date(history.changed_at).toLocaleString()}
                                        </p>
                                        <div className="mt-2 grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Full Name</p>
                                                <p className="text-sm text-gray-900">{history.full_name}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Phone Number</p>
                                                <p className="text-sm text-gray-900">{history.phone_number}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Address</p>
                                                <p className="text-sm text-gray-900">{history.address}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium text-gray-700">Age</p>
                                                <p className="text-sm text-gray-900">{history.age}</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Admin Section */}
                {isAdmin && (
                    <div className="bg-white shadow rounded-lg p-6 mt-6">
                        {/* ... keep existing admin section ... */}
                    </div>
                )}
            </motion.div>
        </motion.div>
        </div>
    );
}

function Card({ title, desc, link, color }) {
    return (
        <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.97 }}
            className={`bg-gradient-to-br ${color} text-white p-6 rounded-2xl shadow-lg hover:shadow-2xl transition cursor-pointer`}
            onClick={() => (window.location.href = link)}
        >
            <h3 className="text-xl font-bold mb-1">{title}</h3>
            <p className="text-sm opacity-90">{desc}</p>
        </motion.div>
    );
}

export default Home;
