import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const educationLevels = ["High School", "Bachelor's", "Master's", "PhD", "MBA"];
const genders = ["Male", "Female", "Other"];
const jobTitles = [
    "Software Engineer",
    "Data Scientist", 
    "Data Analyst",
    "Machine Learning Engineer",
    "Business Analyst",
    "Product Manager",
    "DevOps Engineer",
    "Full Stack Developer",
    "Frontend Developer",
    "Backend Developer",
    "Mobile Developer",
    "Cloud Engineer",
    "Database Administrator",
    "System Administrator",
    "Network Engineer",
    "Security Engineer",
    "QA Engineer",
    "UI/UX Designer",
    "Project Manager",
    "Technical Lead",
    "Senior Manager",
    "Director",
    "Marketing Manager",
    "Marketing Coordinator",
    "Financial Manager",
    "Operations Manager",
    "Others"
];

function AdvancedSalaryPredictor() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        age: '',
        gender: '',
        education_level: '',
        job_title: '',
        years_of_experience: ''
    });
    
    const [results, setResults] = useState({
        basic: null,
        advanced: null,
        comparison: null
    });
    
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [modelInfo, setModelInfo] = useState(null);
    const [activeTab, setActiveTab] = useState('predict');

    useEffect(() => {
        fetchModelInfo();
    }, []);

    const fetchModelInfo = async () => {
        try {
            const token = localStorage.getItem("token");
            const res = await axios.get('http://localhost:5000/model-info', {
                headers: { Authorization: `Bearer ${token}` }
            });
            setModelInfo(res.data.models);
        } catch (err) {
            console.error('Failed to fetch model info:', err);
        }
    };

    const handleChange = e => {
        const value = e.target.name === 'age' || e.target.name === 'years_of_experience' 
            ? parseInt(e.target.value) 
            : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleCompareModels = async () => {
        setError('');
        setIsLoading(true);

        try {
            const token = localStorage.getItem("token");
            const requestData = {
                age: parseInt(formData.age),
                gender: formData.gender,
                education_level: formData.education_level,
                job_title: formData.job_title,
                years_of_experience: parseInt(formData.years_of_experience)
            };

            const res = await axios.post('http://localhost:5000/compare-predictions', requestData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            
            setResults({
                basic: res.data.basic_model,
                advanced: res.data.advanced_model,
                comparison: res.data.comparison
            });
        } catch (err) {
            setError(err.response?.data?.error || 'Comparison failed');
        } finally {
            setIsLoading(false);
        }
    };

    const validateForm = () => {
        return formData.age && formData.gender && formData.education_level && 
               formData.job_title && formData.years_of_experience;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-6xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="bg-white rounded-2xl shadow-xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-600">
                        <h1 className="text-3xl font-bold text-white text-center">
                            🚀 Advanced Salary Predictor
                        </h1>
                        <p className="mt-2 text-blue-100 text-center">
                            Compare Basic vs Advanced ML Models with Enhanced Features
                        </p>
                    </div>

                    <div className="p-8">
                        {/* Input Form */}
                        <div className="mb-8">
                            <h2 className="text-xl font-semibold mb-4">Enter Your Details</h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Age</label>
                                    <input
                                        type="number"
                                        name="age"
                                        value={formData.age}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                        min="18"
                                        max="70"
                                        placeholder="Enter your age"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Gender</label>
                                    <select
                                        name="gender"
                                        value={formData.gender}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    >
                                        <option value="">Select gender</option>
                                        {genders.map(gender => (
                                            <option key={gender} value={gender}>{gender}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Education Level</label>
                                    <select
                                        name="education_level"
                                        value={formData.education_level}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    >
                                        <option value="">Select education level</option>
                                        {educationLevels.map(level => (
                                            <option key={level} value={level}>{level}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">Job Title</label>
                                    <select
                                        name="job_title"
                                        value={formData.job_title}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                    >
                                        <option value="">Select job title</option>
                                        {jobTitles.map(title => (
                                            <option key={title} value={title}>{title}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700">Years of Experience</label>
                                    <input
                                        type="number"
                                        name="years_of_experience"
                                        value={formData.years_of_experience}
                                        onChange={handleChange}
                                        className="w-full px-4 py-2 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                        required
                                        min="0"
                                        max="50"
                                        placeholder="Enter years of experience"
                                    />
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex flex-wrap gap-4 mt-6 justify-center">
                                <button
                                    onClick={handleCompareModels}
                                    disabled={!validateForm() || isLoading}
                                    className="px-8 py-3 bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-lg hover:from-green-700 hover:to-blue-700 disabled:bg-gray-400 transition-all duration-200 font-medium"
                                >
                                    {isLoading ? 'Analyzing...' : '🚀 Advanced Analysis & Comparison'}
                                </button>
                            </div>

                            <div className="text-center mt-4">
                                <button
                                    onClick={() => navigate('/')}
                                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                                >
                                    ⬅️ Back to Home
                                </button>
                            </div>
                        </div>

                        {/* Error Display */}
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg"
                            >
                                <p className="text-red-600 text-center">{error}</p>
                            </motion.div>
                        )}

                        {/* Results Display */}
                        {(results.basic || results.advanced) && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="space-y-6"
                            >
                                <h2 className="text-2xl font-bold text-center mb-6">🎯 Prediction Results</h2>
                                
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Basic Model Results */}
                                    {results.basic && (
                                        <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                                            <h3 className="text-lg font-semibold text-blue-800 mb-4">
                                                🔍 Basic Model
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="text-center">
                                                    <p className="text-3xl font-bold text-blue-900">
                                                        ${results.basic.predicted_salary?.toLocaleString()}
                                                    </p>
                                                    <p className="text-sm text-blue-600">
                                                        Range: ${results.basic.salary_range?.min?.toLocaleString()} - ${results.basic.salary_range?.max?.toLocaleString()}
                                                    </p>
                                                </div>
                                                <p className="text-sm text-blue-700">
                                                    Model: {results.basic.model_type}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    {/* Advanced Model Results */}
                                    {results.advanced && (
                                        <div className="bg-purple-50 rounded-xl p-6 border border-purple-100">
                                            <h3 className="text-lg font-semibold text-purple-800 mb-4">
                                                🚀 Advanced Model
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="text-center">
                                                    <p className="text-3xl font-bold text-purple-900">
                                                        ${results.advanced.predicted_salary?.toLocaleString()}
                                                    </p>
                                                    <p className="text-sm text-purple-600">
                                                        Range: ${results.advanced.salary_range?.min?.toLocaleString()} - ${results.advanced.salary_range?.max?.toLocaleString()}
                                                    </p>
                                                </div>
                                                
                                                {results.advanced.confidence_interval && (
                                                    <p className="text-sm text-purple-600">
                                                        95% CI: ${results.advanced.confidence_interval.lower?.toLocaleString()} - ${results.advanced.confidence_interval.upper?.toLocaleString()}
                                                    </p>
                                                )}
                                                
                                                {results.advanced.prediction_confidence && (
                                                    <div className="bg-purple-100 rounded-lg p-3">
                                                        <p className="text-sm text-purple-700 text-center">
                                                            🎯 Confidence: {results.advanced.prediction_confidence.toFixed(1)}%
                                                        </p>
                                                    </div>
                                                )}
                                                
                                                <p className="text-sm text-purple-700">
                                                    Model: {results.advanced.model_version}
                                                </p>
                                                
                                                {results.advanced.top_influential_factors && (
                                                    <div className="mt-4">
                                                        <p className="text-sm font-medium text-purple-800 mb-2">🔍 Top Influential Factors:</p>
                                                        <div className="space-y-1">
                                                            {results.advanced.top_influential_factors.map((factor, idx) => (
                                                                <div key={idx} className="flex justify-between text-xs text-purple-600 bg-purple-100 rounded px-2 py-1">
                                                                    <span>{factor.factor}</span>
                                                                    <span className="font-medium">{(factor.importance * 100).toFixed(1)}%</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Comparison Results */}
                                {results.comparison && (
                                    <div className="bg-gradient-to-r from-green-50 to-blue-50 rounded-xl p-6 border border-green-100">
                                        <h3 className="text-lg font-semibold text-green-800 mb-4 text-center">
                                            ⚖️ Model Comparison Analysis
                                        </h3>
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                                            <div className="bg-white rounded-lg p-4">
                                                <p className="text-sm text-green-600">Salary Difference</p>
                                                <p className="text-2xl font-bold text-green-800">
                                                    ${Math.abs(results.comparison.difference).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="bg-white rounded-lg p-4">
                                                <p className="text-sm text-green-600">Percentage Difference</p>
                                                <p className="text-2xl font-bold text-green-800">
                                                    {Math.abs(results.comparison.difference_percentage).toFixed(1)}%
                                                </p>
                                            </div>
                                            <div className="bg-white rounded-lg p-4">
                                                <p className="text-sm text-green-600">Higher Prediction</p>
                                                <p className="text-2xl font-bold text-green-800 capitalize">
                                                    {results.comparison.higher_prediction === 'advanced' ? '🚀 Advanced' : 
                                                     results.comparison.higher_prediction === 'basic' ? '🔍 Basic' : '⚖️ Equal'}
                                                </p>
                                            </div>
                                        </div>
                                        
                                        <div className="mt-4 text-center">
                                            <p className="text-sm text-green-700">
                                                {results.comparison.difference > 0 
                                                    ? "🚀 Advanced model predicts higher salary" 
                                                    : results.comparison.difference < 0 
                                                    ? "🔍 Basic model predicts higher salary"
                                                    : "⚖️ Both models predict the same salary"}
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </motion.div>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}

export default AdvancedSalaryPredictor; 