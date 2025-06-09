import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import Home from './pages/Home';
import Auth from './pages/Auth';
import SalaryPredictor from './pages/SalaryPredictor';
import AdvancedSalaryPredictor from './pages/AdvancedSalaryPredictor';
import JobRecommender from './pages/JobRecommender';
import ResumeAnalyzer from './pages/ResumeAnalyzer';
import Profile from './pages/Profile';
import AdminPage from './pages/AdminPage';
import AdminLogin from './pages/AdminLogin';
import HRDashboard from './pages/HRDashboard';

function App() {
  // Check if user is authenticated
  const isAuthenticated = () => {
    return localStorage.getItem('token') !== null;
  };

  // Protected Route component
  const ProtectedRoute = ({ children }) => {
    if (!isAuthenticated()) {
      return <Navigate to="/auth" replace />;
    }
    return children;
  };

  return (
    <ThemeProvider>
      <Router>
        <Routes>
          {/* Public routes */}
          <Route path="/auth" element={<Auth />} />
          
          {/* Protected routes */}
          <Route path="/" element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          } />
          <Route path="/salary-predictor" element={
            <ProtectedRoute>
              <SalaryPredictor />
            </ProtectedRoute>
          } />
          <Route path="/advanced-salary-predictor" element={
            <ProtectedRoute>
              <AdvancedSalaryPredictor />
            </ProtectedRoute>
          } />
          <Route path="/job-recommender" element={
            <ProtectedRoute>
              <JobRecommender />
            </ProtectedRoute>
          } />
          <Route path="/resume-analyzer" element={
            <ProtectedRoute>
              <ResumeAnalyzer />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={<Profile />} />
          <Route path="/hr-dashboard" element={
            <ProtectedRoute>
              <HRDashboard />
            </ProtectedRoute>
          } />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/admin-login" element={<AdminLogin />} />
        </Routes>
      </Router>
    </ThemeProvider>
  );
}

export default App;
