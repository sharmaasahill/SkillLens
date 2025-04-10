import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';

function AdminPage() {
    const [users, setUsers] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const token = localStorage.getItem('token'); // ✅ Use real JWT token
        if (!token) {
            navigate('/auth');
            return;
        }

        axios.get('http://localhost:5000/users', {
            headers: { Authorization: `Bearer ${token}` },
        })
            .then(res => setUsers(res.data))
            .catch(err => {
                console.error('Access denied:', err);
                navigate('/auth');
            })
            .finally(() => setLoading(false));
    }, [navigate]);

    const handleDelete = async (id) => {
        const token = localStorage.getItem('token');
        try {
            await axios.delete(`http://localhost:5000/delete-user/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            setUsers(prev => prev.filter(user => user.id !== id));
        } catch (err) {
            alert('❌ Failed to delete user.');
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        navigate('/auth');
    };

    const filteredUsers = users.filter(user =>
        user.email.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <motion.div
            className="min-h-screen p-10 bg-gradient-to-br from-blue-50 to-purple-100"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
        >
            <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-lg p-6">
                <div className="flex items-center justify-between mb-6">
                    <h1 className="text-3xl font-bold text-gray-800">👥 Registered Users</h1>
                    <button
                        onClick={handleLogout}
                        className="text-sm bg-red-600 text-white px-4 py-1 rounded hover:bg-red-700"
                    >
                        🔓 Logout Admin
                    </button>
                </div>

                <input
                    type="text"
                    placeholder="🔍 Search by email"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full mb-4 px-4 py-2 border border-gray-300 rounded"
                />

                {loading ? (
                    <p className="text-center text-gray-500">Loading users...</p>
                ) : filteredUsers.length > 0 ? (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="py-2 px-4 border-b">ID</th>
                                <th className="py-2 px-4 border-b">Email</th>
                                <th className="py-2 px-4 border-b">Password (Hash)</th>
                                <th className="py-2 px-4 border-b text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50">
                                    <td className="py-2 px-4 border-b">{user.id}</td>
                                    <td className="py-2 px-4 border-b">{user.email}</td>
                                    <td className="py-2 px-4 border-b text-xs text-gray-600">{user.password}</td>
                                    <td className="py-2 px-4 border-b text-right">
                                        <button
                                            onClick={() => handleDelete(user.id)}
                                            className="text-red-600 hover:text-red-800 font-semibold"
                                        >
                                            🗑️ Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <p className="text-gray-600 text-center">No users found.</p>
                )}
            </div>
        </motion.div>
    );
}

export default AdminPage;
