import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Renders children only for signed-in users (and only for HR when hrOnly is set). */
function ProtectedRoute({ children, hrOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#fbfbfd]" role="status">
        <div className="flex gap-2" aria-hidden="true">
          {['#34c759', '#007aff', '#af52de'].map((color, i) => (
            <span
              key={color}
              className="h-3 w-3 animate-bounce rounded-full"
              style={{ background: color, animationDelay: `${i * 0.12}s` }}
            />
          ))}
        </div>
        <span className="sr-only">Loading</span>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (hrOnly && !user.is_admin) return <Navigate to="/dashboard" replace />;
  return children;
}

export default ProtectedRoute;
