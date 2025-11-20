import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth } from '../../context/AuthContext';
import { apiFetch } from '../../services/apiClient';

export function SignInPage() {
  const navigate = useNavigate();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password) {
      setError('Email and password are required.');
      return;
    }

    setIsLoading(true);
    try {
      await signIn({ email, password });
      await apiFetch('/api/workspaces/bootstrap', { method: 'POST' });
      navigate('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to manage renewals"
      footerText="Don’t have an account?"
      footerLinkText="Create one"
      footerLinkTo="/auth/sign-up"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm text-slate-300" htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none"
            placeholder="you@example.com"
            required
          />
        </div>
        <div className="space-y-2">
          <label className="text-sm text-slate-300" htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none"
            placeholder="••••••••"
            required
          />
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-red-400 text-xs h-4">{error}</span>
          <Link to="/auth/forgot-password" className="text-indigo-400 hover:text-indigo-300">
            Forgot password?
          </Link>
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2 transition disabled:opacity-50"
        >
          {isLoading ? 'Signing in...' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
