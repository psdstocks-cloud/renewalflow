import React, { useState } from 'react';
import { useLanguage } from '@/src/context/LanguageContext';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/src/components/ui/Button';

interface SidebarItem {
    id: string;
    label: string;
    icon: string;
}

interface DashboardLayoutProps {
    children: React.ReactNode;
    activeTab: string;
    onTabChange: (tab: string) => void;
    onLogout: () => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
    children,
    activeTab,
    onTabChange,
    onLogout
}) => {
    const { t, lang, setLang, dir } = useLanguage();
    const [sidebarOpen, setSidebarOpen] = useState(true);

    const menuItems: SidebarItem[] = [
        { id: 'action', label: 'action_center', icon: 'fa-bolt' },
        { id: 'overview', label: 'overview', icon: 'fa-chart-pie' },
        { id: 'subscribers', label: 'subscribers', icon: 'fa-users' },
        { id: 'revenue', label: 'revenue', icon: 'fa-dollar-sign' },
        { id: 'logs', label: 'email_logs', icon: 'fa-history' },
        { id: 'settings', label: 'settings', icon: 'fa-cog' },
    ];

    return (
        <div className={`min-h-screen bg-zinc-950 text-white flex transition-all duration-300 ${dir === 'rtl' ? 'rtl' : 'ltr'}`}>

            {/* Sidebar */}
            <aside
                className={`
          fixed top-0 bottom-0 z-40 w-64 glass border-r border-white/5 transition-transform duration-300
          ${dir === 'rtl' ? 'right-0 border-l border-r-0' : 'left-0'}
          ${sidebarOpen ? 'translate-x-0' : (dir === 'rtl' ? 'translate-x-full' : '-translate-x-full')}
          lg:translate-x-0 lg:static
        `}
            >
                <div className="h-20 flex items-center px-6 border-b border-white/5">
                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white font-bold mr-3 rtl:mr-0 rtl:ml-3">
                        R
                    </div>
                    <span className="text-xl font-bold tracking-tight">RenewalFlow</span>
                </div>

                <div className="p-4 space-y-2">
                    {menuItems.map((item) => (
                        <button
                            key={item.id}
                            onClick={() => onTabChange(item.id)}
                            className={`
                w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200
                ${activeTab === item.id
                                    ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20 shadow-lg shadow-violet-500/5'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'}
              `}
                        >
                            <i className={`fas ${item.icon} w-6 text-center`}></i>
                            <span className="font-medium">{t(item.label)}</span>
                        </button>
                    ))}
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/5 bg-zinc-900/50">
                    <button
                        onClick={onLogout}
                        className="w-full flex items-center gap-3 px-4 py-2 text-zinc-500 hover:text-red-400 transition-colors"
                    >
                        <i className="fas fa-sign-out-alt w-6"></i>
                        <span>{t('logout')}</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 min-w-0 bg-zinc-950 relative">
                {/* Top Grid Pattern */}
                <div className="absolute top-0 left-0 w-full h-96 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none"></div>
                <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-violet-600/10 rounded-full blur-[100px] pointer-events-none"></div>

                <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 relative z-20">
                    <h1 className="text-2xl font-bold text-white capitalize">{t(menuItems.find(i => i.id === activeTab)?.label || 'dashboard')}</h1>

                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
                            className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-sm text-zinc-400 hover:text-white"
                        >
                            {lang === 'en' ? 'العربية' : 'English'}
                        </button>
                        <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-zinc-700 to-zinc-600 border border-white/10"></div>
                    </div>
                </header>

                <div className="p-8 relative z-10 animate-fade-in-up">
                    {children}
                </div>
            </main>

        </div>
    );
};
