import React, { useState } from 'react';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth } from '../../context/AuthContext';

export function SignUpPage() {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setIsLoading(true);
    try {
      const result = await signUp({ email, password });
      if (result.confirmationEmailSent || !result.session) {
        setSuccessMessage(`Check your email (${email}) to confirm your account.`);
      } else {
        setSuccessMessage('Account created. Redirect to dashboard after first login.');
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create account.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Start tracking renewals with RenewalFlow"
      footerText="Already have an account?"
      footerLinkText="Sign in instead"
      footerLinkTo="/auth/sign-in"
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
        <div className="space-y-2">
          <label className="text-sm text-slate-300" htmlFor="confirmPassword">Confirm password</label>
          <input
            id="confirmPassword"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 focus:border-indigo-400 focus:outline-none"
            placeholder="••••••••"
            required
          />
        </div>
        {error && <div className="text-xs text-red-400">{error}</div>}
        {successMessage && <div className="text-xs text-emerald-400">{successMessage}</div>}
        <button
          type="submit"
          disabled={isLoading}
          className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2 transition disabled:opacity-50"
        >
          {isLoading ? 'Creating account...' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
