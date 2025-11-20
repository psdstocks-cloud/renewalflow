import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export function Header() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/sign-in');
  };

  return (
    <header className="w-full border-b border-slate-800 bg-slate-950/80 backdrop-blur sticky top-0 z-30">
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-indigo-500 flex items-center justify-center text-xs font-semibold text-white">
            RF
          </div>
          <span className="text-sm font-semibold text-slate-100">RenewalFlow</span>
        </Link>

        {!user ? (
          <div className="flex items-center gap-3">
            <Link
              to="/auth/sign-in"
              className="text-sm text-slate-300 hover:text-white"
            >
              Log in
            </Link>
            <Link
              to="/auth/sign-up"
              className="inline-flex items-center rounded-full bg-indigo-500 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-400"
            >
              Sign up
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="text-sm text-slate-300 hover:text-white"
            >
              Dashboard
            </Link>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-semibold text-slate-100">
                {user.email?.[0]?.toUpperCase() ?? 'U'}
              </div>
              <button
                onClick={handleLogout}
                className="text-xs text-slate-400 hover:text-red-400"
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
