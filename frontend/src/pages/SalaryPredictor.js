import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const educationLevels = ["High School", "Bachelor's", "Master's", "PhD"];
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
    "Others"
];

function SalaryPredictor() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        age: '',
        gender: '',
        education_level: '',
        job_title: '',
        years_of_experience: ''
    });
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleChange = e => {
        const value = e.target.name === 'age' || e.target.name === 'years_of_experience' 
            ? parseInt(e.target.value) 
            : e.target.value;
        setFormData({ ...formData, [e.target.name]: value });
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setError('');
        setResult(null);
        setIsLoading(true);

        try {
            const token = localStorage.getItem("token");
            // Ensure all required fields are present and properly formatted
            const requestData = {
                age: parseInt(formData.age),
                gender: formData.gender,
                education_level: formData.education_level,
                job_title: formData.job_title,
                years_of_experience: parseInt(formData.years_of_experience)
            };

            const res = await axios.post('http://localhost:5000/predict', requestData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setResult(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Prediction failed');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
            <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                    className="bg-white rounded-2xl shadow-xl overflow-hidden"
                >
                    <div className="px-8 py-6 bg-gradient-to-r from-blue-600 to-indigo-600">
                        <h1 className="text-3xl font-bold text-white text-center">
                            💼 Salary Predictor
                        </h1>
                        <p className="mt-2 text-blue-100 text-center">
                            Get accurate salary predictions based on your profile
                        </p>
                    </div>

                    <div className="p-8">
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="block text-sm font-medium text-gray-700">
                                        Age
                                    </label>
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
                                    <label className="block text-sm font-medium text-gray-700">
                                        Gender
                                    </label>
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
                                    <label className="block text-sm font-medium text-gray-700">
                                        Education Level
                                    </label>
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
                                    <label className="block text-sm font-medium text-gray-700">
                                        Job Title
                                    </label>
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
                                    <label className="block text-sm font-medium text-gray-700">
                                        Years of Experience
                                    </label>
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

                                                <div className="flex flex-col items-center space-y-4">
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`w-full md:w-auto px-8 py-3 rounded-lg text-white font-medium
                                ${isLoading 
                                    ? 'bg-blue-400 cursor-not-allowed' 
                                    : 'bg-blue-600 hover:bg-blue-700'
                                } transition-colors duration-200`}
                        >
                            {isLoading ? 'Predicting...' : '🔍 Predict Salary'}
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => navigate('/advanced-salary-predictor')}
                            className="w-full md:w-auto px-8 py-3 rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 text-white font-medium hover:from-purple-700 hover:to-blue-700 transition-all duration-200"
                        >
                            🚀 Try Advanced Predictor
                        </button>
                        
                        <button
                            type="button"
                            onClick={() => navigate('/')}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                        >
                            ⬅️ Back to Home
                        </button>
                    </div>
                </form>

                        {error && (
                    <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-6 p-4 bg-red-50 border border-red-200 rounded-lg"
                            >
                                <p className="text-red-600 text-center">{error}</p>
                    </motion.div>
                )}

                        {result && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mt-8 p-6 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border border-green-100"
                            >
                                <div className="text-center">
                                    <h3 className="text-2xl font-bold text-green-700 mb-2">
                                        💰 Estimated Salary
                                    </h3>
                                    <p className="text-4xl font-bold text-green-800 mb-4">
                                        ${result.predicted_salary.toLocaleString()}
                                    </p>
                                    <p className="text-sm text-green-600">
                                        Range: ${result.salary_range.min.toLocaleString()} - ${result.salary_range.max.toLocaleString()}
                                    </p>
                                </div>
                            </motion.div>
                        )}
                    </div>
            </motion.div>
        </div>
        </div>
    );
}

export default SalaryPredictor;
