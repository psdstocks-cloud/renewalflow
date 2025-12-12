import React from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { ReminderConfig, EmailTemplateConfig, AdminWhatsAppConfig } from '@/src/types';

interface SettingsViewProps {
    reminderConfig: ReminderConfig;
    setReminderConfig: (c: ReminderConfig) => void;
    emailTemplate: EmailTemplateConfig;
    setEmailTemplate: (c: EmailTemplateConfig) => void;
    adminWhatsApp: AdminWhatsAppConfig;
    setAdminWhatsApp: (c: AdminWhatsAppConfig) => void;
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
    onSave,
    isSaving
}) => {
    return (
        <div className="space-y-6 max-w-4xl">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-white">System Settings</h2>
                <Button onClick={onSave} disabled={isSaving}>
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </Button>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                <Card>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <i className="fas fa-clock text-violet-400"></i> Reminder Timing
                    </h3>
                    <div className="space-y-4">
                        <Input
                            label="First Reminder (Days Before)"
                            type="number"
                            value={reminderConfig.firstReminderDays}
                            onChange={(e) => setReminderConfig({ ...reminderConfig, firstReminderDays: Number(e.target.value) })}
                        />
                        <Input
                            label="Final Reminder (Days Before)"
                            type="number"
                            value={reminderConfig.finalReminderDays}
                            onChange={(e) => setReminderConfig({ ...reminderConfig, finalReminderDays: Number(e.target.value) })}
                        />
                    </div>
                </Card>

                <Card>
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <i className="fab fa-whatsapp text-emerald-400"></i> Admin Notifications
                    </h3>
                    <div className="space-y-4">
                        <Input
                            label="Admin Phone Number (WhatsApp)"
                            placeholder="+1234567890"
                            value={adminWhatsApp.phoneNumber}
                            onChange={(e) => setAdminWhatsApp({ ...adminWhatsApp, phoneNumber: e.target.value })}
                        />
                        <p className="text-xs text-zinc-500">
                            You will receive a daily summary of expiring subscriptions at 9:00 AM.
                        </p>
                    </div>
                </Card>
            </div>

            <Card>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <i className="fas fa-envelope text-cyan-400"></i> Email Templates
                </h3>
                <div className="space-y-4">
                    <Input
                        label="Subject Line Template"
                        value={emailTemplate.subjectTemplate}
                        onChange={(e) => setEmailTemplate({ ...emailTemplate, subjectTemplate: e.target.value })}
                    />

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5 ml-1">AI Context & Tone</label>
                        <textarea
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-white resize-y focus:outline-none focus:border-violet-500 h-32"
                            value={emailTemplate.context}
                            onChange={(e) => setEmailTemplate({ ...emailTemplate, context: e.target.value })}
                            placeholder="e.g. Be polite but urgent. Emphasize point loss."
                        ></textarea>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5 ml-1">Fallback Body Template</label>
                        <textarea
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-white resize-y focus:outline-none focus:border-violet-500 h-32"
                            value={emailTemplate.bodyTemplate}
                            onChange={(e) => setEmailTemplate({ ...emailTemplate, bodyTemplate: e.target.value })}
                        ></textarea>
                        <p className="text-xs text-zinc-500 mt-2">
                            Variables: <code className="bg-white/10 px-1 rounded">{'{name}'}</code>, <code className="bg-white/10 px-1 rounded">{'{daysLeft}'}</code>, <code className="bg-white/10 px-1 rounded">{'{points}'}</code>
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
};
