import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function AdminLogin() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [msg, setMsg] = useState('');
    const navigate = useNavigate();

    const handleLogin = (e) => {
        e.preventDefault();

        if (email === 'anupamharsh2002@gmail.com' && password === 'admin123') {
            localStorage.setItem('admin_token', 'admin_is_logged_in');
            navigate('/admin'); // ✅ redirect to admin page
        } else {
            setMsg('❌ Invalid admin credentials');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-tr from-yellow-100 via-pink-100 to-red-100 p-6">
            <div className="bg-white shadow-xl rounded-xl p-8 w-full max-w-md text-center">
                <h2 className="text-3xl font-bold mb-6 text-gray-800">🔐 Admin Login</h2>
                <form onSubmit={handleLogin} className="space-y-4">
                    <input
                        type="email"
                        placeholder="Admin Email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-4 py-2 border rounded"
                        required
                    />
                    <input
                        type="password"
                        placeholder="Admin Password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-2 border rounded"
                        required
                    />
                    <button className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded font-semibold">
                        Login as Admin
                    </button>
                </form>
                {msg && <p className="mt-4 text-sm text-red-600">{msg}</p>}
            </div>
        </div>
    );
}

export default AdminLogin;
