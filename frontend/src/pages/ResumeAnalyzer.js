import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function ResumeAnalyzer() {
    const [file, setFile] = useState(null);
    const [skills, setSkills] = useState([]);
    const [text, setText] = useState('');
    const [score, setScore] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const navigate = useNavigate();

    const handleFileChange = (e) => {
        const uploaded = e.target.files[0];
        if (uploaded && uploaded.type === "application/pdf") {
            setFile(uploaded);
            setError('');
        } else {
            setFile(null);
            setError('❌ Please upload a valid PDF file');
        }
    };

    const handleUpload = async () => {
        if (!file) return;

        const formData = new FormData();
        formData.append("resume", file);
        setLoading(true);
        setSkills([]);
        setText('');
        setError('');
        setScore(null);

        try {
            const res = await axios.post("http://localhost:5000/upload-resume", formData, {
                headers: {
                    Authorization: `Bearer ${localStorage.getItem("token")}`,
                    'Content-Type': 'multipart/form-data'
                }
            });

            setSkills(res.data.skills || []);
            setText(res.data.raw_text || '');
            setScore(res.data.score);
        } catch (err) {
            setError("❌ Upload failed. " + (err.response?.data?.error || err.message));
        } finally {
            setLoading(false);
        }
    };

    return (
        <motion.div
            className="min-h-screen p-6 sm:p-10 bg-gradient-to-br from-green-50 via-blue-50 to-purple-100 dark:bg-gray-900 text-gray-800 dark:text-white"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            {/* 🔙 Back Button */}
            <div className="flex justify-end mb-4">
                <button
                    onClick={() => navigate('/')}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow font-medium"
                >
                    🔙 Back to Home
                </button>
            </div>

            <div className="max-w-4xl mx-auto bg-white/60 dark:bg-gray-800/40 backdrop-blur-lg p-8 rounded-2xl shadow-xl">
                <h1 className="text-3xl font-bold mb-6 text-center">📄 Resume Analyzer</h1>

                <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                    <input
                        type="file"
                        accept=".pdf"
                        onChange={handleFileChange}
                        className="flex-1 border border-gray-300 p-2 rounded"
                    />
                    <button
                        onClick={handleUpload}
                        disabled={loading || !file}
                        className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded shadow disabled:opacity-50"
                    >
                        {loading ? "Analyzing..." : "📤 Upload & Analyze"}
                    </button>
                </div>

                {error && <p className="text-red-600 mb-4 text-sm">{error}</p>}

                {score !== null && (
                    <p className="text-green-700 dark:text-green-300 text-lg font-semibold mb-4">
                        🎯 Resume Score: {score}%
                    </p>
                )}

                {skills.length > 0 && (
                    <div className="mb-6">
                        <h2 className="text-xl font-semibold mb-2">🧠 Extracted Skills:</h2>
                        <div className="flex flex-wrap gap-2">
                            {skills.map((skill, idx) => (
                                <span
                                    key={idx}
                                    className="bg-green-200 text-green-800 dark:bg-green-700 dark:text-white px-3 py-1 rounded-full text-sm"
                                >
                                    {skill}
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                {text && (
                    <div className="mt-6 max-h-80 overflow-auto bg-white/40 dark:bg-gray-700/50 p-4 rounded-lg border border-white/30">
                        <h3 className="text-lg font-semibold mb-2">📝 Resume Preview</h3>
                        <pre className="whitespace-pre-wrap text-sm">{text}</pre>
                    </div>
                )}
            </div>
        </motion.div>
    );
}

export default ResumeAnalyzer;
