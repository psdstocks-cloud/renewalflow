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

... (skipping unmodified lines)

// Subscribers Listing State
const [subPage, setSubPage] = useState(1);
const [subTotal, setSubTotal] = useState(0);
const [searchQuery, setSearchQuery] = useState('');
const [editingSubscriber, setEditingSubscriber] = useState<Subscriber | null>(null);

... (skipping actions)

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