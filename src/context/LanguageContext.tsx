import React, { createContext, useContext, useState, useEffect } from 'react';

type Language = 'en' | 'ar';

interface LanguageContextType {
    lang: Language;
    setLang: (lang: Language) => void;
    t: (key: string) => string;
    dir: 'ltr' | 'rtl';
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const translations = {
    en: {
        'dashboard': 'Dashboard',
        'action_center': 'Action Center',
        'overview': 'Overview',
        'subscribers': 'Subscribers',
        'email_logs': 'Email Logs',
        'integrations': 'Integrations',
        'settings': 'Settings',
        'admin_whatsapp': 'Admin WhatsApp',
        'logout': 'Logout',
        'sync_now': 'Sync Now',
        'import_csv': 'Import CSV',
        'search_placeholder': 'Search subscribers...',
        'total_revenue': 'Total Revenue',
        'active_subscribers': 'Active Subscribers',
        'churn_risk': 'Churn Risk',
        'revenue_recovered': 'Revenue Recovered',
    },
    ar: {
        'dashboard': 'الرئيسية',
        'action_center': 'مركز المهام',
        'overview': 'نظرة عامة',
        'subscribers': 'المشتركين',
        'email_logs': 'سجل الإيميلات',
        'integrations': 'الربط والخدمات',
        'settings': 'الإعدادات',
        'admin_whatsapp': 'واتساب الإدارة',
        'logout': 'تسجيل خروج',
        'sync_now': 'مزامنة الآن',
        'import_csv': 'استيراد ملف',
        'search_placeholder': 'بحث عن مشترك...',
        'total_revenue': 'إجمالي الدخل',
        'active_subscribers': 'مشتركين نشطين',
        'churn_risk': 'خطر الإلغاء',
        'revenue_recovered': 'دخل تم إنقاذه',
    }
};

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [lang, setLang] = useState<Language>(() => {
        return (localStorage.getItem('app_lang') as Language) || 'en';
    });

    useEffect(() => {
        localStorage.setItem('app_lang', lang);
        document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = lang;
    }, [lang]);

    const t = (key: string) => {
        return (translations[lang] as any)[key] || key;
    };

    return (
        <LanguageContext.Provider value={{ lang, setLang, t, dir: lang === 'ar' ? 'rtl' : 'ltr' }}>
            {children}
        </LanguageContext.Provider>
    );
};

export const useLanguage = () => {
    const context = useContext(LanguageContext);
    if (!context) throw new Error('useLanguage must be used within a LanguageProvider');
    return context;
};
