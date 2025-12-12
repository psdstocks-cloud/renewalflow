import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { AuthLayout } from '@/src/components/layout/AuthLayout';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { useLanguage } from '@/src/context/LanguageContext';

export const SignUpPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        navigate('/auth/email-confirm');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const text = {
    en: {
      title: 'Create Account',
      subtitle: 'Start your journey with RenewalFlow today.',
      emailLabel: 'Email Address',
      passwordLabel: 'Password',
      signUpBtn: 'Create Account',
      hasAccount: "Already have an account?",
      signIn: 'Sign in'
    },
    ar: {
      title: 'إنشاء حساب جديد',
      subtitle: 'ابدأ رحلتك مع RenewalFlow النهاردة.',
      emailLabel: 'البريد الإلكتروني',
      passwordLabel: 'كلمة المرور',
      signUpBtn: 'إنشاء الحساب',
      hasAccount: 'عندك حساب بالفعل؟',
      signIn: 'تسجيل دخول'
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
          label={t.emailLabel}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          placeholder="name@company.com"
        />

        <Input
          label={t.passwordLabel}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          placeholder="••••••••"
        />

        <Button type="submit" variant="primary" fullWidth disabled={isLoading}>
          {isLoading ? <i className="fas fa-spinner fa-spin"></i> : t.signUpBtn}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-zinc-500">
        {t.hasAccount} {' '}
        <Link to="/auth/sign-in" className="text-violet-400 hover:text-white font-bold transition-colors">
          {t.signIn}
        </Link>
      </div>
    </AuthLayout>
  );
};
