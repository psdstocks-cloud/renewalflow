import React from 'react';

interface LandingPageProps {
  onLaunch: () => void;
}

const LandingPage: React.FC<LandingPageProps> = ({ onLaunch }) => {
  return (
    <div className="min-h-screen bg-white font-sans overflow-x-hidden">
      {/* Navbar */}
      <nav className="fixed w-full bg-white/80 backdrop-blur-md border-b border-gray-100 z-50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-200">
              <i className="fas fa-sync-alt text-lg"></i>
            </div>
            <span className="text-2xl font-bold tracking-tight text-dark">RenewalFlow</span>
          </div>
          <button 
            onClick={onLaunch}
            className="text-sm font-bold text-gray-600 hover:text-primary transition-colors"
          >
            Login to Dashboard
          </button>
        </div>
      </nav>

      {/* Hero */}
      <header className="pt-32 pb-24 px-6 text-center max-w-6xl mx-auto relative">
        {/* Background blobs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
        <div className="absolute top-0 right-1/4 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>
        
        <div className="relative z-10">
          <div className="inline-flex items-center px-4 py-1.5 mb-8 text-xs font-bold tracking-wider text-indigo-600 uppercase bg-indigo-50 rounded-full border border-indigo-100 shadow-sm animate-fade-in-up">
            <span className="w-2 h-2 bg-indigo-500 rounded-full mr-2 animate-pulse"></span>
            Smart Retention Engine
          </div>
          <h1 className="text-5xl md:text-7xl font-extrabold text-dark mb-8 tracking-tight leading-tight animate-fade-in-up">
            Stop losing revenue to <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-600 to-pink-500">Expired Subscriptions</span>
          </h1>
          <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto leading-relaxed animate-fade-in-up animation-delay-100">
            The AI-powered dashboard that tracks renewals, writes personalized point-rollover emails, and organizes your day—without the $249/yr price tag.
          </p>
          <div className="flex flex-col md:flex-row justify-center gap-4 animate-fade-in-up animation-delay-200">
            <button 
              onClick={onLaunch}
              className="px-8 py-4 bg-dark text-white text-lg font-bold rounded-2xl shadow-xl shadow-gray-300 hover:bg-black transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              Launch Dashboard <i className="fas fa-rocket"></i>
            </button>
            <button className="px-8 py-4 bg-white text-gray-700 border border-gray-200 text-lg font-bold rounded-2xl hover:bg-gray-50 transition-all">
              View Live Demo
            </button>
          </div>
          <p className="mt-6 text-sm text-gray-400 font-medium">
            <i className="fas fa-lock mr-1"></i> Local Storage • No Credit Card • Free Forever
          </p>
        </div>
      </header>

      {/* Comparison */}
      <section className="py-24 bg-gray-50 relative overflow-hidden">
        <div className="max-w-5xl mx-auto px-6 relative z-10">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-extrabold text-gray-900 mb-4">Why switch to RenewalFlow?</h2>
            <p className="text-lg text-gray-500">Compare us directly with the expensive alternatives.</p>
          </div>
          
          <div className="bg-white rounded-3xl shadow-2xl border border-gray-100 overflow-hidden transform transition-transform hover:scale-[1.01]">
            <div className="grid grid-cols-3 bg-gray-900 p-6 text-white font-bold text-lg text-center">
              <div className="text-left pl-6">Feature</div>
              <div className="text-gray-400 text-base font-medium">WooCommerce Subs</div>
              <div className="text-primary text-xl flex items-center justify-center gap-2">
                 RenewalFlow <i className="fas fa-star text-yellow-400 text-sm"></i>
              </div>
            </div>

            {/* Rows */}
            {[
              { name: 'Annual Cost', woo: '$249/year', flow: '$0 (Free)', highlight: true },
              { name: 'Point Rollover Logic', woo: 'Complex Add-ons', flow: 'Built-in AI Logic', highlight: false },
              { name: 'Email Personalization', woo: 'Generic Templates', flow: 'Gemini AI Writer', highlight: false },
              { name: 'WhatsApp Reporting', woo: '$49 Plugin', flow: 'Built-in Daily Report', highlight: false },
              { name: 'Setup Time', woo: 'Hours', flow: 'Instant', highlight: false },
            ].map((row, idx) => (
              <div key={idx} className={`grid grid-cols-3 p-6 text-center items-center border-b border-gray-100 hover:bg-gray-50 transition-colors`}>
                <div className="text-left pl-6 font-bold text-gray-700">{row.name}</div>
                <div className="text-gray-400 font-medium line-through decoration-red-300">{row.woo}</div>
                <div className={`font-bold flex items-center justify-center gap-2 ${row.highlight ? 'text-green-600 text-xl' : 'text-primary'}`}>
                  {idx === 0 && <i className="fas fa-check-circle"></i>}
                  {row.flow}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-10">
          <div className="group p-8 bg-white rounded-3xl border border-gray-100 shadow-lg hover:shadow-2xl hover:shadow-green-100 transition-all duration-300 transform hover:-translate-y-2">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-2xl flex items-center justify-center mb-6 text-3xl shadow-sm group-hover:rotate-6 transition-transform">
              <i className="fab fa-whatsapp"></i>
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900">WhatsApp Command</h3>
            <p className="text-gray-600 leading-relaxed">Start your day with a concise summary sent to your phone. Know exactly who needs a nudge and send pre-generated messages in one click.</p>
          </div>
          
          <div className="group p-8 bg-white rounded-3xl border border-gray-100 shadow-lg hover:shadow-2xl hover:shadow-purple-100 transition-all duration-300 transform hover:-translate-y-2">
             <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 text-3xl shadow-sm group-hover:rotate-6 transition-transform">
              <i className="fas fa-wand-magic-sparkles"></i>
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900">AI Email Writer</h3>
            <p className="text-gray-600 leading-relaxed">Generic emails get ignored. Our AI crafts personalized, urgent messages highlighting specific "points at risk" to drive immediate renewals.</p>
          </div>
          
          <div className="group p-8 bg-white rounded-3xl border border-gray-100 shadow-lg hover:shadow-2xl hover:shadow-blue-100 transition-all duration-300 transform hover:-translate-y-2">
             <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 text-3xl shadow-sm group-hover:rotate-6 transition-transform">
              <i className="fas fa-file-import"></i>
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900">Smart Import</h3>
            <p className="text-gray-600 leading-relaxed">Flexible for "Pay as you go" models. Paste messy data from anywhere, and our system structures it into a clean, actionable dashboard.</p>
          </div>
        </div>
      </section>
      
      <footer className="bg-gray-50 py-12 border-t border-gray-100 text-center">
         <p className="text-gray-400 font-medium">Built with <i className="fas fa-heart text-red-400 mx-1"></i> and Gemini AI</p>
      </footer>
    </div>
  );
};

export default LandingPage;