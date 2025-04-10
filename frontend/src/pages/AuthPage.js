import React, { useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function AuthPage() {
    const [isLogin, setIsLogin] = useState(true);
    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        confirm: '',
    });
    const [msg, setMsg] = useState('');
    const navigate = useNavigate();

    const toggleForm = () => {
        setIsLogin(!isLogin);
        setForm({ name: '', email: '', password: '', confirm: '' });
        setMsg('');
    };

    const handleChange = (e) => {
        setForm({ ...form, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMsg('');

        if (!form.email || !form.password || (!isLogin && (!form.name || !form.confirm))) {
            return setMsg('❗ Please fill all fields');
        }

        if (!isLogin && form.password !== form.confirm) {
            return setMsg('❗ Passwords do not match');
        }

        try {
            if (isLogin) {
                const res = await axios.post('http://localhost:5000/login', {
                    email: form.email,
                    password: form.password,
                });
                localStorage.setItem('token', res.data.token);
                localStorage.setItem('profile_email', form.email);
                setMsg('✅ Login successful!');
                setTimeout(() => navigate('/'), 800);
            } else {
                await axios.post('http://localhost:5000/register', {
                    name: form.name,
                    email: form.email,
                    password: form.password,
                });
                const loginRes = await axios.post('http://localhost:5000/login', {
                    email: form.email,
                    password: form.password,
                });
                localStorage.setItem('token', loginRes.data.token);
                localStorage.setItem('profile_email', form.email);
                setMsg('✅ Registered and logged in!');
                setTimeout(() => navigate('/'), 1000);
            }
        } catch (err) {
            setMsg(err.response?.data?.error || '❌ Something went wrong');
        }
    };

    return (
        <motion.div
            className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-indigo-100 via-purple-100 to-pink-100 px-4 py-10"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <div className="bg-white/80 backdrop-blur-lg p-8 rounded-xl shadow-xl w-full max-w-md">
                <h2 className="text-2xl font-bold mb-6 text-center text-gray-800">
                    {isLogin ? '🔐 Login to your Account' : '📝 Register a New Account'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {!isLogin && (
                        <input
                            type="text"
                            name="name"
                            value={form.name}
                            onChange={handleChange}
                            placeholder="Full Name"
                            className="input"
                            required
                        />
                    )}
                    <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleChange}
                        placeholder="Email"
                        className="input"
                        required
                    />
                    <input
                        type="password"
                        name="password"
                        value={form.password}
                        onChange={handleChange}
                        placeholder="Password"
                        className="input"
                        required
                    />
                    {!isLogin && (
                        <input
                            type="password"
                            name="confirm"
                            value={form.confirm}
                            onChange={handleChange}
                            placeholder="Confirm Password"
                            className="input"
                            required
                        />
                    )}
                    <button
                        type="submit"
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-lg font-semibold transition"
                    >
                        {isLogin ? 'Login' : 'Register'}
                    </button>
                </form>

                {msg && (
                    <p
                        className={`mt-4 text-sm text-center font-medium ${msg.startsWith('✅') ? 'text-green-600' : 'text-red-600'
                            }`}
                    >
                        {msg}
                    </p>
                )}

                <div className="mt-6 text-center">
                    <button onClick={toggleForm} className="text-sm text-blue-700 underline">
                        {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

export default AuthPage;
