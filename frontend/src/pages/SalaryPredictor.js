import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

const jobTitles = [
    "Data Scientist", "Machine Learning Engineer", "Data Analyst", "Software Engineer", "AI Scientist",
    "Business Intelligence Analyst", "Data Engineer", "Cloud Data Engineer", "Research Scientist", "Analytics Engineer"
];

function SalaryPredictor() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        experience_level: '',
        employment_type: '',
        job_title: '',
        company_size: '',
        remote_ratio: ''
    });
    const [result, setResult] = useState(null);
    const [error, setError] = useState('');

    const handleChange = e => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async e => {
        e.preventDefault();
        setError('');
        setResult(null);

        try {
            const token = localStorage.getItem("token");
            const res = await axios.post('http://localhost:5000/predict', formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setResult(res.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Prediction failed');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-100 to-pink-100 flex items-center justify-center p-6">
            <motion.div
                initial={{ y: 40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.5 }}
                className="w-full max-w-2xl bg-white/60 backdrop-blur-md p-8 rounded-2xl shadow-lg"
            >
                <h1 className="text-3xl font-bold text-center mb-6 text-gray-800">💼 Advanced Salary Predictor</h1>

                <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <Select label="Experience Level" name="experience_level" value={formData.experience_level} onChange={handleChange} options={{ '0': 'Entry', '1': 'Mid', '2': 'Senior', '3': 'Executive' }} />
                    <Select label="Employment Type" name="employment_type" value={formData.employment_type} onChange={handleChange} options={{ '1': 'Full Time', '0': 'Part Time', '2': 'Contract', '3': 'Freelance' }} />
                    <Select label="Job Title" name="job_title" value={formData.job_title} onChange={handleChange} options={jobTitles} />
                    <Select label="Company Size" name="company_size" value={formData.company_size} onChange={handleChange} options={{ 'S': 'Small', 'M': 'Medium', 'L': 'Large' }} />
                    <Select label="Remote Ratio" name="remote_ratio" value={formData.remote_ratio} onChange={handleChange} options={{ '0': 'Onsite (0%)', '50': 'Hybrid (50%)', '100': 'Remote (100%)' }} />

                    <div className="sm:col-span-2 flex flex-col items-center gap-4">
                        <button className="bg-blue-600 text-white px-6 py-3 rounded-lg shadow hover:bg-blue-700 transition">
                            🔍 Predict Salary
                        </button>
                        <button type="button" onClick={() => navigate('/')} className="text-blue-500 hover:underline text-sm">
                            ⬅️ Back to Home
                        </button>
                    </div>
                </form>

                {result && (
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="mt-6 text-center text-green-700 font-semibold text-xl"
                    >
                        💰 Estimated Salary: ${result.predicted_salary.toLocaleString()}
                        <p className="text-sm text-gray-600 mt-2">Range: ${result.salary_range.min.toLocaleString()} - ${result.salary_range.max.toLocaleString()}</p>
                    </motion.div>
                )}

                {error && <p className="mt-4 text-red-600 text-center">{error}</p>}
            </motion.div>
        </div>
    );
}

function Select({ label, name, value, onChange, options }) {
    const optionList = Array.isArray(options)
        ? options.map((opt) => <option key={opt} value={opt}>{opt}</option>)
        : Object.entries(options).map(([val, label]) => <option key={val} value={val}>{label}</option>);

    return (
        <div>
            <label className="block mb-1 text-gray-700 font-medium">{label}</label>
            <select
                name={name}
                value={value}
                onChange={onChange}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white/70 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
            >
                <option value="">Select</option>
                {optionList}
            </select>
        </div>
    );
}

export default SalaryPredictor;
