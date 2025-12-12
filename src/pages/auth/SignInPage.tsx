import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { AuthLayout } from '@/src/components/layout/AuthLayout';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { useLanguage } from '@/src/context/LanguageContext';

export const SignInPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        navigate('/dashboard');
      }
    } catch (err) {
      setError('An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const text = {
    en: {
      title: 'Welcome Back',
      subtitle: 'Sign in to access your dashboard.',
      emailLabel: 'Email Address',
      passwordLabel: 'Password',
      forgotPassword: 'Forgot Password?',
      signInBtn: 'Sign In',
      noAccount: "Don't have an account?",
      signUp: 'Sign up'
    },
    ar: {
      title: 'أهلاً بعودتك',
      subtitle: 'سجل دخولك عشان تتابع شغلك.',
      emailLabel: 'البريد الإلكتروني',
      passwordLabel: 'كلمة المرور',
      forgotPassword: 'نسيت كلمة السر؟',
      signInBtn: 'تسجيل الدخول',
      noAccount: 'لسه معندكش حساب؟',
      signUp: 'اشترك الآن'
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

        <div>
          <Input
            label={t.passwordLabel}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
          />
          <div className="flex justify-end mt-1">
            <Link to="/auth/forgot-password" className="text-xs text-violet-400 hover:text-violet-300 font-medium transition-colors">
              {t.forgotPassword}
            </Link>
          </div>
        </div>

        <Button type="submit" variant="primary" fullWidth disabled={isLoading}>
          {isLoading ? <i className="fas fa-spinner fa-spin"></i> : t.signInBtn}
        </Button>
      </form>

      <div className="mt-8 text-center text-sm text-zinc-500">
        {t.noAccount} {' '}
        <Link to="/auth/sign-up" className="text-violet-400 hover:text-white font-bold transition-colors">
          {t.signUp}
        </Link>
      </div>
    </AuthLayout>
  );
};
