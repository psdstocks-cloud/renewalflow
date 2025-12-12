import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { AuthLayout } from '@/src/components/layout/AuthLayout';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { useLanguage } from '@/src/context/LanguageContext';

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { resetPassword } = useAuth();
  const { lang } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setIsLoading(true);

    try {
      const { error } = await resetPassword(email);
      if (error) {
        setError(error.message);
      } else {
        setMessage(lang === 'en'
          ? 'Check your email for the password reset link.'
          : 'راجع إيميلك، بعتنالك رابط تغيير كلمة المرور.'
        );
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const text = {
    en: {
      title: 'Reset Password',
      subtitle: "Enter your email and we'll send you a link to reset your password.",
      emailLabel: 'Email Address',
      submitBtn: 'Send Reset Link',
      backToSignIn: 'Back to Sign In'
    },
    ar: {
      title: 'نسيت كلمة المرور؟',
      subtitle: 'اكتب إيميلك وهنبعتلك رابط تغير منه كلمة السر.',
      emailLabel: 'البريد الإلكتروني',
      submitBtn: 'إرسال رابط التغيير',
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

        {message && (
          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm">
            <i className="fas fa-check-circle mr-2"></i> {message}
          </div>
        )}

        <Input
          label={t.emailLabel}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="name@company.com"
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
