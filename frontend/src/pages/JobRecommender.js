import React from 'react';
import { motion } from 'framer-motion';

function JobRecommender() {
    return (
        <motion.div
            className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-100 via-blue-100 to-cyan-100 px-4 py-10"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
        >
            <div className="bg-white/40 backdrop-blur-lg p-10 rounded-2xl shadow-xl w-full max-w-2xl text-center">
                <h1 className="text-3xl font-bold mb-4 text-gray-800">🔍 Job Recommender</h1>
                <p className="text-gray-600">This feature will recommend jobs based on your profile and resume.</p>
                <p className="mt-6 text-blue-500 font-semibold">Coming Soon 🚧</p>
            </div>
        </motion.div>
    );
}

export default JobRecommender;
