import React, { useState } from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';

type Language = 'en' | 'ar';

const content = {
  en: {
    hero: {
      headline: "Stop Losing Revenue to Expired Subscriptions.",
      subheadline: "RenewalFlow's intelligent automation and predictive analytics proactively engage customers, reducing churn by up to 40%.",
      ctaPrimary: "Start Your Free Trial",
      ctaSecondary: "View Live Demo",
      trustedBy: "Trusted by 500+ modern teams"
    },
    problem: {
      heading: "The Old Way is Costing You.",
      points: [
        { title: "Manual Spreadsheets", desc: "Missed reminders and messy data." },
        { title: "Generic Emails", desc: "Templates that customers ignore." },
        { title: "Revenue Leakage", desc: "Silent churn draining your potential." }
      ]
    },
    solution: {
      heading: "The RenewalFlow Advantage",
      features: [
        { title: "Smart Auto-Reminders", desc: "Sends personalized WhatsApp & Email nudges at the perfect time." },
        { title: "Point Rollover Logic", desc: "Incentivize renewals by saving their hard-earned points." },
        { title: "Daily 'Morning Brief'", desc: "Get a WhatsApp summary of who needs attention today." }
      ]
    },
    pricing: {
      heading: "Simple, Transparent Pricing",
      starter: { name: "Starter", price: "Free", desc: "For solo founders." },
      pro: { name: "Pro", price: "$29/mo", desc: "For growing teams." }
    },
    footer: "© 2024 RenewalFlow. Built for growth."
  },
  ar: {
    hero: {
      headline: "ماتسيبش فلوسك تروح عليك بسبب اشتراكات منتهية.",
      subheadline: "رينيوال فلو (RenewalFlow) بيساعدك تتابع تجديد الاشتراكات أوتوماتيك، وبيفكر العملاء بدري عشان يحافظ على دخلك ويزود أرباحك.",
      ctaPrimary: "ابدأ فترتك المجانية",
      ctaSecondary: "شوف الديمو بنفسك",
      trustedBy: "أكتر من ٥٠٠ شركة بيعتمدوا علينا"
    },
    problem: {
      heading: "الطريقة القديمة بتخسرك كتير.",
      points: [
        { title: "شيتات إكسيل", desc: "بتوه فيها ومواعيد بتفوتك." },
        { title: "إيميلات تقليدية", desc: "محدش بيفتحها أصلًا." },
        { title: "فلوس بتضيع", desc: "منك كل يوم وأنت مش حاسس." }
      ]
    },
    solution: {
      heading: "ليه RenewalFlow هو الحل؟",
      features: [
        { title: "تنبيهات ذكية في وقتها", desc: "رسالة واتساب أو إيميل بيوصل للعميل في الوقت الصح، وبشكل شخصي جدًا." },
        { title: "نظام ترحيل النقاط", desc: "شجعهم يجددوا عشان ميروحش عليهم النقط اللي جمعوها تعبهم." },
        { title: "تقرير الصباح اليومي", desc: "أول ما تصحى، هيجيلك ملخص عالواتساب يقولك مين محتاج متابعة النهاردة." }
      ]
    },
    pricing: {
      heading: "أسعار واضحة، من غير مفاجآت",
      starter: { name: "البداية", price: "مجانًا", desc: "لو لسه بتبدأ لوحدك." },
      pro: { name: "المحترفين", price: "٢٩$ / شهر", desc: "للشركات اللي بتكبر بسرعة." }
    },
    footer: "جميع الحقوق محفوظة لـ RenewalFlow © ٢٠٢٤."
  }
};

