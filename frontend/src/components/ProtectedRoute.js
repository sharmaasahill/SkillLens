import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

/** Three bouncing dots in the product colours, shown while a page or session loads. */
export function PageLoader() {
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

/** Where each kind of account lives after signing in. */
export const homeFor = (user) => (user?.is_admin ? '/hr-dashboard' : '/dashboard');

/**
 * Renders children only for signed-in users of the right kind. HR accounts and candidate
 * accounts are separate: HR pages are HR-only, and candidate pages are candidate-only.
 */
function ProtectedRoute({ children, hrOnly = false }) {
  const { user, loading } = useAuth();

  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/auth" replace />;
  if (hrOnly !== Boolean(user.is_admin)) return <Navigate to={homeFor(user)} replace />;
  return children;
}

export default ProtectedRoute;
