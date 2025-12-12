import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { AuthLayout } from '@/src/components/layout/AuthLayout';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { useLanguage } from '@/src/context/LanguageContext';

export const ResetPasswordPage: React.FC = () => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { updatePassword } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error } = await updatePassword(password);
      if (error) {
        setError(error.message);
      } else {
        navigate('/auth/sign-in');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const text = {
    en: {
      title: 'Set New Password',
      subtitle: 'Your new password must be different from previous used passwords.',
      passwordLabel: 'New Password',
      submitBtn: 'Reset Password',
      backToSignIn: 'Back to Sign In'
    },
    ar: {
      title: 'تعيين كلمة مرور جديدة',
      subtitle: 'اختار كلمة سر قوية ومختلفة عن القديمة.',
      passwordLabel: 'كلمة المرور الجديدة',
      submitBtn: 'تغيير كلمة المرور',
      backToSignIn: 'رجوع لتسجيل الدخول'
    }
  };

  const t = text[lang];

  return (
    <AuthLayout title={t.title} subtitle={t.subtitle}>
      <form onSubmit={handleSubmit} className="space-y-5">

        {error && (
          <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
            <i className="fas fa-exclamation-circle mr-2"></i> {error}
          </div>
        )}

        <Input
          label={t.passwordLabel}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
        />

        <Button type="submit" variant="primary" fullWidth disabled={isLoading}>
          {isLoading ? <i className="fas fa-spinner fa-spin"></i> : t.submitBtn}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm">
        <Link to="/auth/sign-in" className="text-zinc-500 hover:text-white transition-colors flex items-center justify-center gap-2">
          <i className="fas fa-arrow-left"></i>
          {t.backToSignIn}
        </Link>
      </div>
    </AuthLayout>
  );
};
