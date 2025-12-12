import React from 'react';
import { useLanguage } from '@/src/context/LanguageContext';
import { Link } from 'react-router-dom';

interface AuthLayoutProps {
    children: React.ReactNode;
    title: string;
    subtitle: string;
}

export const AuthLayout: React.FC<AuthLayoutProps> = ({ children, title, subtitle }) => {
    const { lang, setLang, dir, t } = useLanguage();

    return (
        <div className={`min-h-screen flex bg-zinc-950 text-white ${dir === 'rtl' ? 'rtl' : 'ltr'}`} dir={dir}>

            {/* Visual Side (Left in LTR, Right in RTL) */}
            <div className="hidden lg:flex w-1/2 relative overflow-hidden bg-zinc-900 border-r border-white/5 items-center justify-center p-12">
                {/* Dynamic Background */}
                <div className="absolute top-0 right-0 w-full h-full bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
                <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-violet-600/20 rounded-full blur-[120px] animate-blob"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-cyan-500/10 rounded-full blur-[100px] animate-blob animation-delay-2000"></div>

                <div className="relative z-10 max-w-lg">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white font-bold text-2xl mb-8 shadow-2xl shadow-violet-500/20">
                        R
                    </div>
                    <h1 className="text-4xl md:text-5xl font-bold mb-6 leading-tight">
                        {lang === 'en' ? 'Automate your growth.' : 'طور عملك تلقائياً.'} <br />
                        <span className="text-gradient">{lang === 'en' ? 'Keep your revenue.' : 'وحافظ على أرباحك.'}</span>
                    </h1>
                    <p className="text-xl text-zinc-400 leading-relaxed mb-8">
                        {lang === 'en'
                            ? "Join 500+ businesses using RenewalFlow to recover lost subscriptions and engage customers intelligently."
                            : "انضم لأكثر من ٥٠٠ شركة بتستخدم RenewalFlow لاسترجاع الاشتراكات المفقودة والتفاعل بذكاء مع العملاء."
                        }
                    </p>

                    <div className="p-6 rounded-2xl glass border border-white/10 backdrop-blur-md">
                        <div className="flex text-amber-400 mb-3">
                            <i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i><i className="fas fa-star"></i>
                        </div>
                        <p className="text-zinc-300 italic mb-4">
                            "This tool single-handedly saved us $4k/mo in churned revenue. The WhatsApp integration is a game changer."
                        </p>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-zinc-700"></div>
                            <div>
                                <p className="font-bold text-white text-sm">Ahmed S.</p>
                                <p className="text-zinc-500 text-xs">CTO @ TechFlow</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Form Side */}
            <div className="w-full lg:w-1/2 flex flex-col justify-center p-8 sm:p-12 lg:p-24 relative">
                <div className="absolute top-6 right-6 lg:top-8 lg:right-8 flex items-center gap-4">
                    <button
                        onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                        className="text-zinc-500 hover:text-white text-sm font-medium transition-colors"
                    >
                        {lang === 'en' ? 'العربية' : 'English'}
                    </button>
                </div>

                <div className="max-w-md w-full mx-auto">
                    <Link to="/" className="lg:hidden w-10 h-10 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white font-bold mb-8">
                        R
                    </Link>

                    <h2 className="text-3xl font-bold text-white mb-2">{title}</h2>
                    <p className="text-zinc-400 mb-8">{subtitle}</p>

                    {children}

                    <div className="mt-8 pt-8 border-t border-white/10 text-center text-sm text-zinc-500">
                        &copy; 2024 RenewalFlow.
                    </div>
                </div>
            </div>

        </div>
    );
};
