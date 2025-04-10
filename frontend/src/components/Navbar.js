import React from 'react';
import { Link } from 'react-router-dom';

function Navbar() {
    return (
        <nav className="bg-white shadow-md px-6 py-3 sticky top-0 z-50">
            <ul className="flex space-x-6 justify-center items-center font-medium text-gray-700">
                <li><Link to="/" className="hover:text-blue-600">Home</Link></li>
                <li><Link to="/salary-predictor" className="hover:text-blue-600">Salary Predictor</Link></li>
                <li><Link to="/job-recommender" className="hover:text-blue-600">Job Recommender</Link></li>
                <li><Link to="/resume-analyzer" className="hover:text-blue-600">Resume Analyzer</Link></li>
            </ul>
        </nav>
    );
}

export default Navbar;
