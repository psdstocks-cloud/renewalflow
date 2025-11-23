import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AdminWhatsAppConfig,
  AppSettings,
  EmailLog,
  EmailTemplateConfig,
  ImportResult,
  ReminderConfig,
  ReminderSendResponse,
  ReminderTask,
  Subscriber,
  SubscriberStats,
  SubscribersResponse,
  SubscriptionStatus,
  WooSettings,
  WooSyncResult,
  WebsiteConnection,
} from '@/src/types';
import { apiFetch } from '@/src/services/apiClient';
import { fetchSubscribers, SubscribersQueryParams } from '@/src/services/subscribersService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/src/context/AuthContext';

interface SubscriberFormState {
  name: string;
  email: string;
  phone: string;
  planName: string;
  amount: number;
  currency: string;
  startDate: string;
  endDate: string;
  pointsRemaining: number;
  paymentLink: string;
  status: SubscriptionStatus;
}

const defaultReminderConfig: ReminderConfig = { firstReminderDays: 3, finalReminderDays: 1 };
const defaultEmailTemplate: EmailTemplateConfig = {
  subjectTemplate: 'Action Required: Subscription Renewal',
  bodyTemplate: 'Hi {name}, your {planName} plan expires in {daysLeft} days. Renew now to roll over {points} points.',
  context: 'Keep emails concise and action-focused.',
};
const defaultWooSettings: WooSettings = {
  url: '',
  consumerKey: '',
  consumerSecret: '',
  pointsPerCurrency: 1,
};
const defaultAdminWhatsApp: AdminWhatsAppConfig = { phoneNumber: '' };

const initialFormState: SubscriberFormState = {
  name: '',
  email: '',
  phone: '',
  planName: '',
  amount: 0,
  currency: 'USD',
  startDate: new Date().toISOString().split('T')[0],
  endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  pointsRemaining: 0,
  paymentLink: '',
  status: 'ACTIVE',
};

