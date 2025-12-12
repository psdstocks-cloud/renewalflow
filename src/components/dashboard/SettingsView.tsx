import React, { useState } from 'react';
import { ReminderConfig, EmailTemplateConfig, AdminWhatsAppConfig, WooSettings } from '@/src/types';
import { SettingsLayout, SettingsTab } from '@/src/components/settings/SettingsLayout';

// Sub-tabs
import { ProfileTab } from '../settings/tabs/ProfileTab';
import { WorkspaceTab } from '../settings/tabs/WorkspaceTab';
import { AutomationTab } from '../settings/tabs/AutomationTab';
import { IntegrationsTab } from '../settings/tabs/IntegrationsTab';
import { Button } from '@/src/components/ui/Button';

interface SettingsViewProps {
    reminderConfig: ReminderConfig;
    setReminderConfig: (c: ReminderConfig) => void;
    emailTemplate: EmailTemplateConfig;
    setEmailTemplate: (c: EmailTemplateConfig) => void;
    adminWhatsApp: AdminWhatsAppConfig;
    setAdminWhatsApp: (c: AdminWhatsAppConfig) => void;
    wooSettings?: WooSettings;
    setWooSettings?: (c: WooSettings) => void; // Optional for backward compatibility if not passed yet
    onSave: () => void;
    isSaving: boolean;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
    reminderConfig,
    setReminderConfig,
    emailTemplate,
    setEmailTemplate,
    adminWhatsApp,
    setAdminWhatsApp,
    wooSettings = { url: '', consumerKey: '', consumerSecret: '', pointsPerCurrency: 1 },
    setWooSettings = () => { },
    onSave,
    isSaving
}) => {

    // Internal tab state for the settings view
    const [activeTab, setActiveTab] = useState<SettingsTab>('profile');

    return (
        <SettingsLayout activeTab={activeTab} onTabChange={setActiveTab}>
            {/* Global Save Button (floating or top right) */}
            <div className="flex justify-end mb-6">
                <Button onClick={onSave} disabled={isSaving} variant="primary">
                    {isSaving ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-save mr-2"></i>}
                    Save All Changes
                </Button>
            </div>

            {activeTab === 'profile' && <ProfileTab />}

            {activeTab === 'workspace' && <WorkspaceTab />}

            {activeTab === 'automation' && (
                <AutomationTab
                    reminderConfig={reminderConfig}
                    setReminderConfig={setReminderConfig}
                    emailTemplate={emailTemplate}
                    setEmailTemplate={setEmailTemplate}
                />
            )}

            {activeTab === 'integrations' && (
                <IntegrationsTab
                    adminWhatsApp={adminWhatsApp}
                    setAdminWhatsApp={setAdminWhatsApp}
                    wooSettings={wooSettings}
                    setWooSettings={setWooSettings}
                />
            )}
        </SettingsLayout>
    );
};
