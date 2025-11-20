import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthLayout } from '../../components/auth/AuthLayout';
import { useAuth } from '../../context/AuthContext';

export function EmailConfirmInfoPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  return (
    <AuthLayout title="Check your email" subtitle="We’ve sent you a link to confirm your email. Once confirmed, come back here and sign in.">
      <div className="space-y-6 text-sm text-slate-200">
        <p>
          Confirmation links can take a minute to arrive. If you don’t see it, check your spam folder or request another from the sign-in page.
        </p>
        <button
          onClick={() => navigate('/auth/sign-in')}
          className="w-full rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white font-medium py-2"
        >
          Back to Sign in
        </button>
      </div>
    </AuthLayout>
  );
}
