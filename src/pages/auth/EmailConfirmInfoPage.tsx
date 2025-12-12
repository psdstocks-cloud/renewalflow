import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';
import { AuthLayout } from '@/src/components/layout/AuthLayout';
import { Button } from '@/src/components/ui/Button';
import { useLanguage } from '@/src/context/LanguageContext';

export const EmailConfirmInfoPage: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { lang } = useLanguage();

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const text = {
    en: {
      title: 'Check your email',
      subtitle: 'We’ve sent you a link to confirm your email. Once confirmed, come back here and sign in.',
      info: 'Confirmation links can take a minute to arrive. If you don’t see it, check your spam folder.',
      backToSignIn: 'Back to Sign In'
    },
    ar: {
      title: 'راجع بريدك الإلكتروني',
      subtitle: 'بعتنالك رابط تفعيل على الإيميل لتوثيق حسابك. بعد التفعيل، ارجع هنا وسجل دخولك.',
      info: 'ممكن الرسالة تاخد دقيقة عشان توصل. لو ملقيتهاش في الـ Inbox، دور في الـ Spam.',
      backToSignIn: 'رجوع لتسجيل الدخول'
    }
  };

  const t = text[lang];

  return (
    <AuthLayout title={t.title} subtitle={t.subtitle}>
      <div className="space-y-6 text-sm text-zinc-400">
        <p className="leading-relaxed border-l-2 border-violet-500 pl-4 bg-violet-500/5 p-3 rounded-r-lg">
          {t.info}
        </p>
        <Button
          variant="secondary"
          fullWidth
          onClick={() => navigate('/auth/sign-in')}
        >
          {t.backToSignIn}
        </Button>
      </div>
    </AuthLayout>
  );
};
