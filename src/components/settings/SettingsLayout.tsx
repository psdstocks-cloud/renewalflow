import React from 'react';
import { useLanguage } from '@/src/context/LanguageContext';

export type SettingsTab = 'profile' | 'workspace' | 'automation' | 'integrations';

interface SettingsLayoutProps {
    children: React.ReactNode;
    activeTab: SettingsTab;
    onTabChange: (tab: SettingsTab) => void;
}

export const SettingsLayout: React.FC<SettingsLayoutProps> = ({ children, activeTab, onTabChange }) => {
    const { lang, t } = useLanguage();

    const tabs: { id: SettingsTab; label: string; icon: string }[] = [
        { id: 'profile', label: lang === 'en' ? 'Profile' : 'الملف الشخصي', icon: 'fa-user-circle' },
        { id: 'workspace', label: lang === 'en' ? 'Workspace' : 'مساحة العمل', icon: 'fa-building' },
        { id: 'automation', label: lang === 'en' ? 'Automation' : 'الآتمتة والذكاء', icon: 'fa-robot' },
        { id: 'integrations', label: lang === 'en' ? 'Integrations' : 'الربط والتكامل', icon: 'fa-plug' },
    ];

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Secondary Sidebar */}
            <div className="w-full lg:w-64 flex-shrink-0">
                <div className="sticky top-0 space-y-1">
                    <h3 className="text-zinc-500 text-xs font-bold uppercase mb-4 px-3">
                        {lang === 'en' ? 'Settings' : 'الإعدادات'}
                    </h3>
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`
                   w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                   ${activeTab === tab.id
                                    ? 'bg-white/10 text-white'
                                    : 'text-zinc-400 hover:text-white hover:bg-white/5'}
                `}
                        >
                            <i className={`fas ${tab.icon} w-5 text-center`}></i>
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
                <div className="animate-fade-in-up">
                    {children}
                </div>
            </div>
        </div>
    );
};
