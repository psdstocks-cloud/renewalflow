import React, { useState, useEffect } from 'react';
import LandingPage from './components/LandingPage';
import Dashboard from './components/Dashboard';

const App: React.FC = () => {
  const [view, setView] = useState<'landing' | 'login' | 'dashboard'>('landing');
  const [pin, setPin] = useState('');
  const [storedPin, setStoredPin] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const savedPin = localStorage.getItem('renewalFlow_pin');
    setStoredPin(savedPin);
  }, []);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!storedPin) {
      // First time setup
      if (pin.length < 4) {
        setError('PIN must be at least 4 digits');
        return;
      }
      localStorage.setItem('renewalFlow_pin', pin);
      setStoredPin(pin);
      setView('dashboard');
    } else {
      // Validate
      if (pin === storedPin) {
        setView('dashboard');
      } else {
        setError('Incorrect PIN');
        setPin('');
      }
    }
  };

  const LoginScreen = () => (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center relative overflow-hidden">
       {/* Background blobs */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-indigo-200 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-blob animation-delay-2000"></div>

      <div className="bg-white p-10 rounded-3xl shadow-2xl shadow-indigo-100 max-w-md w-full relative z-10 animate-fade-in-up">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-primary to-purple-600 rounded-2xl flex items-center justify-center text-white shadow-lg mx-auto mb-4">
            <i className="fas fa-lock text-2xl"></i>
          </div>
          <h2 className="text-2xl font-extrabold text-gray-900">{storedPin ? 'Welcome Back' : 'Set Access PIN'}</h2>
          <p className="text-gray-500 text-sm mt-2">
            {storedPin 
              ? 'Enter your security PIN to access the dashboard.' 
              : 'Create a secure PIN to protect your subscriber data on this device.'}
          </p>
        </div>

        <form onSubmit={handleLogin}>
          <div className="mb-6">
            <input
              type="password"
              inputMode="numeric"
              className="w-full text-center text-3xl font-bold tracking-[1em] p-4 border-2 border-gray-100 rounded-xl focus:border-primary focus:ring-0 text-gray-800 transition-all"
              placeholder="••••"
              value={pin}
              onChange={(e) => { setError(''); setPin(e.target.value); }}
              autoFocus
            />
            {error && <p className="text-red-500 text-center text-sm mt-3 font-bold animate-pulse">{error}</p>}
          </div>
          <button
            type="submit"
            className="w-full py-4 bg-dark text-white font-bold rounded-xl shadow-xl shadow-gray-300 hover:bg-black transition-all transform hover:-translate-y-1 flex items-center justify-center gap-2"
          >
             {storedPin ? 'Unlock Dashboard' : 'Set PIN & Enter'} <i className="fas fa-arrow-right"></i>
          </button>
        </form>
        <button 
          onClick={() => setView('landing')} 
          className="w-full text-center text-gray-400 text-sm mt-6 hover:text-gray-600 font-medium"
        >
          Back to Home
        </button>
      </div>
    </div>
  );

  return (
    <>
      {view === 'landing' && <LandingPage onLaunch={() => setView(storedPin ? 'login' : 'dashboard')} />}
      {view === 'login' && <LoginScreen />}
      {view === 'dashboard' && <Dashboard onLogout={() => setView('landing')} />}
    </>
  );
};

export default App;