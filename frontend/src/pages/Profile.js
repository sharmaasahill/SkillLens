import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function Profile() {
    const [message, setMessage] = useState('');
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token');
        if (!token) return navigate('/auth');

        axios.get('http://localhost:5000/profile', {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => setMessage(res.data.message))
            .catch(() => {
                localStorage.removeItem('token');
                navigate('/auth');
            });
    }, [navigate]);

    const logout = () => {
        localStorage.removeItem('token');
        navigate('/');
    };

    return (
        <motion.div
            className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-green-100 via-blue-100 to-indigo-100 p-6"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            <div className="bg-white/60 backdrop-blur p-10 rounded-xl shadow-xl text-center max-w-xl w-full">
                <h2 className="text-3xl font-bold text-gray-800 mb-4">👋 Profile</h2>
                <p className="text-gray-700 text-lg mb-6">{message || 'Loading...'}</p>
                <button
                    onClick={logout}
                    className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded shadow font-semibold"
                >
                    🚪 Logout
                </button>
            </div>
        </motion.div>
    );
}

export default Profile;