const statusLabels: Record<SubscriptionStatus, string> = {
  ACTIVE: 'Active',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [subscribersTotal, setSubscribersTotal] = useState(0);
  const [subscribersPage, setSubscribersPage] = useState(1);
  const [subscribersPerPage] = useState(25);
  const [subscribersLoading, setSubscribersLoading] = useState(false);
  
  // Filter state
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [quickFilter, setQuickFilter] = useState<'all' | 'active' | 'expiring_7' | 'expiring_30' | 'overdue'>(() => {
    const filter = searchParams.get('filter') || 'all';
    return ['all', 'active', 'expiring_7', 'expiring_30', 'overdue'].includes(filter) ? filter as any : 'all';
  });
  const [sortBy, setSortBy] = useState(() => searchParams.get('sortBy') || 'endDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(() => (searchParams.get('sortDir') || 'asc') as 'asc' | 'desc');
  const [subscriberStats, setSubscriberStats] = useState<SubscriberStats | null>(null);
  const [reminderTasks, setReminderTasks] = useState<ReminderTask[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLog[]>([]);
  const [reminderConfig, setReminderConfig] = useState<ReminderConfig>(defaultReminderConfig);
  const [emailTemplate, setEmailTemplate] = useState<EmailTemplateConfig>(defaultEmailTemplate);
  const [wooSettings, setWooSettings] = useState<WooSettings>(defaultWooSettings);
  const [adminWhatsApp, setAdminWhatsApp] = useState<AdminWhatsAppConfig>(defaultAdminWhatsApp);
  const [activeTab, setActiveTab] = useState<'overview' | 'subscribers' | 'action' | 'settings' | 'integrations' | 'logs'>('action');
  const [isLoading, setIsLoading] = useState(true);
  const [isTasksLoading, setIsTasksLoading] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isSyncingWoo, setIsSyncingWoo] = useState(false);
  const [syncLog, setSyncLog] = useState('');
  const [showImportModal, setShowImportModal] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{
    status: 'running' | 'completed' | 'error' | 'idle';
    processed: number;
    total: number;
    created: number;
    updated: number;
    message: string;
    startTime?: string;
    endTime?: string;
  } | null>(null);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [importText, setImportText] = useState('');
  const [isImporting, setIsImporting] = useState(false);
  const [showSubModal, setShowSubModal] = useState(false);
  const [subForm, setSubForm] = useState<SubscriberFormState>(initialFormState);
  const [editingSub, setEditingSub] = useState<Subscriber | null>(null);
  const [sendingTaskId, setSendingTaskId] = useState<string | null>(null);
  const [isBatchSending, setIsBatchSending] = useState(false);
  const [whatsappSummary, setWhatsappSummary] = useState('');
  const [isWhatsappLoading, setIsWhatsappLoading] = useState(false);
  const [previewContent, setPreviewContent] = useState('');
  const [previewType, setPreviewType] = useState<'FIRST' | 'FINAL' | null>(null);
  const [isSyncingFromWordPress, setIsSyncingFromWordPress] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [websiteConnections, setWebsiteConnections] = useState<WebsiteConnection[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(false);
  const [newWebsiteUrl, setNewWebsiteUrl] = useState('');
  const [isCreatingConnection, setIsCreatingConnection] = useState(false);
  const [copiedApiKey, setCopiedApiKey] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth/sign-in');
  };

  useEffect(() => {
    loadInitialData();
    loadReminderTasks();
  }, []);

  useEffect(() => {
    if (activeTab === 'subscribers') {
      loadSubscribersPage(subscribersPage);
    }
  }, [subscribersPage, activeTab]);

  const loadWebsiteConnections = async () => {
    setIsLoadingConnections(true);
    try {
      const connections = await apiFetch<WebsiteConnection[]>('/api/website-connections');
      setWebsiteConnections(connections);
    } catch (err) {
      console.error('Failed to load website connections:', err);
      setError('Failed to load website connections.');
    } finally {
      setIsLoadingConnections(false);
    }
  };

  const handleCreateWebsiteConnection = async () => {
    if (!newWebsiteUrl.trim()) {
      setError('Please enter a website URL');
      return;
    }

    setIsCreatingConnection(true);
    setError(null);
    try {
      const connection = await apiFetch<WebsiteConnection>('/api/website-connections', {
        method: 'POST',
        body: JSON.stringify({ websiteUrl: newWebsiteUrl.trim() }),
      });
      setWebsiteConnections([connection, ...websiteConnections]);
      setNewWebsiteUrl('');
      setSuccessMessage('Website connection created! Copy the API key to your WordPress plugin.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to create website connection.');
    } finally {
      setIsCreatingConnection(false);
    }
  };

  const handleRegenerateApiKey = async (connectionId: string) => {
    try {
      const updated = await apiFetch<WebsiteConnection>(`/api/website-connections/${connectionId}/regenerate-key`, {
        method: 'POST',
      });
      setWebsiteConnections(websiteConnections.map(c => c.id === connectionId ? updated : c));
      setSuccessMessage('API key regenerated! Update your WordPress plugin with the new key.');
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to regenerate API key.');
    }
  };

  const handleDeleteConnection = async (connectionId: string) => {
    if (!confirm('Are you sure you want to delete this website connection? This will stop syncing from this website.')) {
      return;
    }

    try {
      await apiFetch(`/api/website-connections/${connectionId}`, {
        method: 'DELETE',
      });
      setWebsiteConnections(websiteConnections.filter(c => c.id !== connectionId));
      setSuccessMessage('Website connection deleted.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to delete website connection.');
    }
  };

  const handleCopyApiKey = async (apiKey: string) => {
    try {
      await navigator.clipboard.writeText(apiKey);
      setCopiedApiKey(apiKey);
      setSuccessMessage('API key copied to clipboard!');
      setTimeout(() => {
        setCopiedApiKey(null);
        setSuccessMessage(null);
      }, 3000);
    } catch (err) {
      setError('Failed to copy API key. Please copy it manually.');
    }
  };

  useEffect(() => {
    if (activeTab === 'action') {
      loadReminderTasks();
    } else if (activeTab === 'integrations') {
      loadWebsiteConnections();
    }
  }, [activeTab]);

  // Debounced search effect
  useEffect(() => {
    if (activeTab !== 'subscribers') return;
    
    const timeoutId = setTimeout(() => {
      loadSubscribers(1); // Reset to page 1 when search changes
    }, 300);

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, quickFilter, sortBy, sortDir, activeTab]);

  // Load initial filters from URL on mount
  useEffect(() => {
    if (activeTab === 'subscribers') {
      const urlQ = searchParams.get('q');
      const urlFilter = searchParams.get('filter');
      const urlPage = searchParams.get('page');
      const urlSortBy = searchParams.get('sortBy');
      const urlSortDir = searchParams.get('sortDir');
      
      if (urlQ) setSearchQuery(urlQ);
      if (urlFilter && ['all', 'active', 'expiring_7', 'expiring_30', 'overdue'].includes(urlFilter)) {
        setQuickFilter(urlFilter as any);
      }
      if (urlPage) setSubscribersPage(Number(urlPage));
      if (urlSortBy) setSortBy(urlSortBy);
      if (urlSortDir && ['asc', 'desc'].includes(urlSortDir)) setSortDir(urlSortDir as 'asc' | 'desc');
    }
  }, []);

  // Build query params from filter state
  const buildSubscriberQuery = (page: number = subscribersPage): SubscribersQueryParams => {
    const params: SubscribersQueryParams = {
      page,
      pageSize: subscribersPerPage,
      sortBy,
      sortDir,
    };

    if (searchQuery) {
      params.q = searchQuery;
    }

    // Apply quick filter
    switch (quickFilter) {
      case 'active':
        params.status = 'ACTIVE';
        break;
      case 'expiring_7':
        params.status = 'ACTIVE';
        params.expiringInDays = 7;
        break;
      case 'expiring_30':
        params.status = 'ACTIVE';
        params.expiringInDays = 30;
        break;
      case 'overdue':
        params.status = 'ACTIVE';
        params.nextRenewalTo = new Date().toISOString();
        break;
      case 'all':
      default:
        // No additional filters
        break;
    }

    return params;
  };

  const loadSubscribers = async (page: number = subscribersPage) => {
    setSubscribersLoading(true);
    try {
      const params = buildSubscriberQuery(page);
      const subscriberRes = await fetchSubscribers(params);
      
      // Handle both new format (data/meta) and legacy format (items/total)
      const items = subscriberRes.data || subscriberRes.items || [];
      const total = subscriberRes.meta?.totalItems || subscriberRes.total || 0;
      
      setSubscribers(items);
      setSubscribersTotal(total);
      setSubscribersPage(page);
      
      // Update URL params
      const newParams = new URLSearchParams(searchParams);
      if (searchQuery) newParams.set('q', searchQuery);
      else newParams.delete('q');
      newParams.set('filter', quickFilter);
      newParams.set('page', String(page));
      newParams.set('sortBy', sortBy);
      newParams.set('sortDir', sortDir);
      setSearchParams(newParams, { replace: true });
      
      // Scroll to top of table
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      console.error(err);
      setError('Unable to load subscribers.');
    } finally {
      setSubscribersLoading(false);
    }
  };

  const loadInitialData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [settingsRes, statsRes, logsRes] = await Promise.all([
        apiFetch<AppSettings>('/api/settings'),
        apiFetch<SubscriberStats>('/api/subscribers/stats'),
        apiFetch<EmailLog[]>('/api/reminders/logs?limit=100'),
      ]);

      const reminder = settingsRes.reminderConfig ?? defaultReminderConfig;
      const template = settingsRes.emailTemplate ?? defaultEmailTemplate;
      const woo = settingsRes.wooSettings ?? defaultWooSettings;
      const whatsapp = settingsRes.adminWhatsApp ?? defaultAdminWhatsApp;

      setReminderConfig(reminder);
      setEmailTemplate(template);
      setWooSettings(woo);
      setAdminWhatsApp(whatsapp);
      setSubscriberStats(statsRes);
      setEmailLogs(logsRes);
      
      // Load subscribers with current filters
      await loadSubscribers();
    } catch (err) {
      console.error(err);
      setError('Failed to load data from server.');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshSubscribersAndStats = async () => {
    try {
      const [statsRes] = await Promise.all([
        apiFetch<SubscriberStats>('/api/subscribers/stats'),
      ]);
      setSubscriberStats(statsRes);
      await loadSubscribers();
    } catch (err) {
      console.error(err);
      setError('Unable to refresh subscribers.');
    }
  };

  const loadSubscribersPage = async (page: number) => {
    await loadSubscribers(page);
  };

  const loadReminderTasks = async () => {
    setIsTasksLoading(true);
    try {
      const tasks = await apiFetch<ReminderTask[]>('/api/reminders/tasks');
      setReminderTasks(tasks);
    } catch (err) {
      console.error(err);
      setError('Failed to load reminder tasks.');
    } finally {
      setIsTasksLoading(false);
    }
  };

  const loadEmailLogs = async () => {
    try {
      const logs = await apiFetch<EmailLog[]>('/api/reminders/logs?limit=100');
      setEmailLogs(logs);
    } catch (err) {
      console.error(err);
      setError('Failed to refresh logs.');
    }
  };

  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    setSuccessMessage(null);
    try {
      const payload = await apiFetch<AppSettings>('/api/settings', {
        method: 'PUT',
        body: JSON.stringify({
          reminderConfig,
          emailTemplate,
          adminWhatsApp,
          wooSettings,
        }),
      });

      setReminderConfig(payload.reminderConfig ?? defaultReminderConfig);
      setEmailTemplate(payload.emailTemplate ?? defaultEmailTemplate);
      setWooSettings(payload.wooSettings ?? defaultWooSettings);
      setAdminWhatsApp(payload.adminWhatsApp ?? defaultAdminWhatsApp);
      setSuccessMessage('Settings saved successfully.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setError('Failed to save settings.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleWooSync = async () => {
    if (!wooSettings.url || !wooSettings.consumerKey || !wooSettings.consumerSecret) {
      setError('Configure WooCommerce credentials before syncing.');
      setActiveTab('integrations');
      return;
    }

    setIsSyncingWoo(true);
    setSyncLog('Syncing with WooCommerce...');
    try {
      const result = await apiFetch<WooSyncResult>('/api/woo/sync', {
        method: 'POST',
      });
      setSyncLog(`Processed ${result.totalOrdersProcessed} orders • Created ${result.created}, Updated ${result.updated}`);
      setSuccessMessage('WooCommerce sync completed.');
      setTimeout(() => setSuccessMessage(null), 4000);
      await refreshSubscribersAndStats();
      await loadReminderTasks();
    } catch (err) {
      console.error(err);
      setSyncLog('WooCommerce sync failed. Check server logs.');
      setError('WooCommerce sync failed.');
    } finally {
      setIsSyncingWoo(false);
      setTimeout(() => setSyncLog(''), 5000);
    }
  };

  const parseImportText = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed) return [] as Partial<Subscriber>[];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed as Partial<Subscriber>[];
      }
    } catch (err) {
      // ignore JSON parse error
    }

    const lines = trimmed.split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) {
      return [];
    }

    const delimiter = lines[0].includes(';') && !lines[0].includes(',') ? ';' : ',';
    const headers = lines[0].split(delimiter).map((header) => header.trim().toLowerCase());

    return lines.slice(1).map((line) => {
      const values = line.split(delimiter).map((value) => value.trim());
      const record: Record<string, string> = {};
      headers.forEach((header, index) => {
        record[header] = values[index] ?? '';
      });
      return record;
    });
  };
  const normalizeImportRecord = (record: Record<string, string>): Partial<Subscriber> => {
    const amountValue = parseFloat(record.amount?.replace(/[^0-9.]/g, '') ?? '0');
    const pointsValue = parseInt(record.points ?? record.pointsremaining ?? '0', 10);
    const start = record.startdate || record.start || record['start date'];
    const end = record.enddate || record.expiry || record.expires || record['end date'];
    const status = record.status?.toUpperCase() as SubscriptionStatus | undefined;

    const toISO = (value?: string) => {
      if (!value) return new Date().toISOString();
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? new Date(value + 'T00:00:00Z').toISOString() : date.toISOString();
    };

    const sanitizeStatus = (value?: SubscriptionStatus) => {
      if (value && ['ACTIVE', 'EXPIRED', 'CANCELLED'].includes(value)) {
        return value;
      }
      return 'ACTIVE';
    };

    return {
      name: record.name || record.fullname || record['full name'] || '',
      email: record.email || record.mail || '',
      phone: record.phone || record['phone number'] || undefined,
      planName: record.plan || record.planname || 'Membership Plan',
      amount: Number.isNaN(amountValue) ? 0 : amountValue,
      currency: record.currency || 'USD',
      pointsRemaining: Number.isNaN(pointsValue) ? 0 : pointsValue,
      startDate: toISO(start),
      endDate: toISO(end),
      paymentLink: record.paymentlink || record.link || undefined,
      status: sanitizeStatus(status),
    };
  };

  const handleImport = async () => {
    setIsImporting(true);
    setError(null);
    try {
      const records = parseImportText(importText);
      const normalized = records
        .map((record) => normalizeImportRecord(record as Record<string, string>))
        .filter((record) => record.name && record.email);

      if (normalized.length === 0) {
        setError('No valid rows detected. Please check your data.');
        setIsImporting(false);
        return;
      }

      await apiFetch<ImportResult>('/api/subscribers/import', {
        method: 'POST',
        body: JSON.stringify({ subscribers: normalized }),
      });

      setShowImportModal(false);
      setImportText('');
      setSuccessMessage('Import successful. Refreshing subscribers...');
      setTimeout(() => setSuccessMessage(null), 4000);
      await refreshSubscribersAndStats();
    } catch (err) {
      console.error(err);
      setError('Import failed. Please verify your CSV/JSON.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleSaveSubscriber = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: subForm.name,
      email: subForm.email,
      phone: subForm.phone || undefined,
      planName: subForm.planName,
      amount: Number(subForm.amount),
      currency: subForm.currency || 'USD',
      pointsRemaining: Number(subForm.pointsRemaining),
      startDate: new Date(subForm.startDate).toISOString(),
      endDate: new Date(subForm.endDate).toISOString(),
      paymentLink: subForm.paymentLink || undefined,
      status: subForm.status,
    };

    try {
      let updatedSubscriber: Subscriber;
      if (editingSub) {
        updatedSubscriber = await apiFetch<Subscriber>(`/api/subscribers/${editingSub.id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        setSubscribers((prev) => prev.map((sub) => (sub.id === updatedSubscriber.id ? updatedSubscriber : sub)));
      } else {
        updatedSubscriber = await apiFetch<Subscriber>('/api/subscribers', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSubscribers((prev) => [...prev, updatedSubscriber]);
      }

      setShowSubModal(false);
      setEditingSub(null);
      setSubForm(initialFormState);
      await refreshSubscribersAndStats();
    } catch (err) {
      console.error(err);
      setError('Failed to save subscriber.');
    }
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
      phone: sub.phone ?? '',
      planName: sub.planName,
      amount: sub.amount,
      currency: sub.currency,
      startDate: sub.startDate.split('T')[0],
      endDate: sub.endDate.split('T')[0],
      pointsRemaining: sub.pointsRemaining,
      paymentLink: sub.paymentLink ?? '',
      status: sub.status,
    });
    setShowSubModal(true);
  };

  const handleDeleteSub = async (id: string) => {
    if (!window.confirm('Delete this subscriber?')) return;
    try {
      await apiFetch<void>(`/api/subscribers/${id}`, { method: 'DELETE' });
      setSubscribers((prev) => prev.filter((sub) => sub.id !== id));
      await refreshSubscribersAndStats();
    } catch (err) {
      console.error(err);
      setError('Failed to delete subscriber.');
    }
  };

  const handleSyncFromWordPress = async () => {
    setIsSyncingFromWordPress(true);
    setError(null);
    setSuccessMessage(null);
    setSyncProgress({ status: 'running', processed: 0, total: 0, created: 0, updated: 0, message: 'Starting sync...' });
    
    try {
      // Start sync
      await apiFetch<{ success: boolean; message: string; syncStarted: boolean }>('/api/subscribers/sync-from-artly', {
        method: 'POST',
      });
      
      // Poll for progress
      const pollProgress = async () => {
        // Increased timeout: 30 minutes max (1800 * 1 second) for large syncs
        // This allows for processing thousands of customers
        const maxAttempts = 1800; // 30 minutes max
        let attempts = 0;
        let consecutiveErrors = 0;
        const maxConsecutiveErrors = 5; // Allow up to 5 consecutive errors before giving up
        
        const poll = async () => {
          try {
            const progress = await apiFetch<{
              status: 'running' | 'completed' | 'error' | 'idle';
              processed: number;
              total: number;
              created: number;
              updated: number;
              message: string;
              startTime?: string;
              endTime?: string;
            }>('/api/subscribers/sync-progress');
            
            consecutiveErrors = 0; // Reset error counter on success
            setSyncProgress(progress);
            
            if (progress.status === 'completed') {
              setLastSyncTime(new Date());
              const message = progress.message || `Successfully synced ${progress.created} new and ${progress.updated} existing subscribers from WordPress.`;
              setSuccessMessage(message);
              setTimeout(() => setSuccessMessage(null), 8000);
              
              // Refresh subscribers list
              await refreshSubscribersAndStats();
              
              // Clear progress after 3 seconds
              setTimeout(() => {
                setSyncProgress(null);
              }, 3000);
              
              setIsSyncingFromWordPress(false);
            } else if (progress.status === 'error') {
              setError(progress.message || 'Sync failed');
              setTimeout(() => setError(null), 8000);
              setIsSyncingFromWordPress(false);
              
              // Clear progress after 5 seconds
              setTimeout(() => {
                setSyncProgress(null);
              }, 5000);
            } else if (progress.status === 'running' && attempts < maxAttempts) {
              attempts++;
              // Continue polling even if we've been polling for a while
              // The sync will continue in the background
              setTimeout(poll, 1000); // Poll every second
            } else if (attempts >= maxAttempts) {
              // Don't show error if sync is still running - just stop polling
              // User can refresh the page to see current status
              if (progress.status === 'running') {
                setError('Sync is taking longer than expected. The sync will continue in the background. Please refresh the page to check progress.');
              } else {
                setError('Sync timed out. Please try again.');
              }
              setIsSyncingFromWordPress(false);
              // Don't clear progress - let user see current state
            }
          } catch (err) {
            console.error('Error polling progress:', err);
            consecutiveErrors++;
            
            // Only give up after multiple consecutive errors
            if (consecutiveErrors >= maxConsecutiveErrors) {
              setError('Unable to fetch sync progress. The sync may still be running in the background. Please refresh the page to check status.');
              setIsSyncingFromWordPress(false);
            } else {
              // Retry after a short delay
              setTimeout(poll, 2000);
            }
          }
        };
        
        poll();
      };
      
      pollProgress();
    } catch (err: any) {
      console.error(err);
      const errorMessage = err.message || 'Failed to start sync. Make sure you have synced customers from WordPress first.';
      setError(errorMessage);
      setTimeout(() => setError(null), 8000);
      setIsSyncingFromWordPress(false);
      setSyncProgress(null);
    }
  };

  const handleSendReminder = async (task: ReminderTask) => {
    setSendingTaskId(task.id);
    setError(null);
    try {
      const response = await apiFetch<ReminderSendResponse>('/api/reminders/send', {
        method: 'POST',
        body: JSON.stringify({ taskId: task.id }),
      });

      if (response.success) {
        setReminderTasks((prev) => prev.filter((t) => t.id !== task.id));
        setEmailLogs((prev) => [response.emailLog, ...prev]);
        setSuccessMessage('Reminder sent successfully.');
        setTimeout(() => setSuccessMessage(null), 4000);
      } else {
        setError('Reminder failed to send.');
      }
    } catch (err) {
      console.error(err);
      setError('Reminder failed to send.');
    } finally {
      setSendingTaskId(null);
    }
  };

  const handleSendBatchReminders = async () => {
    if (reminderTasks.length === 0) return;
    setIsBatchSending(true);
    setError(null);
    try {
      const taskIds = reminderTasks.map((task) => task.id);
      await apiFetch<{ total: number; success: number; failed: number }>('/api/reminders/send-batch', {
        method: 'POST',
        body: JSON.stringify({ taskIds }),
      });
      await loadReminderTasks();
      await loadEmailLogs();
      setSuccessMessage('Batch reminders processed.');
      setTimeout(() => setSuccessMessage(null), 4000);
    } catch (err) {
      console.error(err);
      setError('Batch send failed.');
    } finally {
      setIsBatchSending(false);
    }
  };

  const handleGenerateWhatsappSummary = async () => {
    if (reminderTasks.length === 0) return;
    setIsWhatsappLoading(true);
    setError(null);
    try {
      const taskIds = reminderTasks.map((task) => task.id);
      const response = await apiFetch<{ summaryText: string }>('/api/reminders/whatsapp-summary', {
        method: 'POST',
        body: JSON.stringify({ taskIds }),
      });
      setWhatsappSummary(response.summaryText);
    } catch (err) {
      console.error(err);
      setError('Failed to generate WhatsApp summary.');
    } finally {
      setIsWhatsappLoading(false);
    }
  };
  const handlePreviewEmail = (type: 'FIRST' | 'FINAL') => {
    setPreviewLoading(true);
    setPreviewType(type);

    const mockSubscriber = {
      name: 'Alex Customer',
      planName: 'Platinum Membership',
      amount: 99,
      pointsRemaining: 1500,
      endDate: new Date().toISOString(),
      paymentLink: 'https://your-site.com/checkout/123',
    };

    const replacements: Record<string, string | number> = {
      '{name}': mockSubscriber.name,
      '{planName}': mockSubscriber.planName,
      '{amount}': mockSubscriber.amount,
      '{points}': mockSubscriber.pointsRemaining,
      '{daysLeft}': type === 'FIRST' ? reminderConfig.firstReminderDays : reminderConfig.finalReminderDays,
      '{paymentLink}': mockSubscriber.paymentLink,
    };

    let content = emailTemplate.bodyTemplate;
    Object.entries(replacements).forEach(([token, value]) => {
      const regex = new RegExp(token, 'gi');
      content = content.replace(regex, String(value));
    });

    setPreviewContent(content);
    setTimeout(() => setPreviewLoading(false), 300);
  };

  const insertAtCursor = (text: string) => {
    const textarea = editorRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentValue = emailTemplate.bodyTemplate;
    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
    setEmailTemplate({ ...emailTemplate, bodyTemplate: newValue });
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + text.length, start + text.length);
    }, 0);
  };

  const formatText = (format: 'bold' | 'italic' | 'link') => {
    if (format === 'bold') insertAtCursor('**text**');
    if (format === 'italic') insertAtCursor('*text*');
    if (format === 'link') insertAtCursor('[text](url)');
  };

  const handleExportData = () => {
    const dataStr = JSON.stringify(subscribers, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'renewalflow_backup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const estimatedRevenue = useMemo(
    () => subscribers.filter((sub) => sub.status === 'ACTIVE').reduce((acc, sub) => acc + sub.amount, 0),
    [subscribers]
  );

  const revenueByPlan = useMemo(() => {
    const map = new Map<string, number>();
    subscribers.forEach((sub) => {
      const current = map.get(sub.planName) ?? 0;
      map.set(sub.planName, current + sub.amount);
    });
    return Array.from(map.entries()).map(([name, amt]) => ({ name, amt }));
  }, [subscribers]);

  return (
    <div className="flex min-h-screen bg-gray-50 font-sans overflow-hidden">
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
          <NavItem id="action" label="Action Center" icon="fa-bolt" badge={reminderTasks.length || undefined} activeTab={activeTab} onSelect={setActiveTab} />
          <NavItem id="overview" label="Overview" icon="fa-chart-pie" activeTab={activeTab} onSelect={setActiveTab} />
          <NavItem id="subscribers" label="Subscribers" icon="fa-users" activeTab={activeTab} onSelect={setActiveTab} />
          <NavItem id="logs" label="Email Logs" icon="fa-history" activeTab={activeTab} onSelect={setActiveTab} />
          <NavItem id="integrations" label="Integrations" icon="fa-plug" activeTab={activeTab} onSelect={setActiveTab} />
          <NavItem id="settings" label="Settings" icon="fa-cog" activeTab={activeTab} onSelect={setActiveTab} />
        </nav>

        <div className="p-6 bg-black/20 backdrop-blur-sm border-t border-gray-800">
          <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Admin WhatsApp</label>
          <input
            type="text"
            placeholder="+1234567890"
            className="w-full bg-surface text-sm p-3 rounded-lg border border-gray-700 mb-4 text-white placeholder-gray-600 focus:border-primary focus:ring-1 focus:ring-primary outline-none transition-all"
            value={adminWhatsApp.phoneNumber}
            onChange={(e) => setAdminWhatsApp({ phoneNumber: e.target.value })}
          />
          <button onClick={handleLogout} className="w-full text-sm text-gray-400 hover:text-white flex items-center justify-center gap-2 p-2 rounded-lg hover:bg-gray-800 transition-colors">
            <i className="fas fa-sign-out-alt"></i> Logout
          </button>
        </div>
      </aside>

      <main className="flex-1 p-8 overflow-y-auto ml-72 bg-gradient-to-br from-gray-50 via-gray-50 to-indigo-50/30 min-h-screen relative">
        {(isLoading || error || successMessage) && (
          <div className="mb-6 space-y-3">
            {isLoading && (
              <div className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-3 rounded-xl shadow-sm">
                <i className="fas fa-spinner fa-spin"></i> Loading dashboard...
              </div>
            )}
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl shadow-sm animate-fade-in-up">
                <i className="fas fa-exclamation-triangle text-red-500"></i> 
                <span className="font-medium">{error}</span>
              </div>
            )}
            {successMessage && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl shadow-sm animate-fade-in-up">
                <i className="fas fa-check-circle text-green-500"></i> 
                <span className="font-medium">{successMessage}</span>
              </div>
            )}
            {isSyncingFromWordPress && activeTab === 'subscribers' && (
              <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-xl shadow-sm animate-pulse">
                <i className="fas fa-spinner fa-spin text-blue-500"></i> 
                <span className="font-medium">Syncing subscribers from WordPress... Please wait.</span>
              </div>
            )}
          </div>
        )}

        {activeTab !== 'action' && activeTab !== 'integrations' && (
          <div className="fixed top-6 right-8 z-30">
            <button
              onClick={handleWooSync}
              disabled={isSyncingWoo}
              className="bg-white text-gray-700 border border-gray-200 px-4 py-2 rounded-xl shadow-md hover:bg-gray-50 text-sm font-bold flex items-center gap-2"
            >
              {isSyncingWoo ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync-alt text-primary"></i>}
              Sync WooCommerce
            </button>
          </div>
        )}

        {activeTab === 'action' && (
          <ActionCenter
            reminderTasks={reminderTasks}
            reminderConfig={reminderConfig}
            isTasksLoading={isTasksLoading}
            sendingTaskId={sendingTaskId}
            isBatchSending={isBatchSending}
            isWhatsappLoading={isWhatsappLoading}
            whatsappSummary={whatsappSummary}
            onSendReminder={handleSendReminder}
            onBatchSend={handleSendBatchReminders}
            onGenerateWhatsapp={handleGenerateWhatsappSummary}
          />
        )}

        {activeTab === 'overview' && (
          <OverviewTab
            estimatedRevenue={estimatedRevenue}
            subscriberStats={subscriberStats}
            reminderConfig={reminderConfig}
            revenueByPlan={revenueByPlan}
          />
        )}

        {activeTab === 'subscribers' && (
          <SubscribersTab
            subscribers={subscribers}
            reminderConfig={reminderConfig}
            onAdd={openAddModal}
            onImport={() => setShowImportModal(true)}
            onSyncFromWordPress={handleSyncFromWordPress}
            isSyncingFromWordPress={isSyncingFromWordPress}
            syncProgress={syncProgress}
            lastSyncTime={lastSyncTime}
            onEdit={openEditModal}
            onDelete={handleDeleteSub}
            total={subscribersTotal}
            currentPage={subscribersPage}
            perPage={subscribersPerPage}
            onPageChange={loadSubscribersPage}
            isLoading={subscribersLoading}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            quickFilter={quickFilter}
            onQuickFilterChange={setQuickFilter}
            sortBy={sortBy}
            sortDir={sortDir}
            onSortChange={(by, dir) => {
              setSortBy(by);
              setSortDir(dir);
            }}
          />
        )}

        {activeTab === 'logs' && <LogsTab emailLogs={emailLogs} onRefresh={loadEmailLogs} />}

        {activeTab === 'integrations' && (
          <IntegrationsTab
            wooSettings={wooSettings}
            syncLog={syncLog}
            isSyncing={isSyncingWoo}
            onWooSettingsChange={setWooSettings}
            onWooSync={handleWooSync}
            emailTemplate={emailTemplate}
            onSaveSettings={handleSaveSettings}
            isSavingSettings={isSavingSettings}
            websiteConnections={websiteConnections}
            isLoadingConnections={isLoadingConnections}
            newWebsiteUrl={newWebsiteUrl}
            setNewWebsiteUrl={setNewWebsiteUrl}
            onCreateConnection={handleCreateWebsiteConnection}
            isCreatingConnection={isCreatingConnection}
            onRegenerateKey={handleRegenerateApiKey}
            onDeleteConnection={handleDeleteConnection}
            onCopyApiKey={handleCopyApiKey}
            copiedApiKey={copiedApiKey}
          />
        )}

        {activeTab === 'settings' && (
          <SettingsTab
            reminderConfig={reminderConfig}
            setReminderConfig={setReminderConfig}
            emailTemplate={emailTemplate}
            setEmailTemplate={setEmailTemplate}
            previewContent={previewContent}
            previewType={previewType}
            previewLoading={previewLoading}
            onPreview={handlePreviewEmail}
            formatText={formatText}
            insertAtCursor={insertAtCursor}
            editorRef={editorRef}
            onExport={handleExportData}
            onSave={handleSaveSettings}
            isSaving={isSavingSettings}
          />
        )}
      </main>

      {showImportModal && (
        <ImportModal
          importText={importText}
          setImportText={setImportText}
          onClose={() => setShowImportModal(false)}
          onImport={handleImport}
          isImporting={isImporting}
        />
      )}

      {showSubModal && (
        <SubscriberModal
          subForm={subForm}
          setSubForm={setSubForm}
          editingSub={editingSub}
          onClose={() => setShowSubModal(false)}
          onSubmit={handleSaveSubscriber}
        />
      )}
    </div>
  );
};
interface NavItemProps {
  id: 'overview' | 'subscribers' | 'action' | 'settings' | 'integrations' | 'logs';
  label: string;
  icon: string;
  activeTab: string;
  onSelect: (tab: NavItemProps['id']) => void;
  badge?: number;
}

const NavItem: React.FC<NavItemProps> = ({ id, label, icon, activeTab, onSelect, badge }) => (
  <button
    onClick={() => onSelect(id)}
    className={`w-full text-left px-4 py-3 rounded-xl transition-all duration-300 flex items-center gap-3 mb-1 ${
      activeTab === id
        ? 'bg-gradient-to-r from-primary to-indigo-600 text-white shadow-lg shadow-indigo-500/30'
        : 'text-gray-400 hover:bg-surface hover:text-white'
    }`}
  >
    <i className={`fas ${icon} w-6 text-center text-lg`}></i>
    <span className="font-medium">{label}</span>
    {badge ? <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full ml-auto animate-pulse">{badge}</span> : null}
  </button>
);

const ActionCenter = ({
  reminderTasks,
  reminderConfig,
  isTasksLoading,
  sendingTaskId,
  isBatchSending,
  isWhatsappLoading,
  whatsappSummary,
  onSendReminder,
  onBatchSend,
  onGenerateWhatsapp,
}: {
  reminderTasks: ReminderTask[];
  reminderConfig: ReminderConfig;
  isTasksLoading: boolean;
  sendingTaskId: string | null;
  isBatchSending: boolean;
  isWhatsappLoading: boolean;
  whatsappSummary: string;
  onSendReminder: (task: ReminderTask) => void;
  onBatchSend: () => void;
  onGenerateWhatsapp: () => void;
}) => (
  <div className="max-w-5xl mx-auto animate-fade-in-up">
    <div className="flex justify-between items-end mb-10">
      <div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-2 tracking-tight">Action Center</h1>
        <p className="text-lg text-gray-500">
          You have <span className="font-bold text-primary">{reminderTasks.length}</span> reminder tasks requiring attention.
        </p>
      </div>
      <div className="flex gap-3">
        <button
          onClick={onGenerateWhatsapp}
          disabled={isWhatsappLoading || reminderTasks.length === 0}
          className="bg-[#25D366] text-white px-6 py-3 rounded-xl hover:bg-[#128C7E] flex items-center gap-2 shadow-lg shadow-green-200 transition-all transform hover:-translate-y-1 font-bold"
        >
          {isWhatsappLoading ? <i className="fas fa-spinner fa-spin"></i> : <i className="fab fa-whatsapp text-xl"></i>}
          WhatsApp Summary
        </button>
        <button
          onClick={onBatchSend}
          disabled={isBatchSending || reminderTasks.length === 0}
          className="bg-dark text-white px-6 py-3 rounded-xl hover:bg-black flex items-center gap-2 shadow-lg shadow-gray-300 transition-all font-bold"
        >
          {isBatchSending ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
          Send All
        </button>
      </div>
    </div>

    {isTasksLoading ? (
      <div className="bg-white p-16 rounded-2xl shadow-xl text-center border border-gray-100">
        <i className="fas fa-spinner fa-spin text-4xl text-primary mb-4"></i>
        <p className="text-gray-500">Loading reminder tasks...</p>
      </div>
    ) : reminderTasks.length === 0 ? (
      <div className="bg-white p-16 rounded-2xl shadow-xl text-center border border-gray-100 flex flex-col items-center justify-center animate-pulse-slow">
        <div className="w-24 h-24 bg-green-50 text-green-500 rounded-full flex items-center justify-center mb-6 text-4xl shadow-sm">
          <i className="fas fa-check"></i>
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">All Caught Up!</h3>
        <p className="text-gray-500 max-w-md mx-auto">
          No subscriptions match the {reminderConfig.firstReminderDays}-day or {reminderConfig.finalReminderDays}-day reminder windows.
        </p>
      </div>
    ) : (
      <div className="space-y-6">
        {reminderTasks.map((task) => (
          <div key={task.id} className="bg-white rounded-2xl shadow-lg shadow-gray-200/50 border border-gray-100 overflow-hidden hover:shadow-xl transition-all duration-300 transform hover:-translate-y-0.5">
            <div className="p-6 border-b border-gray-50 flex justify-between items-start bg-gradient-to-r from-white to-gray-50">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="text-xl font-bold text-gray-900">{task.subscriber?.name || 'Subscriber'}</h3>
                  <span className={`px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide shadow-sm ${
                    task.type === 'FIRST_REMINDER' ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' : 'bg-red-100 text-red-700 border border-red-200'
                  }`}>
                    {task.daysUntilExpiry} {task.daysUntilExpiry === 1 ? 'Day' : 'Days'} Left
                  </span>
                </div>
                <div className="text-sm text-gray-600 flex items-center gap-4 flex-wrap">
                  <span className="bg-gray-100 px-2 py-1 rounded text-gray-600">
                    <i className="fas fa-box mr-1"></i> {task.subscriber?.planName} (${task.subscriber?.amount})
                  </span>
                  <span className="text-indigo-600 font-bold flex items-center gap-1 bg-indigo-50 px-2 py-1 rounded border border-indigo-100">
                    <i className="fas fa-coins"></i> {task.subscriber?.pointsRemaining} Points at risk
                  </span>
                  {task.reason && <span className="text-xs text-gray-400">{task.reason}</span>}
                </div>
                {task.subscriber?.paymentLink && (
                  <div className="mt-2 text-xs text-green-600 flex items-center gap-1">
                    <i className="fas fa-link"></i> Payment Link Ready
                  </div>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => onSendReminder(task)}
                  disabled={sendingTaskId === task.id}
                  className="bg-dark text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-black flex items-center gap-2 shadow-lg shadow-gray-300 transition-all active:scale-95"
                >
                  {sendingTaskId === task.id ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                  Send & Log
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    )}

    {whatsappSummary && (
      <div className="mt-10 bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
            <i className="fab fa-whatsapp text-green-500"></i> Summary Ready
          </h3>
          <button onClick={() => navigator.clipboard.writeText(whatsappSummary)} className="text-sm font-bold text-primary hover:underline">
            Copy
          </button>
        </div>
        <textarea className="w-full h-32 p-4 bg-gray-50 border border-gray-200 rounded-xl text-sm" readOnly value={whatsappSummary}></textarea>
      </div>
    )}
  </div>
);
const OverviewTab = ({
  estimatedRevenue,
  subscriberStats,
  reminderConfig,
  revenueByPlan,
}: {
  estimatedRevenue: number;
  subscriberStats: SubscriberStats | null;
  reminderConfig: ReminderConfig;
  revenueByPlan: { name: string; amt: number }[];
}) => (
  <div className="max-w-6xl mx-auto animate-fade-in-up">
    <h1 className="text-4xl font-extrabold text-gray-900 mb-8 tracking-tight">Performance Overview</h1>
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
      <StatCard label="Est. Monthly Revenue" value={`$${estimatedRevenue.toLocaleString()}`} icon="fa-dollar-sign" color="text-primary" />
      <StatCard label="Active Subscribers" value={String(subscriberStats?.totalActive ?? 0)} icon="fa-users" color="text-secondary" />
      <StatCard label="Expiring Soon" value={String(subscriberStats?.expiringSoonCount ?? 0)} icon="fa-exclamation-circle" color="text-yellow-500" />
    </div>

    <div className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 h-96">
      <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
        <i className="fas fa-chart-bar text-primary"></i> Revenue Distribution
      </h3>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={revenueByPlan.length ? revenueByPlan : [{ name: 'Plan', amt: estimatedRevenue }]}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f3f4f6" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#9CA3AF' }} />
          <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `$${value}`} tick={{ fill: '#9CA3AF' }} />
          <Tooltip cursor={{ fill: '#f9fafb' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1)' }} />
          <Bar dataKey="amt" fill="#4F46E5" radius={[6, 6, 0, 0]} barSize={60} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  </div>
);

const StatCard = ({ label, value, icon, color }: { label: string; value: string; icon: string; color: string }) => (
  <div className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 relative overflow-hidden">
    <div className="absolute top-0 right-0 p-4 opacity-10">
      <i className={`fas ${icon} text-8xl ${color}`}></i>
    </div>
    <p className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-2">{label}</p>
    <p className="text-4xl font-extrabold text-gray-900">{value}</p>
  </div>
);

const SubscribersTab = ({
  subscribers,
  reminderConfig,
  onAdd,
  onImport,
  onSyncFromWordPress,
  isSyncingFromWordPress,
  syncProgress,
  lastSyncTime,
  onEdit,
  onDelete,
  total,
  currentPage,
  perPage,
  onPageChange,
  isLoading,
  searchQuery,
  onSearchChange,
  quickFilter,
  onQuickFilterChange,
  sortBy,
  sortDir,
  onSortChange,
}: {
  subscribers: Subscriber[];
  reminderConfig: ReminderConfig;
  onAdd: () => void;
  onImport: () => void;
  onSyncFromWordPress: () => void;
  isSyncingFromWordPress: boolean;
  syncProgress: {
    status: 'running' | 'completed' | 'error' | 'idle';
    processed: number;
    total: number;
    created: number;
    updated: number;
    message: string;
    startTime?: string;
    endTime?: string;
  } | null;
  lastSyncTime: Date | null;
  onEdit: (sub: Subscriber) => void;
  onDelete: (id: string) => void;
  total: number;
  currentPage: number;
  perPage: number;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  quickFilter?: 'all' | 'active' | 'expiring_7' | 'expiring_30' | 'overdue';
  onQuickFilterChange?: (filter: 'all' | 'active' | 'expiring_7' | 'expiring_30' | 'overdue') => void;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
  onSortChange?: (by: string, dir: 'asc' | 'desc') => void;
}) => {
  const totalPages = Math.ceil(total / perPage);
  const startItem = (currentPage - 1) * perPage + 1;
  const endItem = Math.min(currentPage * perPage, total);

  return (
  <div className="max-w-7xl mx-auto animate-fade-in-up">
    <div className="flex justify-between items-center mb-6">
      <div>
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Subscribers ({total})</h1>
        {lastSyncTime && !isSyncingFromWordPress && (
          <div className="mt-2 text-sm text-gray-500 flex items-center gap-2">
            <i className="fas fa-clock"></i>
            <span>Last synced: {lastSyncTime.toLocaleString()}</span>
          </div>
        )}
      </div>
      <div className="flex gap-3">
        <button 
          onClick={onSyncFromWordPress} 
          disabled={isSyncingFromWordPress}
          className={`px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 font-bold transition-all ${
            isSyncingFromWordPress
              ? 'bg-indigo-400 text-white cursor-wait shadow-indigo-400/30'
              : 'bg-primary text-white hover:bg-indigo-600 shadow-primary/30 transform hover:-translate-y-1'
          } disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none`}
        >
          {isSyncingFromWordPress ? (
            <>
              <i className="fas fa-spinner fa-spin text-lg"></i> 
              <span>Syncing from WordPress...</span>
            </>
          ) : (
            <>
              <i className="fas fa-sync-alt"></i> 
              <span>Sync from WordPress</span>
            </>
          )}
        </button>
        <button onClick={onAdd} className="bg-white border border-gray-200 text-gray-700 px-6 py-3 rounded-xl hover:bg-gray-50 shadow-sm flex items-center gap-2 font-bold transition-all">
          <i className="fas fa-plus"></i> Add Manually
        </button>
        <button onClick={onImport} className="bg-dark text-white px-6 py-3 rounded-xl hover:bg-gray-800 shadow-lg shadow-gray-300 flex items-center gap-2 font-bold transition-all transform hover:-translate-y-1">
          <i className="fas fa-file-import"></i> Import CSV
        </button>
      </div>
    </div>

    {/* Search and Filters Section */}
    <div className="mb-6 space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <label htmlFor="subscriber-search" className="sr-only">Search subscribers</label>
        <div className="relative">
          <i className="fas fa-search absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
          <input
            id="subscriber-search"
            type="text"
            placeholder="Search by name, email, domain, Woo user ID..."
            value={searchQuery || ''}
            onChange={(e) => onSearchChange?.(e.target.value)}
            className="w-full pl-12 pr-12 py-3 border border-gray-300 rounded-xl shadow-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange?.('')}
              className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              aria-label="Clear search"
            >
              <i className="fas fa-times"></i>
            </button>
          )}
        </div>
      </div>

      {/* Quick Filter Chips and Sort */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-700">Quick filters:</span>
          {(['all', 'active', 'expiring_7', 'expiring_30', 'overdue'] as const).map((filter) => {
            const labels: Record<typeof filter, string> = {
              all: 'All',
              active: 'Active',
              expiring_7: 'Expiring in 7 days',
              expiring_30: 'Expiring in 30 days',
              overdue: 'Overdue',
            };
            const isActive = quickFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => onQuickFilterChange?.(filter)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-primary text-white shadow-md'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                {labels[filter]}
              </button>
            );
          })}
        </div>

        {/* Sort Controls */}
        <div className="flex items-center gap-2">
          <label htmlFor="sort-by" className="text-sm font-semibold text-gray-700">Sort by:</label>
          <select
            id="sort-by"
            value={sortBy || 'endDate'}
            onChange={(e) => onSortChange?.(e.target.value, sortDir || 'asc')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
          >
            <option value="endDate">Next Renewal</option>
            <option value="createdAt">Created At</option>
            <option value="lastPurchaseDate">Last Purchase</option>
            <option value="lastNotifiedAt">Last Email Sent</option>
            <option value="pointsRemaining">Points</option>
            <option value="amount">Amount</option>
          </select>
          <button
            onClick={() => onSortChange?.(sortBy || 'endDate', sortDir === 'asc' ? 'desc' : 'asc')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition-colors"
            title={sortDir === 'asc' ? 'Sort descending' : 'Sort ascending'}
          >
            <i className={`fas fa-sort-${sortDir === 'asc' ? 'up' : 'down'}`}></i>
          </button>
        </div>
      </div>
    </div>
    
    {/* Progress Indicator */}
    {syncProgress && syncProgress.status !== 'idle' && (
      <div className="mb-8 bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 p-6 animate-fade-in-up">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {syncProgress.status === 'running' && (
              <i className="fas fa-spinner fa-spin text-primary text-xl"></i>
            )}
            {syncProgress.status === 'completed' && (
              <i className="fas fa-check-circle text-green-500 text-xl"></i>
            )}
            {syncProgress.status === 'error' && (
              <i className="fas fa-exclamation-circle text-red-500 text-xl"></i>
            )}
            <div>
              <h3 className="font-bold text-gray-900 text-lg">
                {syncProgress.status === 'running' && 'Syncing from WordPress...'}
                {syncProgress.status === 'completed' && 'Sync Completed!'}
                {syncProgress.status === 'error' && 'Sync Failed'}
              </h3>
              <p className="text-sm text-gray-600">{syncProgress.message}</p>
            </div>
          </div>
          {syncProgress.status === 'running' && syncProgress.startTime && (
            <div className="text-xs text-gray-500">
              Started: {new Date(syncProgress.startTime).toLocaleTimeString()}
            </div>
          )}
        </div>
        
        {/* Progress Bar */}
        {syncProgress.total > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-gray-700">
                Progress: {syncProgress.processed} / {syncProgress.total}
              </span>
              <span className="text-sm font-bold text-primary">
                {Math.round((syncProgress.processed / syncProgress.total) * 100)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden shadow-inner">
              <div 
                className={`h-full rounded-full transition-all duration-300 ease-out ${
                  syncProgress.status === 'completed' 
                    ? 'bg-gradient-to-r from-green-500 to-green-600' 
                    : syncProgress.status === 'error'
                    ? 'bg-gradient-to-r from-red-500 to-red-600'
                    : 'bg-gradient-to-r from-primary to-indigo-600'
                }`}
                style={{ 
                  width: `${Math.min((syncProgress.processed / syncProgress.total) * 100, 100)}%`,
                  transition: 'width 0.5s ease-out'
                }}
              >
                <div className="h-full bg-white/30 animate-pulse"></div>
              </div>
            </div>
          </div>
        )}
        
        {/* Sync Counters */}
        <div className="grid grid-cols-3 gap-4 mt-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1">Total</div>
            <div className="text-2xl font-bold text-blue-700">{syncProgress.total}</div>
            <div className="text-xs text-blue-500">customers</div>
          </div>
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <div className="text-xs font-semibold text-green-600 uppercase tracking-wide mb-1">Created</div>
            <div className="text-2xl font-bold text-green-700">{syncProgress.created}</div>
            <div className="text-xs text-green-500">new subscribers</div>
          </div>
          <div className="bg-purple-50 rounded-xl p-4 border border-purple-100">
            <div className="text-xs font-semibold text-purple-600 uppercase tracking-wide mb-1">Updated</div>
            <div className="text-2xl font-bold text-purple-700">{syncProgress.updated}</div>
            <div className="text-xs text-purple-500">existing</div>
          </div>
        </div>
        
        {/* Time Display */}
        {syncProgress.endTime && (
          <div className="mt-4 pt-4 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
            <span>
              <i className="fas fa-clock mr-1"></i>
              Completed: {new Date(syncProgress.endTime).toLocaleString()}
            </span>
            {syncProgress.startTime && (
              <span>
                Duration: {Math.round((new Date(syncProgress.endTime).getTime() - new Date(syncProgress.startTime).getTime()) / 1000)}s
              </span>
            )}
          </div>
        )}
      </div>
    )}

    <div className="bg-white rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 text-gray-500 text-xs font-bold uppercase tracking-wider border-b border-gray-100">
              <th className="px-8 py-5">Name</th>
              <th className="px-8 py-5">Status</th>
              <th className="px-8 py-5">Plan / Amount</th>
              <th className="px-8 py-5">Points / Payment</th>
              <th className="px-8 py-5">Last Purchase</th>
              <th className="px-8 py-5">End Date</th>
              <th className="px-8 py-5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              // Loading skeleton
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={`skeleton-${i}`} className="animate-pulse">
                  <td className="px-8 py-5">
                    <div className="h-4 bg-gray-200 rounded w-32 mb-2"></div>
                    <div className="h-3 bg-gray-200 rounded w-48"></div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="h-6 bg-gray-200 rounded-full w-20"></div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="h-4 bg-gray-200 rounded w-16"></div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="h-4 bg-gray-200 rounded w-28"></div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="h-4 bg-gray-200 rounded w-24"></div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="h-8 bg-gray-200 rounded w-16 ml-auto"></div>
                  </td>
                </tr>
              ))
            ) : subscribers.length === 0 ? (
              <tr>
                <td colSpan={7} className="p-12 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <i className="fas fa-folder-open text-6xl text-gray-300 mb-4"></i>
                    <p className="text-lg font-semibold text-gray-700 mb-2">
                      {searchQuery || quickFilter !== 'all' 
                        ? 'No subscribers match your filters' 
                        : 'No subscribers found'}
                    </p>
                    <p className="text-sm text-gray-500 mb-4">
                      {searchQuery || quickFilter !== 'all'
                        ? 'Try adjusting your search or filters'
                        : 'Import a CSV or sync from WordPress to get started'}
                    </p>
                    {(searchQuery || quickFilter !== 'all') && (
                      <button
                        onClick={() => {
                          onSearchChange?.('');
                          onQuickFilterChange?.('all');
                        }}
                        className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-indigo-600 transition-colors text-sm font-medium"
                      >
                        Clear Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              subscribers.map((sub) => {
              const daysUntilExpiry = Math.ceil((new Date(sub.endDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
              const isExpiringSoon = sub.status === 'ACTIVE' && daysUntilExpiry <= reminderConfig.firstReminderDays && daysUntilExpiry > 0;
              
              // Format last purchase date with relative time (similar to WooCommerce Points & Rewards)
              const formatLastPurchase = (date: string | null | undefined) => {
                if (!date) return <span className="text-gray-400 italic">Never purchased</span>;
                const purchaseDate = new Date(date);
                const now = new Date();
                const diffMs = now.getTime() - purchaseDate.getTime();
                const diffMins = Math.floor(diffMs / 60000);
                const diffHours = Math.floor(diffMs / 3600000);
                const diffDays = Math.floor(diffMs / 86400000);
                const diffWeeks = Math.floor(diffDays / 7);
                const diffMonths = Math.floor(diffDays / 30);
                
                let relativeTime = '';
                if (diffMins < 1) {
                  relativeTime = 'just now';
                } else if (diffMins < 60) {
                  relativeTime = `${diffMins} ${diffMins === 1 ? 'minute' : 'minutes'} ago`;
                } else if (diffHours < 24) {
                  relativeTime = `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
                } else if (diffDays < 7) {
                  relativeTime = `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;
                } else if (diffWeeks < 4) {
                  relativeTime = `${diffWeeks} ${diffWeeks === 1 ? 'week' : 'weeks'} ago`;
                } else if (diffMonths < 12) {
                  relativeTime = `${diffMonths} ${diffMonths === 1 ? 'month' : 'months'} ago`;
                } else {
                  relativeTime = purchaseDate.toLocaleDateString();
                }
                
                return (
                  <div>
                    <div className="text-sm text-gray-600 font-medium">
                      <span className="text-gray-500">Last purchase:</span> {relativeTime}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">{purchaseDate.toLocaleDateString()} {purchaseDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                );
              };
              
              return (
                <tr key={sub.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-8 py-5">
                    <div className="font-bold text-gray-900 text-lg">{sub.name}</div>
                    <div className="text-sm text-gray-500">{sub.email}</div>
                  </td>
                  <td className="px-8 py-5">
                    <div className="flex items-center gap-2">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                        sub.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : sub.status === 'EXPIRED' ? 'bg-gray-100 text-gray-700' : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {statusLabels[sub.status]}
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
                    {sub.planName} <span className="text-gray-400 font-normal">({sub.currency} {sub.amount})</span>
                  </td>
                  <td className="px-8 py-5">
                    <div className="font-mono font-bold text-primary text-lg">{sub.pointsRemaining} pts</div>
                    {sub.paymentLink && (
                      <a href={sub.paymentLink} target="_blank" rel="noreferrer" className="text-xs text-green-600 hover:underline flex items-center gap-1">
                        <i className="fas fa-external-link-alt"></i> Link Set
                      </a>
                    )}
                  </td>
                  <td className="px-8 py-5">
                    {formatLastPurchase((sub as any).lastPurchaseDate)}
                  </td>
                  <td className="px-8 py-5 text-gray-600 text-sm font-medium">{new Date(sub.endDate).toLocaleDateString()}</td>
                  <td className="px-8 py-5 text-right flex justify-end gap-2">
                    <button onClick={() => onEdit(sub)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 hover:bg-blue-100 hover:text-blue-500 transition-all flex items-center justify-center" title="Edit">
                      <i className="fas fa-pen"></i>
                    </button>
                    <button onClick={() => onDelete(sub.id)} className="w-8 h-8 rounded-full bg-gray-100 text-gray-400 hover:bg-red-100 hover:text-red-500 transition-all flex items-center justify-center" title="Delete">
                      <i className="fas fa-trash"></i>
                    </button>
                  </td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Controls */}
      {totalPages > 1 && !isLoading && (
        <div className="px-8 py-6 border-t border-gray-100 bg-gray-50/50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              Showing <span className="font-bold text-gray-900">{startItem}</span> to <span className="font-bold text-gray-900">{endItem}</span> of <span className="font-bold text-gray-900">{total}</span> subscribers
              {searchQuery && (
                <span className="ml-2 text-gray-500">(filtered)</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center gap-2"
              >
                <i className="fas fa-chevron-left"></i>
                Previous
              </button>
              
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 7) {
                    pageNum = i + 1;
                  } else if (currentPage <= 4) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 3) {
                    pageNum = totalPages - 6 + i;
                  } else {
                    pageNum = currentPage - 3 + i;
                  }
                  
                  return (
                    <button
                      key={pageNum}
                      onClick={() => onPageChange(pageNum)}
                      className={`px-4 py-2 rounded-lg font-medium transition-all ${
                        currentPage === pageNum
                          ? 'bg-primary text-white shadow-md'
                          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-all flex items-center gap-2"
              >
                Next
                <i className="fas fa-chevron-right"></i>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  </div>
  );
};
const LogsTab = ({ emailLogs, onRefresh }: { emailLogs: EmailLog[]; onRefresh: () => void }) => (
  <div className="max-w-5xl mx-auto animate-fade-in-up">
    <div className="flex items-center justify-between mb-4">
      <div>
        <h1 className="text-4xl font-extrabold text-gray-900 mb-1 tracking-tight">Email Logs</h1>
        <p className="text-gray-500">History of reminders delivered via Brevo.</p>
      </div>
      <button onClick={onRefresh} className="text-sm font-bold text-primary hover:underline flex items-center gap-2">
        <i className="fas fa-sync"></i> Refresh
      </button>
    </div>

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
              <td className="px-8 py-4 text-sm text-gray-600">{new Date(log.sentAt).toLocaleString()}</td>
              <td className="px-8 py-4">
                <div className="font-bold text-gray-900">{log.subscriber?.name || log.subscriberId}</div>
                <div className="text-xs text-gray-400">{log.subscriber?.email}</div>
              </td>
              <td className="px-8 py-4">
                <span className="text-xs font-bold px-2 py-1 rounded bg-gray-100 text-gray-600">{log.type.replace('_', ' ')}</span>
              </td>
              <td className="px-8 py-4">
                <span className={`text-xs font-bold px-2 py-1 rounded flex items-center gap-1 ${
                  log.success ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  <i className={`fas ${log.success ? 'fa-check-circle' : 'fa-times-circle'}`}></i>
                  {log.success ? 'Sent' : 'Failed'}
                </span>
              </td>
              <td className="px-8 py-4 text-xs text-gray-500 italic truncate max-w-xs">"{log.subject}"</td>
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
);

const IntegrationsTab = ({
  wooSettings,
  syncLog,
  isSyncing,
  onWooSettingsChange,
  onWooSync,
  emailTemplate,
  onSaveSettings,
  isSavingSettings,
  websiteConnections,
  isLoadingConnections,
  newWebsiteUrl,
  setNewWebsiteUrl,
  onCreateConnection,
  isCreatingConnection,
  onRegenerateKey,
  onDeleteConnection,
  onCopyApiKey,
  copiedApiKey,
}: {
  wooSettings: WooSettings;
  syncLog: string;
  isSyncing: boolean;
  onWooSettingsChange: (settings: WooSettings) => void;
  onWooSync: () => void;
  emailTemplate: EmailTemplateConfig;
  onSaveSettings: () => void;
  isSavingSettings: boolean;
  websiteConnections: WebsiteConnection[];
  isLoadingConnections: boolean;
  newWebsiteUrl: string;
  setNewWebsiteUrl: (url: string) => void;
  onCreateConnection: () => void;
  isCreatingConnection: boolean;
  onRegenerateKey: (id: string) => void;
  onDeleteConnection: (id: string) => void;
  onCopyApiKey: (key: string) => void;
  copiedApiKey: string | null;
}) => (
  <div className="max-w-6xl mx-auto animate-fade-in-up space-y-8">
    {/* Website Connection Section */}
    <div>
      <h2 className="text-2xl font-extrabold text-gray-900 mb-4">WordPress Website Integration</h2>
      <div className="bg-white p-8 rounded-2xl shadow-xl shadow-indigo-100 border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5">
          <i className="fab fa-wordpress text-9xl"></i>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-xl flex items-center justify-center text-2xl">
            <i className="fab fa-wordpress"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Connect Your WordPress Site</h3>
            <p className="text-sm text-gray-500">Sync users, points, and charges from your WooCommerce store</p>
          </div>
        </div>

        {websiteConnections.length === 0 ? (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 flex gap-3">
              <i className="fas fa-info-circle mt-1"></i>
              <div>
                <p className="font-semibold mb-1">How it works:</p>
                <ol className="list-decimal list-inside space-y-1 ml-2">
                  <li>Add your WordPress website URL below</li>
                  <li>Copy the generated API key</li>
                  <li>Install the "Artly Reminder Bridge" plugin on your WordPress site</li>
                  <li>Paste the API key in the plugin settings</li>
                  <li>Click "Sync now" in WordPress to start syncing data</li>
                </ol>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="website-url" className="block text-sm font-bold text-gray-900 mb-2">
                  Website URL
                </label>
                <input
                  id="website-url"
                  type="url"
                  placeholder="https://yourwebsite.com"
                  className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
                  value={newWebsiteUrl}
                  onChange={(e) => setNewWebsiteUrl(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && onCreateConnection()}
                />
              </div>
              <button
                onClick={onCreateConnection}
                disabled={isCreatingConnection || !newWebsiteUrl.trim()}
                className="w-full bg-indigo-600 text-white px-4 py-3 rounded-lg font-bold hover:bg-indigo-700 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isCreatingConnection ? (
                  <>
                    <i className="fas fa-spinner fa-spin"></i>
                    Creating Connection...
                  </>
                ) : (
                  <>
                    <i className="fas fa-plus"></i>
                    Connect Website
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {websiteConnections.map((connection) => (
              <div key={connection.id} className="bg-gray-50 p-6 rounded-xl border border-gray-200">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="text-lg font-bold text-gray-900">{connection.websiteUrl}</h4>
                      {connection.isActive ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 text-xs font-semibold rounded-full">
                          <i className="fas fa-check-circle"></i>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                          <i className="fas fa-pause-circle"></i>
                          Inactive
                        </span>
                      )}
                    </div>
                    {connection.lastSyncAt && (
                      <p className="text-sm text-gray-500">
                        Last sync: {new Date(connection.lastSyncAt).toLocaleString()}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => onDeleteConnection(connection.id)}
                    className="text-red-500 hover:text-red-700 p-2"
                    title="Delete connection"
                  >
                    <i className="fas fa-trash"></i>
                  </button>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                      API Key (Copy this to your WordPress plugin)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        readOnly
                        value={connection.apiKey}
                        className="flex-1 p-3 bg-white border border-gray-300 rounded-lg text-sm font-mono text-gray-900"
                      />
                      <button
                        onClick={() => onCopyApiKey(connection.apiKey)}
                        className="px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 font-semibold text-sm flex items-center gap-2"
                        title="Copy API key"
                      >
                        {copiedApiKey === connection.apiKey ? (
                          <>
                            <i className="fas fa-check"></i>
                            Copied!
                          </>
                        ) : (
                          <>
                            <i className="fas fa-copy"></i>
                            Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => onRegenerateKey(connection.id)}
                      className="flex-1 bg-white border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 font-semibold text-sm flex items-center justify-center gap-2"
                    >
                      <i className="fas fa-key"></i>
                      Regenerate Key
                    </button>
                    <div className="bg-blue-50 p-3 rounded-lg text-xs text-blue-800 flex-1">
                      <p className="font-semibold mb-1">Plugin URL:</p>
                      <p className="font-mono break-all text-[10px]">
                        {(() => {
                          try {
                            return (import.meta as any).env?.VITE_API_BASE_URL || 'https://renewalflow-production.up.railway.app';
                          } catch {
                            return 'https://renewalflow-production.up.railway.app';
                          }
                        })()}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {websiteConnections.length > 0 && (
              <button
                onClick={() => setNewWebsiteUrl('')}
                className="w-full border-2 border-dashed border-gray-300 text-gray-500 px-4 py-3 rounded-lg hover:border-indigo-500 hover:text-indigo-500 font-semibold text-sm"
              >
                <i className="fas fa-plus mr-2"></i>
                Add Another Website
              </button>
            )}
          </div>
        )}
      </div>
    </div>

    {/* Existing WooCommerce and Email sections */}
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
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
            <label htmlFor="woo-url" className="block text-sm font-bold text-gray-900 mb-2">
              Website URL
            </label>
            <input
              id="woo-url"
              type="url"
              aria-label="Website URL"
              placeholder="https://yourwebsite.com"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
              value={wooSettings.url}
              onChange={(e) => onWooSettingsChange({ ...wooSettings, url: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="woo-ck" className="block text-sm font-bold text-gray-900 mb-2">
              Consumer Key
            </label>
            <input
              id="woo-ck"
              type="password"
              aria-label="Consumer Key"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
              value={wooSettings.consumerKey}
              onChange={(e) => onWooSettingsChange({ ...wooSettings, consumerKey: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="woo-cs" className="block text-sm font-bold text-gray-900 mb-2">
              Consumer Secret
            </label>
            <input
              id="woo-cs"
              type="password"
              aria-label="Consumer Secret"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
              value={wooSettings.consumerSecret}
              onChange={(e) => onWooSettingsChange({ ...wooSettings, consumerSecret: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="woo-points" className="block text-sm font-bold text-gray-900 mb-2">
              Points per sale
            </label>
            <input
              id="woo-points"
              type="number"
              className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary text-gray-900 placeholder-gray-400"
              value={wooSettings.pointsPerCurrency}
              onChange={(e) => onWooSettingsChange({ ...wooSettings, pointsPerCurrency: parseFloat(e.target.value) || 0 })}
            />
          </div>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={onSaveSettings}
            disabled={isSavingSettings}
            className="bg-white border border-gray-200 px-4 py-2 rounded-lg font-bold hover:bg-gray-50 flex items-center gap-2 text-sm"
          >
            {isSavingSettings ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
            Save Settings
          </button>
          <button onClick={onWooSync} disabled={isSyncing} className="bg-purple-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-purple-700 flex items-center gap-2 text-sm">
            {isSyncing ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-sync"></i>}
            Test Sync
          </button>
        </div>
        {syncLog && (
          <div className={`mt-4 p-3 rounded-lg text-sm font-medium ${syncLog.includes('failed') ? 'bg-red-50 text-red-600' : 'bg-green-50 text-green-600'}`}>
            {syncLog}
          </div>
        )}
      </div>
    </div>

    <div className="col-span-1">
      <h2 className="text-2xl font-extrabold text-gray-900 mb-4">Reminder Delivery</h2>
      <div className="bg-white p-8 rounded-2xl shadow-xl shadow-orange-100 border border-gray-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-6 opacity-5">
          <i className="fas fa-paper-plane text-9xl"></i>
        </div>
        <div className="flex items-center gap-4 mb-6">
          <div className="w-12 h-12 bg-orange-100 text-orange-600 rounded-xl flex items-center justify-center text-2xl">
            <i className="fas fa-envelope-open-text"></i>
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-900">Brevo SMTP</h3>
            <p className="text-sm text-gray-500">Managed by the RenewalFlow backend</p>
          </div>
        </div>
        <div className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-xl text-sm text-blue-800 flex gap-3">
            <i className="fas fa-info-circle mt-1"></i>
            Reminders are generated with your template and sent securely from the server. Update the template in the Settings tab.
          </div>
          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Subject Template</p>
            <p className="text-gray-800 font-medium">{emailTemplate.subjectTemplate || 'Action Required: Subscription Renewal'}</p>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl">
            <p className="text-xs font-bold text-gray-500 uppercase mb-1">Context</p>
            <p className="text-gray-600 text-sm leading-relaxed">{emailTemplate.context}</p>
          </div>
        </div>
      </div>
    </div>
    </div>
  </div>
);
const SettingsTab = ({
  reminderConfig,
  setReminderConfig,
  emailTemplate,
  setEmailTemplate,
  previewContent,
  previewType,
  previewLoading,
  onPreview,
  formatText,
  insertAtCursor,
  editorRef,
  onExport,
  onSave,
  isSaving,
}: {
  reminderConfig: ReminderConfig;
  setReminderConfig: (config: ReminderConfig) => void;
  emailTemplate: EmailTemplateConfig;
  setEmailTemplate: (config: EmailTemplateConfig) => void;
  previewContent: string;
  previewType: 'FIRST' | 'FINAL' | null;
  previewLoading: boolean;
  onPreview: (type: 'FIRST' | 'FINAL') => void;
  formatText: (format: 'bold' | 'italic' | 'link') => void;
  insertAtCursor: (text: string) => void;
  editorRef: React.RefObject<HTMLTextAreaElement>;
  onExport: () => void;
  onSave: () => void;
  isSaving: boolean;
}) => (
  <div className="max-w-5xl mx-auto animate-fade-in-up">
    <div className="flex justify-between items-center mb-8">
      <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Settings</h1>
      <button onClick={onExport} className="text-gray-600 hover:text-primary font-bold flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-gray-100 transition-colors">
        <i className="fas fa-download"></i> Export Data Backup (JSON)
      </button>
    </div>

    <div className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100 mb-8">
      <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
        <i className="far fa-clock text-primary"></i> Notification Timing
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-gray-50 p-6 rounded-xl border border-gray-100">
          <label className="block text-sm font-bold text-gray-700 mb-3">First Reminder (Days before expiry)</label>
          <div className="relative">
            <input
              type="number"
              min="1"
              max="30"
              className="w-full p-4 pl-12 border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary focus:border-primary text-lg font-bold text-gray-800 shadow-sm"
              value={reminderConfig.firstReminderDays}
              onChange={(e) => setReminderConfig({ ...reminderConfig, firstReminderDays: parseInt(e.target.value, 10) || 3 })}
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
              value={reminderConfig.finalReminderDays}
              onChange={(e) => setReminderConfig({ ...reminderConfig, finalReminderDays: parseInt(e.target.value, 10) || 1 })}
            />
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <i className="far fa-bell text-gray-400 text-lg"></i>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div className="bg-white p-8 rounded-2xl shadow-xl shadow-gray-200/50 border border-gray-100">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <i className="fas fa-robot text-purple-500"></i> Email Template
        </h3>
        <button onClick={onSave} disabled={isSaving} className="bg-primary text-white px-4 py-2 rounded-xl hover:bg-indigo-700 font-bold shadow-lg shadow-indigo-200 flex items-center gap-2">
          {isSaving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
          Save Settings
        </button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Subject Template</label>
          <input type="text" className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary" value={emailTemplate.subjectTemplate} onChange={(e) => setEmailTemplate({ ...emailTemplate, subjectTemplate: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Context / Instructions</label>
          <input type="text" className="w-full p-3 border border-gray-200 rounded-lg focus:ring-primary focus:border-primary" value={emailTemplate.context} onChange={(e) => setEmailTemplate({ ...emailTemplate, context: e.target.value })} />
        </div>
      </div>
      <div className="mb-8">
        <label className="block text-sm font-bold text-gray-700 mb-2">Body Template</label>
        <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50 focus-within:ring-2 focus-within:ring-primary">
          <div className="flex flex-wrap items-center gap-2 p-2 border-b border-gray-200 bg-white">
            <div className="flex gap-1 border-r border-gray-200 pr-2">
              <button onClick={() => formatText('bold')} className="p-2 hover:bg-gray-100 rounded text-gray-600 font-bold" title="Bold">
                B
              </button>
              <button onClick={() => formatText('italic')} className="p-2 hover:bg-gray-100 rounded text-gray-600 italic" title="Italic">
                I
              </button>
              <button onClick={() => formatText('link')} className="p-2 hover:bg-gray-100 rounded text-gray-600" title="Link">
                <i className="fas fa-link"></i>
              </button>
            </div>
            <div className="flex gap-2 pl-2">
              <button onClick={() => insertAtCursor('{name}')} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full hover:bg-indigo-100 transition-colors">
                + Name
              </button>
              <button onClick={() => insertAtCursor('{points}')} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full hover:bg-indigo-100 transition-colors">
                + Points
              </button>
              <button onClick={() => insertAtCursor('{daysLeft}')} className="px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full hover:bg-indigo-100 transition-colors">
                + Days Left
              </button>
              <button onClick={() => insertAtCursor('{paymentLink}')} className="px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full hover:bg-green-100 transition-colors">
                + Payment Link
              </button>
            </div>
          </div>
          <textarea
            ref={editorRef}
            className="w-full h-64 p-4 text-sm bg-gray-50 focus:outline-none font-mono leading-relaxed resize-none"
            placeholder="Hi {name}, just a reminder that your {planName} expires in {daysLeft} days..."
            value={emailTemplate.bodyTemplate}
            onChange={(e) => setEmailTemplate({ ...emailTemplate, bodyTemplate: e.target.value })}
          ></textarea>
        </div>
      </div>
      <div className="border-t border-gray-100 pt-6">
        <h4 className="font-bold text-gray-800 mb-4">Preview generated email</h4>
        <div className="flex gap-4 mb-6">
          <button
            onClick={() => onPreview('FIRST')}
            disabled={previewLoading}
            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all transform hover:-translate-y-0.5 shadow-sm ${
              previewType === 'FIRST' ? 'bg-primary text-white shadow-indigo-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {previewLoading && previewType === 'FIRST' && <i className="fas fa-spinner fa-spin"></i>}
            Preview {reminderConfig.firstReminderDays}-Day Email
          </button>
          <button
            onClick={() => onPreview('FINAL')}
            disabled={previewLoading}
            className={`px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all transform hover:-translate-y-0.5 shadow-sm ${
              previewType === 'FINAL' ? 'bg-primary text-white shadow-indigo-200' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {previewLoading && previewType === 'FINAL' && <i className="fas fa-spinner fa-spin"></i>}
            Preview {reminderConfig.finalReminderDays}-Day Email
          </button>
        </div>
        {previewContent ? (
          <div className="border border-gray-200 rounded-xl overflow-hidden shadow-inner">
            <div className="bg-gray-50 px-6 py-3 border-b border-gray-200 flex justify-between items-center">
              <span className="text-xs font-bold text-gray-500 uppercase tracking-wide">Draft Preview</span>
            </div>
            <div className="p-6 bg-white">
              <pre className="whitespace-pre-wrap text-sm text-gray-700 leading-relaxed">{previewContent}</pre>
            </div>
          </div>
        ) : (
          !previewLoading && (
            <div className="text-center py-16 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
              <i className="fas fa-eye text-gray-300 text-5xl mb-4"></i>
              <p className="text-gray-400 font-medium">Select a button above to generate a preview using your custom settings.</p>
            </div>
          )
        )}
      </div>
    </div>
  </div>
);
const ImportModal = ({
  importText,
  setImportText,
  onClose,
  onImport,
  isImporting,
}: {
  importText: string;
  setImportText: (text: string) => void;
  onClose: () => void;
  onImport: () => void;
  isImporting: boolean;
}) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
    <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-8 m-4">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-2xl font-extrabold text-gray-900">Import Subscribers</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>
      <div className="bg-blue-50 p-4 rounded-xl mb-4 flex gap-3 items-start">
        <i className="fas fa-info-circle text-blue-500 mt-1"></i>
        <p className="text-sm text-blue-800">Paste your raw CSV data or JSON below. The backend will structure it and merge duplicates.</p>
      </div>
      <textarea
        className="w-full h-48 p-4 border border-gray-300 rounded-xl mb-6 focus:ring-2 focus:ring-primary focus:border-transparent bg-gray-50 text-sm font-mono"
        placeholder="John Doe, john@email.com, Gold Plan, $50, 2023-12-31, https://stripe.com/..."
        value={importText}
        onChange={(e) => setImportText(e.target.value)}
      ></textarea>
      <div className="flex justify-end gap-3">
        <button onClick={onClose} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">
          Cancel
        </button>
        <button
          onClick={onImport}
          disabled={isImporting}
          className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-indigo-700 flex items-center gap-2 font-bold shadow-lg shadow-indigo-200 transition-transform active:scale-95"
        >
          {isImporting ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-magic"></i>}
          Smart Import
        </button>
      </div>
    </div>
  </div>
);

const SubscriberModal = ({
  subForm,
  setSubForm,
  editingSub,
  onClose,
  onSubmit,
}: {
  subForm: SubscriberFormState;
  setSubForm: (form: SubscriberFormState) => void;
  editingSub: Subscriber | null;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) => (
  <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
    <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full p-8 m-4 overflow-y-auto max-h-[90vh]">
      <div className="flex justify-between items-start mb-6">
        <h3 className="text-2xl font-extrabold text-gray-900">{editingSub ? 'Edit Subscriber' : 'Add New Subscriber'}</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>
      <form onSubmit={onSubmit} className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Full Name</label>
          <input required type="text" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Email</label>
          <input required type="email" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.email} onChange={(e) => setSubForm({ ...subForm, email: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Phone</label>
          <input type="text" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.phone} onChange={(e) => setSubForm({ ...subForm, phone: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Plan Name</label>
          <input required type="text" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.planName} onChange={(e) => setSubForm({ ...subForm, planName: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Amount</label>
          <input required type="number" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.amount} onChange={(e) => setSubForm({ ...subForm, amount: parseFloat(e.target.value) })} />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Currency</label>
          <input type="text" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.currency} onChange={(e) => setSubForm({ ...subForm, currency: e.target.value.toUpperCase() })} />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Start Date</label>
          <input required type="date" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.startDate} onChange={(e) => setSubForm({ ...subForm, startDate: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">End Date</label>
          <input required type="date" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.endDate} onChange={(e) => setSubForm({ ...subForm, endDate: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Points Remaining</label>
          <input required type="number" className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.pointsRemaining} onChange={(e) => setSubForm({ ...subForm, pointsRemaining: parseInt(e.target.value, 10) })} />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Payment Link (Optional)</label>
          <input type="url" placeholder="https://paypal.me/..." className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.paymentLink} onChange={(e) => setSubForm({ ...subForm, paymentLink: e.target.value })} />
        </div>
        <div>
          <label className="block text-sm font-bold text-gray-700 mb-2">Status</label>
          <select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-primary focus:border-primary" value={subForm.status} onChange={(e) => setSubForm({ ...subForm, status: e.target.value as SubscriptionStatus })}>
            <option value="ACTIVE">Active</option>
            <option value="EXPIRED">Expired</option>
            <option value="CANCELLED">Cancelled</option>
          </select>
        </div>
        <div className="md:col-span-2 flex justify-end gap-3 mt-4">
          <button type="button" onClick={onClose} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-100 rounded-xl transition-colors">
            Cancel
          </button>
          <button type="submit" className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-indigo-700 font-bold shadow-lg">
            {editingSub ? 'Save Changes' : 'Add Subscriber'}
          </button>
        </div>
      </form>
    </div>
  </div>
);

export default Dashboard;