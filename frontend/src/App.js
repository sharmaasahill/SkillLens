import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { FeedbackProvider } from './components/ui/overlays';
import ProtectedRoute, { PageLoader } from './components/ProtectedRoute';
import ScrollToTop from './components/ScrollToTop';

// Each page is its own bundle, so visitors only download the page they open
const Landing = lazy(() => import('./pages/Landing'));
const Auth = lazy(() => import('./pages/Auth'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Profile = lazy(() => import('./pages/Profile'));
const SalaryPredictor = lazy(() => import('./pages/SalaryPredictor'));
const JobRecommender = lazy(() => import('./pages/JobRecommender'));
const ResumeAnalyzer = lazy(() => import('./pages/ResumeAnalyzer'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));

function App() {
  return (
    <AuthProvider>
      <FeedbackProvider>
        <Router>
          <ScrollToTop />
          <Suspense fallback={<PageLoader />}>
            <Routes>
              {/* Public routes */}
              <Route path="/" element={<Landing />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/privacy" element={<Privacy />} />

              {/* User routes */}
              <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
              <Route path="/account" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/salary-predictor" element={<ProtectedRoute><SalaryPredictor /></ProtectedRoute>} />
              <Route path="/advanced-salary-predictor" element={<ProtectedRoute><SalaryPredictor /></ProtectedRoute>} />
              <Route path="/job-recommender" element={<ProtectedRoute><JobRecommender /></ProtectedRoute>} />
              <Route path="/resume-analyzer" element={<ProtectedRoute><ResumeAnalyzer /></ProtectedRoute>} />

              {/* Admin route: only the admin account gets past ProtectedRoute */}
              <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </Router>
      </FeedbackProvider>
    </AuthProvider>
  );
}

export default App;
