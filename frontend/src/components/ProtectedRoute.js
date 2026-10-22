import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Renders children only for signed-in users (and only for HR when hrOnly is set). */
function ProtectedRoute({ children, hrOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900" role="status">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent" />
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (hrOnly && !user.is_admin) return <Navigate to="/" replace />;
  return children;
}

export default ProtectedRoute;
