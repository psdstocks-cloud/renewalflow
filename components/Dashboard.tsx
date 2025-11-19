import React, { useState, useEffect, useRef } from 'react';
import { Subscriber, SubscriptionStatus, NotificationTask, EmailLog, WooSettings, EmailSettings } from '../types';
import { generateEmailContent, generateWhatsAppReport, parseCSVData } from '../services/geminiService';
import { sendEmail } from '../services/emailService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DashboardProps {
  onLogout: () => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout }) => {
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'subscribers' | 'action' | 'settings' | 'integrations' | 'logs'>('action');
  const [loading, setLoading] = useState(false);
  const [importText, setImportText] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [editingSub, setEditingSub] = useState<Subscriber | null>(null);

  // Settings
  const [firstReminderDays, setFirstReminderDays] = useState<number>(3);
  const [finalReminderDays, setFinalReminderDays] = useState<number>(1);
  const [customEmailContext, setCustomEmailContext] = useState<string>('');
  const [previewContent, setPreviewContent] = useState<string>('');
  const [previewType, setPreviewType] = useState<'FIRST' | 'FINAL' | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Integration Settings
  const [wooSettings, setWooSettings] = useState<WooSettings>({ url: '', consumerKey: '', consumerSecret: '', pointsPerDollar: 10 });
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({ serviceId: '', templateId: '', publicKey: '', isEnabled: false });
  const [syncLog, setSyncLog] = useState<string>('');

  // Logs
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);

  // Action Center State
  const [tasks, setTasks] = useState<NotificationTask[]>([]);
  const [adminPhone, setAdminPhone] = useState(localStorage.getItem('adminPhone') || '');

  // Form State for Add/Edit
  const initialFormState = {
    name: '', email: '', phone: '', planName: '', amount: 0, 
    startDate: new Date().toISOString().split('T')[0], 
    endDate: new Date(Date.now() + 86400000 * 30).toISOString().split('T')[0], 
    pointsRemaining: 0, paymentLink: '', status: SubscriptionStatus.ACTIVE
  };
  const [subForm, setSubForm] = useState(initialFormState);

  // Refs for Editor
  const editorRef = useRef<HTMLTextAreaElement>(null);

  // Stats
  const stats = {
    revenue: subscribers.reduce((acc, sub) => acc + (sub.status === SubscriptionStatus.ACTIVE ? sub.amount : 0), 0),
    active: subscribers.filter(s => s.status === SubscriptionStatus.ACTIVE).length,
    expiring: subscribers.filter(s => {
      if (s.status !== SubscriptionStatus.ACTIVE) return false;
      const days = Math.ceil((new Date(s.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return days > 0 && days <= firstReminderDays;
    }).length
  };

  useEffect(() => {
    const saved = localStorage.getItem('renewalFlow_subs');
    const savedSettings = localStorage.getItem('renewalFlow_settings');
    const savedLogs = localStorage.getItem('renewalFlow_logs');
    const savedWoo = localStorage.getItem('renewalFlow_woo');
    const savedEmail = localStorage.getItem('renewalFlow_email');
    
    if (saved) {
      setSubscribers(JSON.parse(saved));
    } else {
      // Demo Data
      setSubscribers([
        { id: '1', name: 'John Doe', email: 'john@example.com', phone: '1234567890', planName: 'Gold Tier', amount: 50, startDate: '2023-10-01', endDate: new Date(Date.now() + 86400000 * 3).toISOString(), pointsRemaining: 1200, status: SubscriptionStatus.ACTIVE, paymentLink: 'https://paypal.me/pay' },
        { id: '2', name: 'Jane Smith', email: 'jane@example.com', phone: '0987654321', planName: 'PayAsYouGo', amount: 15, startDate: '2023-10-05', endDate: new Date(Date.now() + 86400000).toISOString(), pointsRemaining: 45, status: SubscriptionStatus.ACTIVE },
      ]);
    }

    if (savedSettings) {
      const settings = JSON.parse(savedSettings);
      setFirstReminderDays(settings.first || 3);
      setFinalReminderDays(settings.final || 1);
      setCustomEmailContext(settings.template || '');
    }

    if (savedLogs) {
      setEmailLogs(JSON.parse(savedLogs));
    }

    if (savedWoo) {
      setWooSettings(JSON.parse(savedWoo));
    }

    if (savedEmail) {
      setEmailSettings(JSON.parse(savedEmail));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('renewalFlow_subs', JSON.stringify(subscribers));
    localStorage.setItem('renewalFlow_settings', JSON.stringify({ 
      first: firstReminderDays, 
      final: finalReminderDays, 
      template: customEmailContext 
    }));
    localStorage.setItem('renewalFlow_logs', JSON.stringify(emailLogs));
    localStorage.setItem('renewalFlow_woo', JSON.stringify(wooSettings));
    localStorage.setItem('renewalFlow_email', JSON.stringify(emailSettings));
    calculateTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subscribers, firstReminderDays, finalReminderDays, customEmailContext, emailLogs, wooSettings, emailSettings]);

  const calculateTasks = () => {
    const today = new Date();
    const newTasks: NotificationTask[] = [];

    subscribers.forEach(sub => {
      if (sub.status !== SubscriptionStatus.ACTIVE) return;
      
      const endDate = new Date(sub.endDate);
      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === firstReminderDays || diffDays === finalReminderDays) {
        // Check if we already notified today
        const lastNotified = sub.lastNotified ? new Date(sub.lastNotified).toDateString() : null;
        if (lastNotified !== today.toDateString()) {
           newTasks.push({
             subscriber: sub,
             type: diffDays === firstReminderDays ? 'FIRST_REMINDER' : 'FINAL_REMINDER',
             daysUntilExpiry: diffDays
           });
        }
      }
    });
    setTasks(newTasks);
  };

  const handleWooSync = async () => {
    if (!wooSettings.url || !wooSettings.consumerKey || !wooSettings.consumerSecret) {
      alert("Please configure WooCommerce settings first.");
      setActiveTab('integrations');
      return;
    }

    setLoading(true);
    setSyncLog('Connecting to WooCommerce...');
    
    try {
      const auth = btoa(`${wooSettings.consumerKey}:${wooSettings.consumerSecret}`);
      const response = await fetch(`${wooSettings.url}/wp-json/wc/v3/orders?status=processing,completed&per_page=20`, {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      if (!response.ok) throw new Error('Failed to fetch orders. Check CORS or Credentials.');
      
      const orders = await response.json();
      let updatedCount = 0;
      let newCount = 0;

      const newSubscribers = [...subscribers];

      orders.forEach((order: any) => {
         const email = order.billing.email;
         const total = parseFloat(order.total);
         const orderDate = new Date(order.date_created);
         const newPoints = Math.floor(total * wooSettings.pointsPerDollar);

         const existingIndex = newSubscribers.findIndex(s => s.email.toLowerCase() === email.toLowerCase());

         if (existingIndex >= 0) {
           const currentSub = newSubscribers[existingIndex];
           const currentEnd = new Date(currentSub.endDate);
           let newEndDate = new Date(orderDate);
           if (currentEnd > orderDate) {
             newEndDate = new Date(currentEnd);
           }
           newEndDate.setDate(newEndDate.getDate() + 30);
           const rolledPoints = currentSub.pointsRemaining + newPoints;

           newSubscribers[existingIndex] = {
             ...currentSub,
             endDate: newEndDate.toISOString(),
             pointsRemaining: rolledPoints,
             status: SubscriptionStatus.ACTIVE,
             lastNotified: undefined
           };
           updatedCount++;
         } else {
           const endDate = new Date(orderDate);
           endDate.setDate(endDate.getDate() + 30);
           
           newSubscribers.push({
             id: order.id.toString(),
             name: `${order.billing.first_name} ${order.billing.last_name}`,
             email: email,
             phone: order.billing.phone || '',
             planName: order.line_items[0]?.name || 'Standard Plan',
             amount: total,
             startDate: orderDate.toISOString(),
             endDate: endDate.toISOString(),
             pointsRemaining: newPoints,
             status: SubscriptionStatus.ACTIVE,
             paymentLink: ''
           });
           newCount++;
         }
      });

      setSubscribers(newSubscribers);
      setSyncLog(`Success! Updated ${updatedCount} existing and added ${newCount} new subscribers.`);
      setTimeout(() => setSyncLog(''), 5000);

    } catch (err: any) {
      console.error(err);
      setSyncLog(`Error: ${err.message}. Ensure your WP site allows CORS or use a proxy.`);
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    setLoading(true);
    const parsed = await parseCSVData(importText);
    if (parsed && Array.isArray(parsed)) {
      const newSubs = parsed.map((p: any) => ({
        ...p,
        id: Math.random().toString(36).substr(2, 9),
        status: SubscriptionStatus.ACTIVE 
      }));
      setSubscribers([...subscribers, ...newSubs]);
      setShowImportModal(false);
      setImportText('');
    } else {
      alert("Failed to parse data. Ensure it looks somewhat like CSV or JSON.");
    }
    setLoading(false);
  };

  const handleSaveSubscriber = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingSub) {
      setSubscribers(subscribers.map(s => s.id === editingSub.id ? { ...s, ...subForm, id: editingSub.id } : s));
    } else {
      setSubscribers([...subscribers, { ...subForm, id: Math.random().toString(36).substr(2, 9) }]);
    }
    setShowSubModal(false);
    setEditingSub(null);
    setSubForm(initialFormState);
  };

  const openAddModal = () => {
    setEditingSub(null);
    setSubForm(initialFormState);
    setShowSubModal(true);
  };

  const openEditModal = (sub: Subscriber) => {
    setEditingSub(sub);
    setSubForm({
      name: sub.name,
      email: sub.email,
      phone: sub.phone,
      planName: sub.planName,
      amount: sub.amount,
      startDate: sub.startDate.split('T')[0],
      endDate: sub.endDate.split('T')[0],
      pointsRemaining: sub.pointsRemaining,
      paymentLink: sub.paymentLink || '',
      status: sub.status
    });
    setShowSubModal(true);
  };

  const handleGenerateEmail = async (index: number) => {
    setLoading(true);
    const task = tasks[index];
    const content = await generateEmailContent(task, customEmailContext);
    const updatedTasks = [...tasks];
    updatedTasks[index].generatedContent = content;
    setTasks(updatedTasks);
    setLoading(false);
  };

  const handleSendEmail = async (task: NotificationTask) => {
     if (!task.generatedContent) return;
     
     // Send via Service
     const result = await sendEmail(task, task.generatedContent, emailSettings);

     const newLog: EmailLog = {
       id: Math.random().toString(36).substr(2, 9),
       subscriberName: task.subscriber.name,
       subscriberEmail: task.subscriber.email,
       type: task.type,
       sentAt: new Date().toISOString(),
       status: result.success ? 'Sent' : 'Failed',
       contentSnippet: task.generatedContent.substring(0, 50) + '...'
     };
     setEmailLogs([newLog, ...emailLogs]);

     if (result.success) {
       const updatedSubs = subscribers.map(s => s.id === task.subscriber.id ? {...s, lastNotified: new Date().toISOString()} : s);
       setSubscribers(updatedSubs);
       
       // Remove from Action Center locally
       setTasks(tasks.filter(t => t.subscriber.id !== task.subscriber.id));
       
       if (result.method === 'API') {
         alert(`Email sent successfully via EmailJS to ${task.subscriber.email}`);
       }
     } else {
       alert(`Failed to send email: ${result.error}`);
     }
  };

  const handleSendReport = async () => {
    setLoading(true);
    const report = await generateWhatsAppReport(tasks);
    const url = `https://wa.me/${adminPhone}?text=${encodeURIComponent(report)}`;
    window.open(url, '_blank');
    setLoading(false);
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(subscribers, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = "renewalflow_backup.json";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDeleteSub = (id: string) => {
    if(window.confirm('Are you sure you want to delete this subscriber?')) {
      setSubscribers(subscribers.filter(s => s.id !== id));
    }
  };

  const handlePreviewEmail = async (type: 'FIRST' | 'FINAL') => {
    setPreviewLoading(true);
    setPreviewType(type);
    
    const mockSub: Subscriber = {
      id: 'preview',
      name: 'Alex Customer',
      email: 'alex@example.com',
      phone: '0000000000',
      planName: 'Platinum Membership',
      amount: 99,
      startDate: new Date().toISOString(),
      endDate: new Date().toISOString(),
      pointsRemaining: 1500,
      paymentLink: 'https://your-site.com/checkout/123',
      status: SubscriptionStatus.ACTIVE
    };

    const days = type === 'FIRST' ? firstReminderDays : finalReminderDays;
    
    const mockTask: NotificationTask = {
      subscriber: mockSub,
      type: type === 'FIRST' ? 'FIRST_REMINDER' : 'FINAL_REMINDER',
      daysUntilExpiry: days
    };

    const content = await generateEmailContent(mockTask, customEmailContext);
    setPreviewContent(content);
    setPreviewLoading(false);
  };

  // Rich Text Editor Helpers
  const insertAtCursor = (text: string) => {
    const textarea = editorRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentVal = customEmailContext;
    
    const newVal = currentVal.substring(0, start) + text + currentVal.substring(end);
    setCustomEmailContext(newVal);
    
    // Defer focus to ensure state updates
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const formatText = (type: 'bold' | 'italic' | 'link') => {
    if(type === 'bold') insertAtCursor('**text**');
    if(type === 'italic') insertAtCursor('*text*');
    if(type === 'link') insertAtCursor('[text](url)');
  };

  const NavItem = ({ id, label, icon, badge }: { id: typeof activeTab, label: string, icon: string, badge?: number }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 mb-1
        ${activeTab === id 
          ? 'bg-gradient-to-r from-primary to-indigo-600 text-white shadow-lg shadow-indigo-500/30' 
          : 'text-gray-400 hover:bg-surface hover:text-white'}`}
    >
      <i className={`fas ${icon} w-6 text-center text-lg`}></i> 
      <span className="font-medium">{label}</span>
      {badge ? <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto animate-pulse">{badge}</span> : null}
    </button>
  );

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans overflow-hidden">
      {/* Sidebar */}
      <aside className="w-72 bg-dark flex flex-col fixed h-full z-20 shadow-2xl">
        <div className="p-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-purple-600 rounded-xl flex items-center justify-center text-white shadow-lg">
              <i className="fas fa-sync-alt text-xl animate-spin-slow"></i>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-tight">RenewalFlow</h2>
          </div>
          <p className="text-gray-500 text-xs ml-1">Subscription Intelligence</p>
        </div>
        
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          <NavItem id="action" label="Action Center" icon="fa-bolt" badge={tasks.length > 0 ? tasks.length : undefined} />
          <NavItem id="overview" label="Overview" icon="fa-chart-pie" />
          <NavItem id="subscribers" label="Subscribers" icon="fa-users" />
          <NavItem id="logs" label="Email Logs" icon="fa-history" />
          <NavItem id="integrations" label="Integrations" icon="fa-plug" />
          <NavItem id="settings" label="Settings" icon="fa-cog" />
        </nav>

        <div className="p-6 bg-black/20 backdrop-blur-sm border-t border-gray-800">
           <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Admin WhatsApp</label>
           <input 
             type="text" 
             placeholder="+1234567890" 
             className="w-full bg-surface text-sm p-3 rounded-lg border border-gray-700 mb-4 text-white placeholder-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
             value={adminPhone}
             onChange={(e) => {
               setAdminPhone(e.target.value);
               localStorage.setItem('adminPhone', e.target.value);
             }}
           />
           <button onClick={onLogout} className="w-full text-sm text-gray-400 hover:text-white flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-gray-800 transition-colors">
             <i className="fas fa-sign-out-alt"></i> Logout
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-8 overflow-y-auto ml-72 bg-gradient-to-br from-gray-50 via-gray-50 to-indigo-50/30 min-h-screen">
        
        {/* Header Sync Button */}
        {activeTab !== 'action' && activeTab !== 'integrations' && (
          <div className="fixed top-6 right-8 z-30">
             <button 
               onClick={handleWooSync} 
               disabled={loading}
               className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl shadow-md hover:bg-gray-50 text-sm font-bold flex items-center gap-2"
             >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync-alt text-primary"></i>}
                Sync WooCommerce
             </button>
          </div>
        )}

        {/* ACTION CENTER TAB */}
        {activeTab === 'action' && (
          <div className="max-w-5xl mx-auto animate-fade-in-up">
            <div className="flex justify-between items-end mb-10">
              <div>
                 <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">Good Morning</h1>
                 <p className="text-lg text-gray-500">You have <span className="font-bold text-primary">{tasks.length}</span> tasks requiring attention today.</p>
              </div>
              <button 
                onClick={handleSendReport}
                disabled={loading}
                className="bg-[#25D366] text-white px-6 py-3 rounded-xl hover:bg-[#128C7E] flex items-center gap-2 shadow-lg shadow-green-200 transition-all transform hover:-translate-y-1 font-bold"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fab fa-whatsapp text-xl"></i>}
                Send Daily Report
              </button>
            </div>

            {tasks.length === 0 ? (
              <div className="bg-white p-16 rounded-2xl shadow-xl text-center border border-gray-100 flex flex-col items-center justify-center animate-pulse-slow">
                <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 text-4xl shadow-sm">
                  <i className="fas fa-check"></i>
                </div>
                <h3 className="text-2xl font-bold text-gray-800 mb-2">All Caught Up!</h3>
                <p className="text-gray-500 max-w-md mx-auto">No subscriptions are expiring in exactly {firstReminderDays} days or {finalReminderDays} day. Enjoy your day!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {tasks.map((task, idx) => (
                  <div key={idx} className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
                    <div className="p-6 border-b border-gray-50 flex justify-between items-start bg-gradient-to-r from-white to-gray-50">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-xl font-bold text-gray-900">{task.subscriber.name}</h3>
                          <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide shadow-sm ${task.type === 'FIRST_REMINDER' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-red-100 text-red-700 border border-red-200'}`}>
                            {task.daysUntilExpiry} {task.daysUntilExpiry === 1 ? 'Day' : 'Days'} Left
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 flex items-center gap-4">
                          <span className="bg-gray-100 px-2 py-1 rounded text-gray-600"><i className="fas fa-box mr-1"></i> {task.subscriber.planName} (${task.subscriber.amount})</span>
                          <span className="text-indigo-600 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded border border-indigo-100"><i className="fas fa-coins"></i> {task.subscriber.pointsRemaining} Points at risk</span>
                        </div>
                        {task.subscriber.paymentLink && (
                           <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                              <i className="fas fa-link"></i> Payment Link Ready
                           </div>
                        )}
                      </div>
                      <div className="flex gap-3">
                        {!task.generatedContent ? (
                           <button 
                             onClick={() => handleGenerateEmail(idx)}
                             disabled={loading}
                             className="bg-primary text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 flex items-center gap-2 shadow-lg shadow-indigo-200 transition-all active:scale-95"
                           >
                             {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-wand-magic-sparkles"></i>}
                             Generate Email
                           </button>
                        ) : (
                           <button 
                             onClick={() => handleSendEmail(task)}
                             className="bg-dark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black flex items-center gap-2 shadow-lg shadow-gray-300 transition-all active:scale-95"
                           >
                             <i className="fas fa-paper-plane"></i>
                             Send & Log
                           </button>
                        )}
                      </div>
                    </div>
                    {task.generatedContent && (
                      <div className="p-6 bg-white relative group">
                        <label className="block text-xs font-bold text-gray-400 uppercase mb-3 tracking-wider">AI Draft</label>
                        <textarea 
                          readOnly 
                          className="w-full h-40 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm text-gray-700 focus:outline-none resize-none font-medium leading-relaxed"
                          value={task.generatedContent}
                        />
                        <div className="absolute bottom-4 right-8 text-xs text-gray-400 italic opacity-0 group-hover:opacity-100 transition-opacity">
                            Ready to send via {emailSettings.isEnabled ? 'EmailJS' : 'Mail App'}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div className="max-w-6xl mx-auto animate-fade-in-up">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-8 tracking-tight">Performance Overview</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
              <div className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <i className="fas fa-dollar-sign text-8xl text-primary"></i>
                </div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Est. Monthly Revenue</p>
                <p className="text-4xl font-extrabold text-gray-900">${stats.revenue.toLocaleString()}</p>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                    <i className="fas fa-users text-8xl text-secondary"></i>
                </div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Active Subscribers</p>
                <p className="text-4xl font-extrabold text-secondary">{stats.active}</p>
              </div>
              <div className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-10">
                    <i className="fas fa-exclamation-circle text-8xl text-yellow-500"></i>
                </div>
                <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">Expiring Soon</p>
                <p className="text-4xl font-extrabold text-yellow-600">{stats.expiring}</p>
              </div>
            </div>
            
            <div className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 h-96">
              <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2"><i className="fas fa-chart-bar text-primary"></i> Revenue Distribution</h3>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={[
                  { name: 'Basic', amt: 2400 },
                  { name: 'Pro', amt: 1398 },
                  { name: 'Elite', amt: 9800 },
                  { name: 'PayGo', amt: 3908 },
                ]}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#9CA3AF'}} />
                  <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} tick={{fill: '#9CA3AF'}} />
                  <Tooltip 
                    cursor={{fill: '#f9fafb'}} 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)'}}
                  />
                  <Bar dataKey="amt" fill="#4F46E5" radius={[6, 6, 0, 0]} barSize={60} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* SUBSCRIBERS TAB */}
        {activeTab === 'subscribers' && (
          <div className="max-w-7xl mx-auto animate-fade-in-up">
            <div className="flex justify-between items-center mb-8">
              <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Subscribers</h1>
              <div className="flex gap-3">
                <button 
                  onClick={openAddModal}
                  className="bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-50 shadow-sm flex items-center gap-2 font-bold transition-all"
                >
                  <i className="fas fa-plus"></i> Add Manually
                </button>
                <button 
                  onClick={() => setShowImportModal(true)}
                  className="bg-dark text-white px-6 py-3 rounded-xl hover:bg-gray-800 shadow-lg shadow-gray-300 flex items-center gap-2 font-bold transition-all transform hover:-translate-y-1"
                >
                  <i className="fas fa-file-import"></i> Import CSV
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-gray-50/50 text-gray-500 text-xs font-bold uppercase tracking-wider border-b border-gray-100">
                      <th className="px-8 py-5">Name</th>
                      <th className="px-8 py-5">Status</th>
                      <th className="px-8 py-5">Plan / Amount</th>
                      <th className="px-8 py-5">Points / Payment</th>
                      <th className="px-8 py-5">End Date</th>
                      <th className="px-8 py-5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                    {subscribers.map((sub) => {
                      const daysUntilExpiry = Math.ceil((new Date(sub.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
                      const isExpiringSoon = sub.status === SubscriptionStatus.ACTIVE && daysUntilExpiry <= firstReminderDays && daysUntilExpiry > 0;
                      
                      return (
                        <tr key={sub.id} className="hover:bg-blue-50/30 transition-colors group">
                          <td className="px-8 py-5">
                            <div className="font-bold text-gray-900 text-lg">{sub.name}</div>
                            <div className="text-sm text-gray-500">{sub.email}</div>
                          </td>
                          <td className="px-8 py-5">
                            <div className="flex items-center gap-2">
                              <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                sub.status === 'Active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                              }`}>
                                {sub.status}
                              </span>
                              {isExpiringSoon && (
                                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-red-100 text-red-700 animate-pulse">
                                  <span className="w-2 h-2 mr-1.5 bg-red-500 rounded-full"></span>
                                  Expiring
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-8 py-5 text-gray-700 font-medium">
                            {sub.planName} <span className="text-gray-400 font-normal">(${sub.amount})</span>
                          </td>
                          <td className="px-8 py-5">
                             <div className="font-mono font-bold text-primary text-lg">{sub.pointsRemaining} pts</div>
                             {sub.paymentLink && (
                               <a href={sub.paymentLink} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:underline flex items-center gap-1">
                                 <i className="fas fa-external-link-alt"></i> Link Set
                               </a>
                             )}
                          </td>
                          <td className="px-8 py-5 text-gray-600 text-sm font-medium">
                            {new Date(sub.endDate).toLocaleDateString()}
                          </td>
                          <td className="px-8 py-5 text-right flex justify-end gap-2">
                            <button 
                              onClick={() => openEditModal(sub)}
                              className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-500 transition-all flex items-center justify-center"
                              title="Edit"
                            >
                              <i className="fas fa-pen"></i>
                            </button>
                            <button 
                              onClick={() => handleDeleteSub(sub.id)}
                              className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500 transition-all flex items-center justify-center"
                              title="Delete"
                            >
                              <i className="fas fa-trash"></i>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {subscribers.length === 0 && (
                  <div className="p-12 text-center text-gray-400">
                    <i className="fas fa-folder-open text-4xl mb-4 opacity-30"></i>
                    <p>No subscribers found. Import a CSV to get started.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* LOGS TAB */}
        {activeTab === 'logs' && (
           <div className="max-w-5xl mx-auto animate-fade-in-up">
             <h1 className="text-4xl font-extrabold text-gray-900 mb-4 tracking-tight">Email Logs</h1>
             <p className="text-gray-500 mb-8">History of emails initiated from the dashboard.</p>

             <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
               <table className="w-full text-left border-collapse">
                 <thead>
                   <tr className="bg-gray-50/50 text-gray-500 text-xs font-bold uppercase tracking-wider border-b border-gray-100">
                     <th className="px-8 py-4">Date Sent</th>
                     <th className="px-8 py-4">Recipient</th>
                     <th className="px-8 py-4">Type</th>
                     <th className="px-8 py-4">Status</th>
                     <th className="px-8 py-4">Preview</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-50">
                    {emailLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-8 py-4 text-sm text-gray-600">
                          {new Date(log.sentAt).toLocaleString()}
                        </td>
                        <td className="px-8 py-4">
                          <div className="font-bold text-gray-900">{log.subscriberName}</div>
                          <div className="text-xs text-gray-400">{log.subscriberEmail}</div>
                        </td>
                         <td className="px-8 py-4">
                           <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 text-gray-600">
                             {log.type.replace('_', ' ')}
                           </span>
                        </td>
                        <td className="px-8 py-4">
                          <span className="text-xs font-bold px-2 py-1 rounded bg-green-100 text-green-700 flex items-center w-fit gap-1">
                             <i className="fas fa-check-circle"></i> {log.status}
                          </span>
                        </td>
                        <td className="px-8 py-4 text-xs text-gray-500 italic truncate max-w-xs">
                          "{log.contentSnippet}"
                        </td>
                      </tr>
                    ))}
                    {emailLogs.length === 0 && (
                       <tr>
                         <td colSpan={5} className="p-12 text-center text-gray-400">
                           No emails have been sent yet.
                         </td>
                       </tr>
                    )}
                 </tbody>
               </table>
             </div>
           </div>
        )}

        {/* INTEGRATIONS TAB (WOOCOMMERCE & EMAILJS) */}
        {activeTab === 'integrations' && (
          <div className="max-w-6xl mx-auto animate-fade-in-up grid grid-cols-1 md:grid-cols-2 gap-8">
            
            {/* WooCommerce Config */}
            <div className="col-span-1">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-4">Data Sources</h2>
              <div className="bg-white p-8 rounded-2xl shadow-xl shadow-purple-100 border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                    <i className="fab fa-wordpress text-9xl"></i>
                </div>
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-xl flex items-center justify-center text-2xl">
                      <i className="fab fa-wordpress"></i>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">WooCommerce</h3>
                      <p className="text-sm text-gray-500">Sync renewals & points</p>
                    </div>
                </div>
                <div className="space-y-4 mb-8">
                    <div>
                      <label htmlFor="woo-url" className="block text-sm font-bold text-gray-900 mb-2">Website URL</label>
                      <input 
                        id="woo-url"
                        type="url" 
                        aria-label="Website URL"
                        placeholder="https://yourwebsite.com"
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
                        value={wooSettings.url}
                        onChange={(e) => setWooSettings({...wooSettings, url: e.target.value})}
                      />
                    </div>
                    <div>
                        <label htmlFor="woo-ck" className="block text-sm font-bold text-gray-900 mb-2">Consumer Key</label>
                        <input 
                          id="woo-ck"
                          type="password" 
                          aria-label="Consumer Key"
                          className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
                          value={wooSettings.consumerKey}
                          onChange={(e) => setWooSettings({...wooSettings, consumerKey: e.target.value})}
                        />
                    </div>
                    <div>
                        <label htmlFor="woo-cs" className="block text-sm font-bold text-gray-900 mb-2">Consumer Secret</label>
                        <input 
                          id="woo-cs"
                          type="password" 
                          aria-label="Consumer Secret"
                          className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
                          value={wooSettings.consumerSecret}
                          onChange={(e) => setWooSettings({...wooSettings, consumerSecret: e.target.value})}
                        />
                    </div>
                    <div>
                      <label htmlFor="woo-points" className="block text-sm font-bold text-gray-900 mb-2">Points per $1</label>
                      <input 
                        id="woo-points"
                        type="number" 
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
                        value={wooSettings.pointsPerDollar}
                        onChange={(e) => setWooSettings({...wooSettings, pointsPerDollar: parseFloat(e.target.value)})}
                      />
                    </div>
                </div>
                <div className="flex justify-end">
                    <button 
                      onClick={handleWooSync}
                      disabled={loading}
                      className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700 flex items-center gap-2 text-sm"
                    >
                      {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync"></i>}
                      Test Sync
                    </button>
                </div>
                {syncLog && (
                 <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${syncLog.includes('Error') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
                   {syncLog}
                 </div>
               )}
              </div>
            </div>

            {/* EmailJS Config */}
            <div className="col-span-1">
              <h2 className="text-2xl font-extrabold text-gray-900 mb-4">Email Delivery</h2>
              <div className="bg-white p-8 rounded-2xl shadow-xl shadow-orange-100 border border-gray-100 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-5">
                    <i className="fas fa-paper-plane text-9xl"></i>
                </div>
                <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-2xl">
                      <i className="fas fa-envelope-open-text"></i>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">EmailJS (SMTP)</h3>
                      <p className="text-sm text-gray-500">Automated background sending</p>
                    </div>
                </div>

                <div className="mb-4 flex items-center gap-2 bg-blue-50 p-3 rounded-lg text-sm text-blue-800">
                  <i className="fas fa-info-circle"></i>
                  Free account allows 200 emails/mo. No backend needed.
                </div>

                <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-3 mb-2">
                       <input 
                         type="checkbox" 
                         id="email-enable"
                         checked={emailSettings.isEnabled}
                         onChange={(e) => setEmailSettings({...emailSettings, isEnabled: e.target.checked})}
                         className="w-5 h-5 text-primary rounded focus:ring-primary"
                       />
                       <label htmlFor="email-enable" className="font-bold text-gray-700">Enable Automated Sending</label>
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Service ID</label>
                      <input 
                        type="text" 
                        placeholder="service_xxxx"
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
                        value={emailSettings.serviceId}
                        onChange={(e) => setEmailSettings({...emailSettings, serviceId: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Template ID</label>
                      <input 
                        type="text" 
                        placeholder="template_xxxx"
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
                        value={emailSettings.templateId}
                        onChange={(e) => setEmailSettings({...emailSettings, templateId: e.target.value})}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-gray-900 mb-2">Public Key</label>
                      <input 
                        type="password" 
                        placeholder="User Public Key"
                        className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
                        value={emailSettings.publicKey}
                        onChange={(e) => setEmailSettings({...emailSettings, publicKey: e.target.value})}
                      />
                    </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* SETTINGS TAB */}
        {activeTab === 'settings' && (
           <div className="max-w-5xl mx-auto animate-fade-in-up">
             <div className="flex justify-between items-center mb-8">
               <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Settings</h1>
               <button 
                  onClick={handleExportData}
                  className="text-gray-600 hover:text-primary font-bold flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors"
               >
                 <i className="fas fa-download"></i> Export Data Backup (JSON)
               </button>
             </div>
             
             <div className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 mb-8">
                <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2"><i className="far fa-clock text-primary"></i> Notification Timing</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <label className="block text-sm font-bold text-gray-700 mb-3">First Reminder (Days before expiry)</label>
                    <div className="relative">
                       <input 
                         type="number" 
                         min="1"
                         max="30"
                         className="w-full p-4 pl-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-lg font-bold text-gray-800 shadow-sm"
                         value={firstReminderDays}
                         onChange={(e) => setFirstReminderDays(parseInt(e.target.value) || 3)}
                       />
                       <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                         <i className="far fa-calendar-alt text-gray-400 text-lg"></i>
                       </div>
                    </div>
                  </div>

                  <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
                    <label className="block text-sm font-bold text-gray-700 mb-3">Final Reminder (Days before expiry)</label>
                    <div className="relative">
                       <input 
                         type="number" 
                         min="1"
                         max="10"
                         className="w-full p-4 pl-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-lg font-bold text-gray-800 shadow-sm"
                         value={finalReminderDays}
                         onChange={(e) => setFinalReminderDays(parseInt(e.target.value) || 1)}
                       />
                       <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                         <i className="far fa-bell text-gray-400 text-lg"></i>
                       </div>
                    </div>
                  </div>
                </div>
             </div>

             {/* Rich Text Editor Section */}
             <div className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100">
                <div className="flex justify-between items-center mb-4">
                   <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2"><i className="fas fa-robot text-purple-500"></i> AI Email Template</h3>
                </div>
                
                <div className="mb-8">
                   <label className="block text-sm font-bold text-gray-700 mb-2">Template Instructions & Structure</label>
                   <p className="text-xs text-gray-500 mb-3">Design your email. The AI will fill in the placeholders. Use the toolbar to format text.</p>
                   
                   <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 focus-within:ring-2 focus-within:ring-primary">
                     {/* Toolbar */}
                     <div className="flex flex-wrap items-center gap-2 p-2 border-b border-gray-200 bg-white">
                       <div className="flex gap-1 border-r border-gray-200 pr-2">
                         <button onClick={() => formatText('bold')} className="p-2 hover:bg-gray-100 rounded text-gray-600 font-bold" title="Bold">B</button>
                         <button onClick={() => formatText('italic')} className="p-2 hover:bg-gray-100 rounded text-gray-600 italic" title="Italic">I</button>
                         <button onClick={() => formatText('link')} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Link"><i className="fas fa-link"></i></button>
                       </div>
                       <div className="flex gap-2 pl-2">
                         <button onClick={() => insertAtCursor('{name}')} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full hover:bg-indigo-100 transition-colors">+ Name</button>
                         <button onClick={() => insertAtCursor('{points}')} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full hover:bg-indigo-100 transition-colors">+ Points</button>
                         <button onClick={() => insertAtCursor('{daysLeft}')} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full hover:bg-indigo-100 transition-colors">+ Days Left</button>
                         <button onClick={() => insertAtCursor('{paymentLink}')} className="px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full hover:bg-green-100 transition-colors">+ Payment Link</button>
                       </div>
                     </div>

                     <textarea
                        ref={editorRef}
                        className="w-full h-64 p-4 text-sm bg-gray-50 focus:outline-none font-mono leading-relaxed resize-none"
                        placeholder="Hi {name}, just a reminder that your {planName} expires in {daysLeft} days..."
                        value={customEmailContext}
                        onChange={(e) => setCustomEmailContext(e.target.value)}
                     ></textarea>
                   </div>
                </div>

                <div className="border-t border-gray-100 pt-6">
                  <h4 className="font-bold text-gray-800 mb-4">Preview generated email</h4>
                  <div className="flex gap-4 mb-6">
                    <button 
                      onClick={() => handlePreviewEmail('FIRST')}
                      disabled={previewLoading}
                      className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all transform hover:-translate-y-0.5 shadow-sm ${previewType === 'FIRST' ? 'bg-primary text-white shadow-indigo-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                      {previewLoading && previewType === 'FIRST' && <i className="fas fa-spinner fa-spin"></i>}
                      Preview {firstReminderDays}-Day Email
                    </button>
                    <button 
                      onClick={() => handlePreviewEmail('FINAL')}
                      disabled={previewLoading}
                      className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all transform hover:-translate-y-0.5 shadow-sm ${previewType === 'FINAL' ? 'bg-primary text-white shadow-indigo-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                    >
                       {previewLoading && previewType === 'FINAL' && <i className="fas fa-spinner fa-spin"></i>}
                      Preview {finalReminderDays}-Day Email
                    </button>
                  </div>

                  {previewContent ? (
                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-inner">
                      <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Draft Preview</span>
                        <span className="text-xs text-gray-400"><i className="fas fa-magic mr-1"></i> AI Generated</span>
                      </div>
                      <div className="p-8 bg-white text-gray-700 whitespace-pre-wrap font-serif leading-relaxed">
                        {previewContent}
                      </div>
                    </div>
                  ) : (
                      !previewLoading && (
                      <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                         <i className="fas fa-eye text-gray-300 text-5xl mb-4"></i>
                         <p className="text-gray-400 font-medium">Select a button above to generate a live AI preview using your custom settings.</p>
                      </div>
                   )
                  )}
                </div>
             </div>
           </div>
        )}

      </main>

      {/* Import Modal */}
      {showImportModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-8 m-4 transform transition-all scale-100">
            <div className="flex justify-between items-start mb-6">
               <h3 className="text-2xl font-extrabold text-gray-900">Import Subscribers</h3>
               <button onClick={() => setShowImportModal(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-xl"></i></button>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl mb-4 flex gap-3 items-start">
               <i className="fas fa-info-circle text-blue-500 mt-1"></i>
               <p className="text-sm text-blue-800">Paste your raw CSV data or text from WordPress below. Our AI will automatically parse columns like Name, Email, Plan, and Expiry Date.</p>
            </div>
            <textarea 
              className="w-full h-48 p-4 border border-gray-300 rounded-xl mb-6 focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50 text-sm font-mono"
              placeholder="John Doe, john@email.com, Gold Plan, $50, 2023-12-31, https://stripe.com/..."
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
            ></textarea>
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowImportModal(false)}
                className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleImport}
                disabled={loading}
                className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-indigo-700 flex items-center gap-2 font-bold shadow-lg shadow-indigo-200 transition-transform active:scale-95"
              >
                {loading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
                Smart Import
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showSubModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 m-4 overflow-y-auto max-h-[90vh]">
            <div className="flex justify-between items-start mb-6">
               <h3 className="text-2xl font-extrabold text-gray-900">{editingSub ? 'Edit Subscriber' : 'Add New Subscriber'}</h3>
               <button onClick={() => setShowSubModal(false)} className="text-gray-400 hover:text-gray-600"><i className="fas fa-times text-xl"></i></button>
            </div>
            <form onSubmit={handleSaveSubscriber} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
                <input required type="text" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.name} onChange={e => setSubForm({...subForm, name: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
                <input required type="email" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.email} onChange={e => setSubForm({...subForm, email: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Plan Name</label>
                <input required type="text" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.planName} onChange={e => setSubForm({...subForm, planName: e.target.value})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Amount ($)</label>
                <input required type="number" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.amount} onChange={e => setSubForm({...subForm, amount: parseFloat(e.target.value)})} />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">End Date</label>
                <input required type="date" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.endDate} onChange={e => setSubForm({...subForm, endDate: e.target.value})} />
              </div>
               <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Points Remaining</label>
                <input required type="number" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.pointsRemaining} onChange={e => setSubForm({...subForm, pointsRemaining: parseInt(e.target.value)})} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-bold text-gray-700 mb-2">Payment Link (Optional)</label>
                <input type="url" placeholder="https://paypal.me/..." className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.paymentLink} onChange={e => setSubForm({...subForm, paymentLink: e.target.value})} />
                <p className="text-xs text-gray-500 mt-1">If provided, the AI will include this link in the renewal email.</p>
              </div>
              <div className="md:col-span-2 flex justify-end gap-3 mt-4">
                 <button type="button" onClick={() => setShowSubModal(false)} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
                 <button type="submit" className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg">{editingSub ? 'Save Changes' : 'Add Subscriber'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;