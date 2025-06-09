import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  MagnifyingGlassIcon, 
  MapPinIcon, 
  BriefcaseIcon, 
  StarIcon,
  ExclamationTriangleIcon,
  InformationCircleIcon,
  XMarkIcon,
  ChartBarIcon,
  ArrowLeftIcon,
  DocumentTextIcon,
  UserIcon,
  CpuChipIcon
} from '@heroicons/react/24/outline';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/solid';
import { useNavigate } from 'react-router-dom';
import ThemeToggle from '../components/ThemeToggle';

const JobRecommender = () => {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [userProfile, setUserProfile] = useState(null);
  const [skillsAnalysis, setSkillsAnalysis] = useState(null);
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [filters, setFilters] = useState({
    experienceYears: '',
    preferredLocations: [],
    preferredCategories: [],
    topK: 10
  });
  const [availableCategories, setAvailableCategories] = useState([]);
  const [availableLocations, setAvailableLocations] = useState([]);

  useEffect(() => {
    loadAvailableOptions();
    // Auto-load recommendations on component mount
    handleGetRecommendations();
  }, []);

  const loadAvailableOptions = async () => {
    try {
      const token = localStorage.getItem('token');
      const [categoriesRes, locationsRes] = await Promise.all([
        fetch('/api/job-categories', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }),
        fetch('/api/job-locations', {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      if (categoriesRes.ok && locationsRes.ok) {
        const categoriesData = await categoriesRes.json();
        const locationsData = await locationsRes.json();
        
        // Ensure we get arrays from the API response
        setAvailableCategories(Array.isArray(categoriesData.categories) ? categoriesData.categories : []);
        setAvailableLocations(Array.isArray(locationsData.locations) ? locationsData.locations : []);
      } else {
        // Set empty arrays if API calls fail
        setAvailableCategories([]);
        setAvailableLocations([]);
      }
    } catch (error) {
      console.error('Error loading options:', error);
      // Set empty arrays on error
      setAvailableCategories([]);
      setAvailableLocations([]);
    }
  };

  const handleGetRecommendations = async () => {
    if (loading) return;
    
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to get job recommendations');
        setLoading(false);
        return;
      }

      const requestData = {
        experience_years: parseInt(filters.experienceYears) || 0,
        preferred_locations: filters.preferredLocations,
        preferred_categories: filters.preferredCategories,
        top_k: filters.topK
      };

      const response = await fetch('/api/recommend-jobs', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });

      const data = await response.json();

      if (response.ok) {
        setRecommendations(data.recommendations || []);
        setUserProfile(data.user_profile || null);
        setSkillsAnalysis(data.skills_analysis || null);
        
        if (data.recommendations && data.recommendations.length === 0) {
          setError('No job recommendations found. Try adjusting your filters or uploading a more detailed resume.');
        }
      } else {
        setError(data.error || 'Failed to get recommendations');
      }
    } catch (error) {
      console.error('Error getting recommendations:', error);
      setError('Failed to connect to server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSkillsAnalysis = async () => {
    if (!userProfile?.extracted_skills) {
      setError('No skills available for analysis');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/job-market-analysis', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          skills: userProfile.extracted_skills
        })
      });

      const data = await response.json();

      if (response.ok) {
        setSkillsAnalysis(data);
        setShowAnalysisModal(true);
      } else {
        setError(data.error || 'Failed to analyze skills');
      }
    } catch (error) {
      console.error('Error analyzing skills:', error);
      setError('Failed to analyze skills');
    }
  };

  const formatLocation = (location) => {
    if (!location) return 'Location not specified';
    return location.length > 30 ? `${location.substring(0, 30)}...` : location;
  };

  const getScoreColor = (score) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getScoreBadgeColor = (score) => {
    if (score >= 0.8) return 'bg-green-100 text-green-800';
    if (score >= 0.6) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

    return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-blue-900 dark:to-purple-900 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header with Back Button and Theme Toggle */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/')}
              className="flex items-center px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200"
            >
              <ArrowLeftIcon className="h-5 w-5 mr-2" />
              Back to Home
            </button>
            <div className="h-8 w-px bg-gray-300 dark:bg-gray-600"></div>
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-white">
                🎯 Job Recommendations
              </h1>
              <p className="text-lg text-gray-600 dark:text-gray-300 mt-2">
                AI-powered job matching based on your resume skills
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        {/* User Profile Section */}
        {userProfile && (
                  <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 border border-gray-200 dark:border-gray-700 transition-colors duration-300"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <UserIcon className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">Your Profile Analysis</h2>
                  <p className="text-gray-600 dark:text-gray-300">Extracted from: {userProfile.resume_analysis?.resume_filename}</p>
                </div>
              </div>
              <button
                onClick={handleSkillsAnalysis}
                className="flex items-center px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 transition-colors"
              >
                <ChartBarIcon className="h-4 w-4 mr-2" />
                Market Analysis
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg transition-colors duration-300">
                <div className="flex items-center space-x-2 mb-2">
                  <CpuChipIcon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <span className="font-medium text-gray-900 dark:text-white">Skills Extracted</span>
                </div>
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{userProfile.extracted_skills?.length || 0}</p>
              </div>

              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg transition-colors duration-300">
                <div className="flex items-center space-x-2 mb-2">
                  <BriefcaseIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span className="font-medium text-gray-900 dark:text-white">Experience</span>
                </div>
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">{userProfile.experience_years} years</p>
              </div>

              <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg transition-colors duration-300">
                <div className="flex items-center space-x-2 mb-2">
                  <DocumentTextIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  <span className="font-medium text-gray-900 dark:text-white">Resume Status</span>
                </div>
                <p className="text-sm font-medium text-purple-600 dark:text-purple-400">Analyzed & Ready</p>
              </div>
            </div>

            {/* Skills Display */}
            <div className="mt-6">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">Your Skills</h3>
              <div className="flex flex-wrap gap-2">
                {userProfile.extracted_skills?.slice(0, 15).map((skill, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium transition-colors duration-300"
                  >
                    {skill}
                  </span>
                ))}
                {userProfile.extracted_skills?.length > 15 && (
                  <span className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm transition-colors duration-300">
                    +{userProfile.extracted_skills.length - 15} more
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Filters Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-8 border border-gray-200 dark:border-gray-700 transition-colors duration-300"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <MagnifyingGlassIcon className="h-6 w-6 mr-2 text-blue-600 dark:text-blue-400" />
            Refine Your Search
          </h2>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Experience Years
              </label>
              <input
                type="number"
                value={filters.experienceYears}
                onChange={(e) => setFilters(prev => ({ ...prev, experienceYears: e.target.value }))}
                placeholder="Your experience"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Preferred Categories
              </label>
              <select
                multiple
                value={filters.preferredCategories}
                onChange={(e) => {
                  const selected = Array.from(e.target.selectedOptions, option => option.value);
                  setFilters(prev => ({ ...prev, preferredCategories: selected }));
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
              >
                {(availableCategories || []).map(category => (
                  <option key={category} value={category}>{category}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Number of Results
              </label>
              <select
                value={filters.topK}
                onChange={(e) => setFilters(prev => ({ ...prev, topK: parseInt(e.target.value) }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors duration-300"
              >
                <option value={5}>5 Jobs</option>
                <option value={10}>10 Jobs</option>
                <option value={15}>15 Jobs</option>
                <option value={20}>20 Jobs</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={handleGetRecommendations}
                disabled={loading}
                className="w-full bg-blue-600 dark:bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors duration-200 flex items-center justify-center"
              >
                {loading ? (
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                ) : (
                  <>
                    <MagnifyingGlassIcon className="h-4 w-4 mr-2" />
                    Update Search
                  </>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 mb-6 transition-colors duration-300"
          >
            <div className="flex items-center">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-500 dark:text-red-400 mr-2" />
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex justify-center items-center py-12"
          >
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-600 dark:text-gray-300">Analyzing your resume and finding perfect job matches...</p>
            </div>
          </motion.div>
        )}

        {/* Job Recommendations */}
        {!loading && recommendations.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Found {recommendations.length} Perfect Matches
              </h2>
              <div className="text-sm text-gray-600 dark:text-gray-300">
                Sorted by relevance score
              </div>
            </div>

            <div className="grid gap-6">
              {recommendations.map((job, index) => (
                <motion.div
                  key={job.job_id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 hover:shadow-xl dark:hover:shadow-2xl transition-all duration-300 overflow-hidden"
                >
                  {/* Job Header */}
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">{job.position}</h3>
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getScoreBadgeColor(job.overall_score)}`}>
                            {(job.overall_score * 100).toFixed(0)}% Match
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 text-gray-600 mb-3">
                          <span className="font-medium text-blue-600">{job.company}</span>
                          <span className="flex items-center">
                            <MapPinIcon className="h-4 w-4 mr-1" />
                            {formatLocation(job.location)}
                          </span>
                          <span className="flex items-center">
                            <BriefcaseIcon className="h-4 w-4 mr-1" />
                            {job.job_category}
                          </span>
                        </div>

                        {/* Key Highlights */}
                        {job.why_recommended && job.why_recommended.length > 0 && (
                          <div className="flex flex-wrap gap-2 mb-3">
                            {(job.why_recommended || []).map((highlight, idx) => (
                              <span key={idx} className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium">
                                {highlight}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {job.job_url && (
                        <a
                          href={job.job_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="ml-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center"
                        >
                          Apply Now
                          <ArrowTopRightOnSquareIcon className="h-4 w-4 ml-2" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Detailed Reasoning */}
                  <div className="p-6 bg-blue-50">
                    <h4 className="font-semibold text-gray-900 mb-2 flex items-center">
                      <InformationCircleIcon className="h-5 w-5 mr-2 text-blue-600" />
                      Why This Job is Perfect for You
                    </h4>
                    <div 
                      className="text-gray-700 leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: job.recommendation_reasoning.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') }}
                    />
                  </div>

                  {/* Skills and Scores */}
                  <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Matched Skills */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Your Matching Skills</h4>
                        <div className="flex flex-wrap gap-2">
                          {job.matched_skills?.slice(0, 8).map((skill, idx) => (
                            <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-sm">
                              {skill}
                            </span>
                          ))}
                          {job.matched_skills?.length > 8 && (
                            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-sm">
                              +{job.matched_skills.length - 8} more
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Match Scores */}
                      <div>
                        <h4 className="font-semibold text-gray-900 mb-3">Match Analysis</h4>
                        <div className="space-y-2">
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Skills Match:</span>
                            <span className={`font-semibold ${getScoreColor(job.skill_match_score)}`}>
                              {(job.skill_match_score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Experience Match:</span>
                            <span className={`font-semibold ${getScoreColor(job.experience_match_score)}`}>
                              {(job.experience_match_score * 100).toFixed(0)}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center">
                            <span className="text-sm text-gray-600">Overall Score:</span>
                            <span className={`font-semibold ${getScoreColor(job.overall_score)}`}>
                              {(job.overall_score * 100).toFixed(0)}%
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Job Description */}
                    <div className="mt-6">
                      <h4 className="font-semibold text-gray-900 mb-2">Job Description</h4>
                      <p className="text-gray-700 text-sm leading-relaxed">{job.job_description}</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Market Analysis Modal */}
        <AnimatePresence>
          {showAnalysisModal && skillsAnalysis && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              onClick={() => setShowAnalysisModal(false)}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                  <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                    <ChartBarIcon className="h-7 w-7 mr-3 text-blue-600" />
                    Skills Market Analysis
                  </h2>
                  <button
                    onClick={() => setShowAnalysisModal(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <XMarkIcon className="h-6 w-6" />
                  </button>
                </div>

                <div className="p-6">
                  {/* Skills Demand */}
                  <div className="mb-8">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Your Skills Market Demand</h3>
                    <div className="grid gap-4">
                      {Object.entries(skillsAnalysis.user_skills_demand || {}).slice(0, 10).map(([skill, data]) => (
                        <div key={skill} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium text-gray-900">{skill}</span>
                            <span className="text-blue-600 font-semibold">{data.demand_percentage}%</span>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${Math.min(data.demand_percentage, 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-sm text-gray-600 mt-1">
                            Found in {data.job_count} jobs • Typical level: {data.avg_experience_level}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Trending Skills */}
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">Trending Skills in Market</h3>
                    <div className="flex flex-wrap gap-2">
                      {skillsAnalysis.trending_skills?.slice(0, 20).map((skill, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-medium"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Skill Gaps */}
                  {skillsAnalysis.skill_gap_analysis?.length > 0 && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-4">Recommended Skills to Learn</h3>
                      <div className="bg-yellow-50 p-4 rounded-lg">
                        <p className="text-yellow-800 mb-3">
                          These trending skills could boost your market value:
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {(skillsAnalysis.skill_gap_analysis || []).map((skill, index) => (
                            <span
                              key={index}
                              className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium"
                            >
                              {skill}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default JobRecommender;
