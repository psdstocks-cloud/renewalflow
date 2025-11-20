import React, { useState } from 'react';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { supabase } from '../../lib/supabaseClient';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email) {
      setError('Email is required.');
      return;
    }

    setIsLoading(true);
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
      if (resetError) {
        throw resetError;
      }
      setSubmitted(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to process request.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Forgot password"
      subtitle="Enter your email and we’ll send you a link to reset your password."
      footerText="Remembered your password?"
      footerLinkText="Back to sign in"
      footerLinkTo="/auth/sign-in"
    >
      {submitted ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-100 p-4 text-sm">
          If this email exists in our system, we sent a reset link.
        </div>
      ) : (
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
          {error && <div className="text-xs text-red-400">{error}</div>}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2 transition disabled:opacity-50"
          >
            {isLoading ? 'Sending...' : 'Send reset link'}
          </button>
        </form>
      )}
    </AuthLayout>
  );
}
