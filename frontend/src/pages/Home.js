import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

function Home() {
    const [profile, setProfile] = useState('');
    const [dark, setDark] = useState(() => localStorage.getItem('theme') === 'dark');
    const [resumeHistory, setResumeHistory] = useState([]);
    const navigate = useNavigate();

    // Handle theme toggle
    useEffect(() => {
        if (dark) {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
        }
    }, [dark]);

    // Load user email and fetch resume history
    useEffect(() => {
        const email = localStorage.getItem('profile_email');
        const token = localStorage.getItem('token');
        if (email) setProfile(email);

        if (token) {
            axios.get("http://localhost:5000/resume-history", {
                headers: { Authorization: `Bearer ${token}` }
            })
                .then(res => setResumeHistory(res.data))
                .catch(err => console.error("Resume history fetch error:", err));
        }
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('profile_email');
        setProfile('');
        setResumeHistory([]);
        navigate('/');
    };

    return (
        <motion.div
            className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 text-gray-800 dark:text-white flex flex-col items-center justify-center px-4 py-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8 }}
        >
            {/* 🌙 Theme Toggle */}
            <div className="absolute top-4 right-4">
                <button
                    onClick={() => setDark(prev => !prev)}
                    className="bg-white dark:bg-gray-700 shadow-lg px-3 py-2 rounded-xl text-sm font-semibold hover:scale-105 transition"
                >
                    {dark ? '☀️ Light Mode' : '🌙 Dark Mode'}
                </button>
            </div>

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

                {/* 🔐 Auth Buttons */}
                <div className="flex justify-center items-center space-x-4 mb-10">
                    {profile ? (
                        <>
                            <span className="bg-white/70 dark:bg-gray-800 px-4 py-2 rounded-xl shadow text-blue-700 dark:text-yellow-300 font-semibold">
                                👋 Welcome, {profile}
                            </span>
                            <button
                                onClick={handleLogout}
                                className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 shadow"
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={() => navigate('/auth')}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl font-semibold shadow-lg transition"
                        >
                            🔐 Login / Register
                        </button>
                    )}
                </div>

                {/* 🛠️ Tools */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 px-4 mb-10">
                    <Card title="📊 Salary Predictor" desc="Know your worth with accurate salary estimates." link="/salary-predictor" color="from-blue-500 to-blue-700" />
                    <Card title="💼 Job Recommender" desc="Find your perfect job match using AI." link="/job-recommender" color="from-purple-500 to-purple-700" />
                    <Card title="📄 Resume Analyzer" desc="Optimize your resume with smart analysis." link="/resume-analyzer" color="from-green-500 to-green-700" />
                </div>

                {/* 📂 Resume History */}
                {resumeHistory.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white/60 dark:bg-gray-900/60 p-6 rounded-xl shadow-lg"
                    >
                        <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">🕓 Resume Analysis History</h2>
                        <div className="overflow-x-auto">
                            <table className="min-w-full text-left text-sm table-auto">
                                <thead className="bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white">
                                    <tr>
                                        <th className="px-4 py-2">Filename</th>
                                        <th className="px-4 py-2">Skills</th>
                                        <th className="px-4 py-2">Score</th>
                                        <th className="px-4 py-2">Timestamp</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {resumeHistory.map((r) => (
                                        <tr key={r.id} className="bg-white/30 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
                                            <td className="px-4 py-2 font-semibold">{r.filename}</td>
                                            <td className="px-4 py-2">{r.skills}</td>
                                            <td className="px-4 py-2 text-center text-green-700 dark:text-green-400">{r.score}</td>
                                            <td className="px-4 py-2 text-sm">{r.timestamp}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </motion.div>
        </motion.div>
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