const LandingPage: React.FC = () => {
  const [lang, setLang] = useState<Language>('en');
  const t = content[lang];
  const isRtl = lang === 'ar';

  return (
    <div className={`min-h-screen font-sans ${isRtl ? 'rtl' : 'ltr'}`} dir={isRtl ? 'rtl' : 'ltr'}>

      {/* Navbar */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo Icon */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white font-bold">
              R
            </div>
            <span className="text-xl font-bold text-white tracking-tight">RenewalFlow</span>
          </div>

          <div className="flex items-center gap-4">
            {/* Language Switcher */}
            <button
              onClick={() => setLang(lang === 'en' ? 'ar' : 'en')}
              className="text-zinc-400 hover:text-white text-sm font-medium transition-colors"
            >
              {lang === 'en' ? 'العربية' : 'English'}
            </button>

            <div className="h-6 w-px bg-white/10 mx-2"></div>

            <Button variant="ghost" to="/auth/sign-in" size="sm">
              {lang === 'en' ? 'Log in' : 'تسجيل دخول'}
            </Button>
            <Button variant="primary" to="/auth/sign-up" size="sm">
              {isRtl ? 'ابدأ الآن' : 'Get Started'}
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="relative pt-40 pb-32 px-6 overflow-hidden">
        {/* Background Blobs */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-violet-600/20 rounded-full mix-blend-screen filter blur-[100px] animate-blob z-0 pointer-events-none"></div>
        <div className="absolute top-20 right-0 w-[800px] h-[600px] bg-cyan-500/10 rounded-full mix-blend-screen filter blur-[80px] animate-blob animation-delay-2000 z-0 pointer-events-none"></div>

        <div className="max-w-4xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center px-3 py-1 mb-8 rounded-full bg-white/5 border border-white/10 backdrop-blur-sm">
            <span className="flex h-2 w-2 rounded-full bg-cyan-400 mr-2 animate-pulse"></span>
            <span className="text-xs font-medium text-cyan-300 tracking-wide uppercase">
              {lang === 'en' ? 'New: AI Email Writer' : 'جديد: كاتب الإيميلات بالذكاء الاصطناعي'}
            </span>
          </div>

          <h1 className="text-5xl md:text-7xl font-bold text-white mb-8 leading-tight tracking-tight">
            {lang === 'en'
              ? <>Stop losing revenue to <br className="hidden md:block" /> <span className="text-gradient">Expired Subscriptions</span></>
              : <>ماتسيبش فلوسك تروح عليك <br className="hidden md:block" /> <span className="text-gradient">بسبب اشتراكات منتهية</span></>
            }
          </h1>

          <p className="text-xl text-zinc-400 mb-10 max-w-2xl mx-auto leading-relaxed">
            {t.hero.subheadline}
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button variant="primary" size="lg" to="/auth/sign-up">
              {t.hero.ctaPrimary}
            </Button>
            <Button variant="secondary" size="lg" to="#">
              {t.hero.ctaSecondary}
            </Button>
          </div>

          <p className="mt-8 text-sm text-zinc-500 font-medium">
            {t.hero.trustedBy}
          </p>
        </div>

        {/* Abstract Dashboard Preview */}
        <div className="mt-20 max-w-5xl mx-auto relative z-10 animate-fade-in-up">
          <div className="glass-card rounded-2xl p-2 border-white/10 shadow-2xl shadow-violet-500/20">
            <div className="bg-zinc-950 rounded-xl overflow-hidden aspect-video relative flex items-center justify-center border border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-zinc-900 to-zinc-950"></div>
              {/* Mock UI Elements */}
              <div className="relative z-10 text-center">
                <div className="w-20 h-20 mx-auto rounded-full bg-gradient-to-tr from-violet-500 to-cyan-400 opacity-20 blur-xl animate-pulse"></div>
                <p className="text-zinc-600 font-mono text-sm mt-4">Dashboard Preview Unavailable</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Problem Section */}
      <section className="py-24 bg-zinc-900/50 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">{t.problem.heading}</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {t.problem.points.map((point, idx) => (
              <Card key={idx} className="hover:border-white/20 transition-colors">
                <div className="w-12 h-12 rounded-lg bg-red-500/10 flex items-center justify-center text-red-400 mb-6 text-xl">
                  <i className="fas fa-times"></i>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{point.title}</h3>
                <p className="text-zinc-400">{point.desc}</p>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Solution Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-violet-600/10 rounded-full mix-blend-screen filter blur-[100px] z-0"></div>

        <div className="max-w-6xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <span className="text-cyan-400 font-bold tracking-wider text-sm uppercase mb-2 block">{lang === 'en' ? 'Features' : 'المميزات'}</span>
            <h2 className="text-3xl md:text-5xl font-bold text-white mb-6">{t.solution.heading}</h2>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {t.solution.features.map((feature, idx) => (
              <div key={idx} className="group p-8 rounded-3xl bg-zinc-900/40 border border-white/5 hover:bg-white/5 transition-all duration-300">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-6 text-2xl
                       ${idx === 0 ? 'bg-green-500/10 text-green-400' : ''}
                       ${idx === 1 ? 'bg-violet-500/10 text-violet-400' : ''}
                       ${idx === 2 ? 'bg-cyan-500/10 text-cyan-400' : ''}
                    `}>
                  <i className={`fas ${idx === 0 ? 'fa-bell' : idx === 1 ? 'fa-sync' : 'fa-coffee'}`}></i>
                </div>
                <h3 className="text-2xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-zinc-400 leading-relaxed">{feature.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-white/5 text-center text-zinc-600 text-sm">
        <p>{t.footer}</p>
      </footer>
    </div>
  );
};

export default LandingPage;

