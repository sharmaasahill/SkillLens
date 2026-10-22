import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FeedbackProvider } from './components/ui/overlays';
import ProtectedRoute from './components/ProtectedRoute';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import Profile from './pages/Profile';
import SalaryPredictor from './pages/SalaryPredictor';
import JobRecommender from './pages/JobRecommender';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import HRDashboard from './pages/HRDashboard';

function App() {
  return (
    <AuthProvider>
      <FeedbackProvider>
        <Router>
          <Routes>
            {/* Public routes */}
            <Route path="/" element={<Landing />} />
            <Route path="/auth" element={<Auth />} />

            {/* Candidate routes */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/account" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/salary-predictor" element={<ProtectedRoute><SalaryPredictor /></ProtectedRoute>} />
            <Route path="/advanced-salary-predictor" element={<ProtectedRoute><SalaryPredictor /></ProtectedRoute>} />
            <Route path="/job-recommender" element={<ProtectedRoute><JobRecommender /></ProtectedRoute>} />
            <Route path="/resume-analyzer" element={<ProtectedRoute><ResumeAnalyzer /></ProtectedRoute>} />

            {/* HR routes */}
            <Route path="/hr-dashboard" element={<ProtectedRoute hrOnly><HRDashboard /></ProtectedRoute>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </FeedbackProvider>
    </AuthProvider>
  );
}

export default App;
