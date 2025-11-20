import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="animate-pulse text-sm text-slate-400">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth/sign-in" replace key={location.pathname} />;
  }

  return <>{children}</>;
}
