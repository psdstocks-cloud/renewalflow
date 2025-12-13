import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiFetch } from '@/src/services/apiClient';
import { fetchSubscribers } from '@/src/services/subscribersService';
import { useAuth } from '@/src/context/AuthContext';
import { useLanguage } from '@/src/context/LanguageContext';

// Components
import { DashboardLayout } from '@/src/components/layout/DashboardLayout';
import { StatCard } from '@/src/components/dashboard/StatCard';
import { ActionCenter } from '@/src/components/dashboard/ActionCenter';
import { SubscribersView } from '@/src/components/dashboard/SubscribersView';
import { SettingsView } from '@/src/components/dashboard/SettingsView';
import { IntegrationsView } from '@/src/components/dashboard/IntegrationsView';
import { EditSubscriberModal } from '@/src/components/dashboard/EditSubscriberModal';

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
  const [activeTab, setActiveTab] = useState('action');

  // Data State
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [stats, setStats] = useState<SubscriberStats | null>(null);
  const [tasks, setTasks] = useState<ReminderTask[]>([]);
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [connections, setConnections] = useState<WebsiteConnection[]>([]);

  // Settings State
  const [reminderConfig, setReminderConfig] = useState(defaultReminderConfig);
  const [emailTemplate, setEmailTemplate] = useState(defaultEmailTemplate);
  const [wooSettings, setWooSettings] = useState(defaultWooSettings);
  const [adminWhatsApp, setAdminWhatsApp] = useState(defaultAdminWhatsApp);

  // UI State
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncingWoo, setIsSyncingWoo] = useState(false);
  const [syncLog, setSyncLog] = useState('');
  const [sendingTaskId, setSendingTaskId] = useState<string | null>(null);

  const handleDeleteSubscriber = async (id: string) => {
    if (!confirm(t('confirm_delete'))) return;
    try {
      await apiFetch(`/api/subscribers/${id}`, { method: 'DELETE' });
      loadSubscribers(subPage, searchQuery);
    } catch (err) {
      alert('Failed to delete');
    }
  };

... (in render)

        {
  activeTab === 'subscribers' && (
    <>
      <SubscribersView
        subscribers={subscribers}
        isLoading={false}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        page={subPage}
        total={subTotal}
        onPageChange={setSubPage}
        onAddSubscriber={() => { }} // TODO: Add create modal
        onEdit={setEditingSubscriber}
        onDelete={handleDeleteSubscriber}
      />
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
      syncLog={syncLog}
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