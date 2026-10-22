import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Home from './pages/Home';
import Auth from './pages/Auth';
import SalaryPredictor from './pages/SalaryPredictor';
import AdvancedSalaryPredictor from './pages/AdvancedSalaryPredictor';
import JobRecommender from './pages/JobRecommender';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import HRDashboard from './pages/HRDashboard';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/auth" element={<Auth />} />

            {/* Protected routes */}
            <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
            <Route path="/salary-predictor" element={<ProtectedRoute><SalaryPredictor /></ProtectedRoute>} />
            <Route path="/advanced-salary-predictor" element={<ProtectedRoute><AdvancedSalaryPredictor /></ProtectedRoute>} />
            <Route path="/job-recommender" element={<ProtectedRoute><JobRecommender /></ProtectedRoute>} />
            <Route path="/resume-analyzer" element={<ProtectedRoute><ResumeAnalyzer /></ProtectedRoute>} />
            <Route path="/hr-dashboard" element={<ProtectedRoute hrOnly><HRDashboard /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
