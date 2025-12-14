import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/src/services/apiClient';
import { fetchSubscribers } from '@/src/services/subscribersService';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';

// Components
import { DashboardLayout } from '@/src/components/layout/DashboardLayout';
import { BriefingHeader } from '@/src/components/dashboard/BriefingHeader';
import { StatCard } from '@/src/components/dashboard/StatCard';
import { ActionCenter } from '@/src/components/dashboard/ActionCenter';
import { SubscribersView } from '@/src/components/dashboard/SubscribersView';
import { SettingsView } from '@/src/components/dashboard/SettingsView';
import { IntegrationsView } from '@/src/components/dashboard/IntegrationsView';
import { EditSubscriberModal } from '@/src/components/dashboard/EditSubscriberModal';
import { PointsFlowChart, RetentionForecastChart } from '@/src/components/dashboard/ChartComponents';

// Types
import {
  AdminWhatsAppConfig, AppSettings, EmailLog, EmailTemplateConfig,
  ReminderConfig, ReminderTask, Subscriber, SubscriberStats,
  WooSettings, WebsiteConnection, ReminderSendResponse
} from '@/src/types';

// Default Configs
const defaultReminderConfig: ReminderConfig = { firstReminderDays: 3, finalReminderDays: 1 };
const defaultEmailTemplate: EmailTemplateConfig = {
  subjectTemplate: 'Action Required: Subscription Renewal',
  bodyTemplate: 'Hi {name}, your plan expires in {daysLeft} days.',
  context: 'Keep emails concise.',
};
const defaultWooSettings: WooSettings = { url: '', consumerKey: '', consumerSecret: '', pointsPerCurrency: 1 };
const defaultAdminWhatsApp: AdminWhatsAppConfig = { phoneNumber: '' };

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();

  // --- State ---
  const [activeTab, setActiveTab] = useState('overview'); // Default to overview to show charts

  // Data State
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<SubscriberStats | null>(null);
  const [tasks, setTasks] = useState<ReminderTask[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [connections, setConnections] = useState<WebsiteConnection[]>([]);

  // Reports State
  const [retentionData, setRetentionData] = useState<any>(null);
  const [pointsFlowData, setPointsFlowData] = useState<any[]>([]);

  // Settings State
  const [reminderConfig, setReminderConfig] = useState(defaultReminderConfig);
  const [emailTemplate, setEmailTemplate] = useState(defaultEmailTemplate);
  const [wooSettings, setWooSettings] = useState(defaultWooSettings);
  const [adminWhatsApp, setAdminWhatsApp] = useState(defaultAdminWhatsApp);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingWoo, setIsSyncingWoo] = useState(false);
  const [isSyncingRecent, setIsSyncingRecent] = useState(false); // New State
  const [isBackfillingWoo, setIsBackfillingWoo] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState<number | undefined>(undefined);
  const [syncLog, setSyncLog] = useState('');
  const [sendingTaskId, setSendingTaskId] = useState<string | null>(null);

  // ... (existing effects and data loading)

  // ... (existing actions)

  const handleBackfillWoo = async () => {
    setIsBackfillingWoo(true);
    setBackfillProgress(0);
    setSyncLog('Starting background deep history fetch...');

    try {
      // Start Background Job
      await apiFetch('/api/woo/backfill?background=true', { method: 'POST' });

      // Poll for status
      const pollInterval = setInterval(async () => {
        try {
          const status = await apiFetch<{ status: string; progress: number; message: string; processed: number; total: number }>('/api/woo/status');

          setBackfillProgress(status.progress);
          setSyncLog(status.message);

          if (status.status === 'completed' || status.status === 'error') {
            clearInterval(pollInterval);
            setIsBackfillingWoo(false);

            if (status.status === 'completed') {
              setSyncLog(status.message); // Ensure final message shown
              setBackfillProgress(100);
              loadInitialData(); // Refresh data
            } else {
              setSyncLog(`Error: ${status.message}`);
            }

            setTimeout(() => setBackfillProgress(undefined), 5000);
          }
        } catch (err) {
          console.error('Poll error', err);
        }
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setSyncLog(`Backfill Start Error: ${err.message}`);
      setIsBackfillingWoo(false);
    }
  };

  // ... (render)



  // Subscribers Listing State
  const [subPage, setSubPage] = useState(1);
  const [subTotal, setSubTotal] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  // New state for filters
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [expiringFilter, setExpiringFilter] = useState<number | undefined>(undefined);

  const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);

  // --- Effects ---
  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (activeTab === 'subscribers') {
      loadSubscribers(subPage, searchQuery, statusFilter, expiringFilter);
    }
  }, [subPage, searchQuery, activeTab, statusFilter, expiringFilter]);

  useEffect(() => {
    loadConnections();
  }, []);

  // --- Data Loading ---
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [settingsRes, statsRes, tasksRes, retentionRes, pointsRes] = await Promise.all([
        apiFetch<AppSettings>('/api/settings'),
        apiFetch<SubscriberStats>('/api/subscribers/stats'),
        apiFetch<ReminderTask[]>('/api/reminders/tasks'),
        apiFetch<any>('/api/reports/retention'),
        apiFetch<any[]>('/api/reports/points-flow')
      ]);

      setReminderConfig(settingsRes.reminderConfig || defaultReminderConfig);
      setEmailTemplate(settingsRes.emailTemplate || defaultEmailTemplate);
      setWooSettings(settingsRes.wooSettings || defaultWooSettings);
      setAdminWhatsApp(settingsRes.adminWhatsApp || defaultAdminWhatsApp);

      setStats(statsRes);
      setTasks(tasksRes);
      setRetentionData(retentionRes);
      setPointsFlowData(pointsRes);
    } catch (err) {
      console.error('Failed to load dashboard data', err);
    } finally {
      setIsLoading(false);
    }
  };

  const loadSubscribers = async (page: number, q: string, status?: string, expiringIn?: number) => {
    try {
      const res = await fetchSubscribers({
        page,
        pageSize: 25,
        q,
        status,
        expiringInDays: expiringIn
      });
      setSubscribers(res.data || res.items || []);
      setSubTotal(res.meta?.totalItems || res.total || 0);
    } catch (err) {
      console.error(err);
    }
  };

  const loadConnections = async () => {
    try {
      const res = await apiFetch<WebsiteConnection[]>('/api/website-connections');
      setConnections(res);
    } catch (err) {
      console.error('Failed to load connections', err);
    }
  };

  // --- Card Actions ---
  const handleCardClick = (type: 'active' | 'risk') => {
    setActiveTab('subscribers');
    setSubPage(1); // Reset to page 1

    if (type === 'active') {
      setSearchQuery('');
      setStatusFilter('ACTIVE');
      setExpiringFilter(undefined);
    } else if (type === 'risk') {
      setSearchQuery('');
      setStatusFilter(undefined); // Or 'ACTIVE' if we only want active expiring? Usually expiring implies active.
      setExpiringFilter(7); // "Expiring soon" usually means next 7 days in our logic
    }
  };

  // --- Actions ---
  const handleSaveSettings = async () => {
    setIsSaving(true);
    try {
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ reminderConfig, emailTemplate, adminWhatsApp, wooSettings })
      });
      alert('Settings saved!');
    } catch (err) {
      alert('Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSendReminder = async (task: ReminderTask) => {
    setSendingTaskId(task.id);
    try {
      const res = await apiFetch<ReminderSendResponse>('/api/reminders/send', {
        method: 'POST',
        body: JSON.stringify({ taskId: task.id })
      });
      if (res.success) {
        setTasks(prev => prev.filter(t => t.id !== task.id));
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSendingTaskId(null);
    }
  };

  const handleCreateConnection = async (url: string) => {
    try {
      const res = await apiFetch<WebsiteConnection>('/api/website-connections', {
        method: 'POST',
        body: JSON.stringify({ websiteUrl: url })
      });
      setConnections([res, ...connections]);
    } catch (err) {
      alert('Failed to create connection');
    }
  };

  const handleDeleteConnection = async (id: string) => {
    if (!confirm('Delete this connection?')) return;
    try {
      await apiFetch(`/api/website-connections/${id}`, { method: 'DELETE' });
      setConnections(connections.filter(c => c.id !== id));
    } catch (err) {
      alert('Failed error');
    }
  };

  const handleSyncWoo = async () => {
    setIsSyncingWoo(true);
    setSyncLog('Starting sync...');
    try {
      // Step 1: Fetch Page 1 to get total pages
      let totalCreated = 0;
      let totalUpdated = 0;

      setSyncLog(`Syncing page 1...`);
      const firstRes = await apiFetch<{ created: number; updated: number; totalUsers: number; totalPages: number }>('/api/woo/sync?page=1', { method: 'POST' });

      totalCreated += firstRes.created;
      totalUpdated += firstRes.updated;
      const totalPages = firstRes.totalPages;
      const totalUsers = firstRes.totalUsers;

      if (totalPages > 1) {
        for (let p = 2; p <= totalPages; p++) {
          setSyncLog(`Syncing batch ${p} of ${totalPages}...`);
          const res = await apiFetch<{ created: number; updated: number }>('/api/woo/sync?page=' + p, { method: 'POST' });
          totalCreated += res.created;
          totalUpdated += res.updated;
        }
      }

      setSyncLog(`Success! Synced ${totalUsers} users. (New: ${totalCreated}, Updated: ${totalUpdated})`);

      // Update last sync time
      const now = new Date().toISOString();
      const newWooSettings = { ...wooSettings, lastSync: now };
      await apiFetch('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({ reminderConfig, emailTemplate, adminWhatsApp, wooSettings: newWooSettings })
      });
      setWooSettings(newWooSettings);

      loadSubscribers(subPage, searchQuery); // Refresh the table
      loadInitialData(); // Refresh stats as well // Actually redundant if we updated settings manually, but good for stats
    } catch (err: any) {
      console.error(err);
      setSyncLog(`Error: ${err.message}`);
    } finally {
      setIsSyncingWoo(false);
    }
  };

  const handleSyncRecent = async () => {
    setIsSyncingRecent(true);
    setSyncLog('Starting background sync...');
    try {
      setSyncLog(`Initiating background sync (last 30 days)...`);

      const date = new Date();
      date.setDate(date.getDate() - 30);
      const updatedAfter = date.toISOString();

      // Start Background Job
      await apiFetch(`/api/woo/sync?background=true&include_history=true&updated_after=${encodeURIComponent(updatedAfter)}`, { method: 'POST' });

      // Poll
      const pollInterval = setInterval(async () => {
        try {
          const status = await apiFetch<{ status: string; progress: number; message: string }>('/api/woo/status');

          // Re-use backfill progress bar for sync status visualization if we want, or just log
          // For now, let's look at the log and spinner
          setSyncLog(status.message);

          if (status.status === 'completed' || status.status === 'error') {
            clearInterval(pollInterval);
            setIsSyncingRecent(false);

            if (status.status === 'completed') {
              setSyncLog(status.message);

              // Update last sync time manually or fetch settings again?
              // The backend job didn't update settings?
              // Let's update settings here for UI consistency
              const now = new Date().toISOString();
              const newWooSettings = { ...wooSettings, lastSync: now };
              setWooSettings(newWooSettings); // Optimistic update

              loadSubscribers(subPage, searchQuery);
              loadInitialData();
            } else {
              setSyncLog(`Error: ${status.message}`);
            }
          }
        } catch (e) { console.error(e); }
      }, 1000);

    } catch (err: any) {
      console.error(err);
      setSyncLog(`Error: ${err.message}`);
      setIsSyncingRecent(false);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/sign-in');
  };

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm(t('confirm_delete'))) return;
    try {
      await apiFetch(`/api/subscribers/${id}`, { method: 'DELETE' });
      loadSubscribers(subPage, searchQuery);
    } catch (err) {
      alert('Failed to delete');
    }
  };

  // --- Render ---
  return (
    <DashboardLayout activeTab={activeTab} onTabChange={setActiveTab} onLogout={handleLogout}>

      {/* Overview Stats (Always Visible on Overview/Action tabs) */}
      {(activeTab === 'overview' || activeTab === 'action') && stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8 animate-fade-in-up">
            <StatCard
              label={t('active_subscribers')}
              value={stats.totalActive.toString()}
              icon="fa-users" color="violet"
              onClick={() => handleCardClick('active')}
            />
            <StatCard
              label="Points Liability"
              value={stats.totalPointsRemaining.toLocaleString()}
              trend="Unredeemed points" trendUp={false}
              icon="fa-coins" color="cyan"
            // Points View not implemented yet, so no onClick
            />
            <StatCard
              label={t('churn_risk')}
              value={stats.totalExpired.toString()}
              trend={`${stats.expiringSoonCount} expiring soon`} trendUp={false}
              icon="fa-user-times" color="rose"
              onClick={() => handleCardClick('risk')}
            />
            <StatCard
              label={t('revenue_recovered')}
              value="$0"
              trend="Not available" trendUp={true}
              icon="fa-check-circle" color="emerald"
            />
          </div>

          {/* Charts Row - Only on Overview */}
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 animate-fade-in-up animation-delay-100">
              <RetentionForecastChart
                data={retentionData?.dailyForecast || []}
                summary={retentionData?.summary || { overdue: 0, today: 0, next7Days: 0 }}
                isLoading={isLoading}
              />
              <PointsFlowChart
                data={pointsFlowData}
                isLoading={isLoading}
              />
            </div>
          )}
        </>
      )}

      <div className="animate-fade-in-up animation-delay-100">
        {activeTab === 'action' && (
          <ActionCenter
            // ... existing props
            tasks={tasks}
            onSend={handleSendReminder}
            sendingTaskId={sendingTaskId}
            onSendBatch={() => { }}
            isBatchSending={false}
          />
        )}
        {activeTab === 'subscribers' && (
          <>
            <SubscribersView
              subscribers={subscribers}
              isLoading={false}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              page={subPage}
              total={subTotal}
              onPageChange={setSubPage}
              onAddSubscriber={() => { }}
              onEdit={setEditingSubscriber}
              onDelete={handleDeleteSubscriber}
            // Pass filter state functionality if View supports it, or just use it implicitly via loadSubscribers
            // For now, let's add a "Clear Filters" button in the view if filters are active?
            // The View currently doesn't accept filter props, so we just control data from here.
            />
            {/* Show active filter banner if needed */}
            {(statusFilter || expiringFilter !== undefined) && (
              <div className="mb-4 flex items-center gap-2 text-sm text-zinc-400 bg-zinc-800/50 p-2 rounded-lg border border-zinc-700/50">
                <i className="fas fa-filter text-violet-400"></i>
                <span>
                  Filtering by:
                  {statusFilter && <span className="text-white ml-1 font-medium">Status: {statusFilter}</span>}
                  {expiringFilter !== undefined && <span className="text-white ml-1 font-medium">Expiring in {expiringFilter} days</span>}
                </span>
                <button
                  onClick={() => { setStatusFilter(undefined); setExpiringFilter(undefined); loadSubscribers(1, searchQuery); }}
                  className="ml-auto text-xs hover:text-white underline"
                >
                  Clear Filters
                </button>
              </div>
            )}

            <EditSubscriberModal
              isOpen={!!editingSubscriber}
              onClose={() => setEditingSubscriber(null)}
              subscriber={editingSubscriber}
              onSuccess={() => {
                loadSubscribers(subPage, searchQuery);
                loadInitialData(); // Refresh stats
              }}
            />
          </>
        )
        }

        {
          activeTab === 'integrations' && (
            <IntegrationsView
              wooSettings={wooSettings}
              setWooSettings={setWooSettings}
              connections={connections}
              onCreateConnection={handleCreateConnection}
              onDeleteConnection={handleDeleteConnection}
              onRegenerateKey={() => { }}
              onSave={handleSaveSettings}
              isSaving={isSaving}
              onSyncWoo={handleSyncWoo}
              isSyncingWoo={isSyncingWoo}
              onBackfillWoo={handleBackfillWoo}
              isBackfillingWoo={isBackfillingWoo}
              backfillProgress={backfillProgress}
              syncLog={syncLog}
              onSyncRecent={handleSyncRecent}
              isSyncingRecent={isSyncingRecent}
            />
          )
        }

        {
          activeTab === 'settings' && (
            <SettingsView
              reminderConfig={reminderConfig}
              setReminderConfig={setReminderConfig}
              emailTemplate={emailTemplate}
              setEmailTemplate={setEmailTemplate}
              adminWhatsApp={adminWhatsApp}
              setAdminWhatsApp={setAdminWhatsApp}
              onSave={handleSaveSettings}
              isSaving={isSaving}
            />
          )
        }
      </div >
    </DashboardLayout >
  );
};

export default Dashboard;