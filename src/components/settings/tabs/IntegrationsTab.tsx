import React, { useState } from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { AdminWhatsAppConfig, WooSettings } from '@/src/types';
import { apiFetch } from '@/src/services/apiClient'; // Import your API client

interface IntegrationsTabProps {
    adminWhatsApp: AdminWhatsAppConfig;
    setAdminWhatsApp: (c: AdminWhatsAppConfig) => void;
    wooSettings: WooSettings;
    setWooSettings: (c: WooSettings) => void;
}

export const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
    adminWhatsApp, setAdminWhatsApp, wooSettings, setWooSettings
}) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');

    // 1. Calculate the Webhook URL dynamically based on where the API is hosted
    // This assumes your API URL is set in env vars or defaults to localhost
    const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
    const webhookUrl = `${apiUrl.replace(/\/$/, '')}/api/webhooks/woo/orders`;

    const handleCopyWebhook = () => {
        navigator.clipboard.writeText(webhookUrl);
        setCopySuccess('Copied!');
        setTimeout(() => setCopySuccess(''), 2000);
    };

    const handleForceSync = async () => {
        setIsSyncing(true);
        try {
            // Call the cron endpoint manually as a "Force Sync"
            await apiFetch('/api/cron/daily', { method: 'POST' });
            // Ideally, re-fetch settings here to update the 'lastSync' timestamp
            alert('Sync started successfully!');
        } catch (error) {
            alert('Sync failed check console.');
            console.error(error);
        } finally {
            setIsSyncing(false);
        }
    };

    // Format the last sync time for display
    const lastSyncDate = wooSettings.lastSync ? new Date(wooSettings.lastSync) : null;

    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h2 className="text-xl font-bold text-white mb-1">Integrations & Connections</h2>
                <p className="text-zinc-400 text-sm">Manage external services and view automation status.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* WooCommerce Card */}
                <Card>
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 text-xl">
                                <i className="fab fa-wordpress"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-white">WooCommerce</h3>
                                {/* 2. Display Connection Status & Last Sync */}
                                <div className="flex flex-col mt-1">
                                    <div className="flex items-center gap-1.5">
                                        <div className={`w-2 h-2 rounded-full ${wooSettings.url ? 'bg-emerald-400' : 'bg-red-500'}`}></div>
                                        <span className="text-xs text-zinc-400">{wooSettings.url ? 'Connected' : 'Disconnected'}</span>
                                    </div>
                                    {lastSyncDate && (
                                        <span className="text-[10px] text-zinc-500 mt-0.5">
                                            Last Auto-Sync: {lastSyncDate.toLocaleTimeString()} {lastSyncDate.toLocaleDateString()}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 mb-6">
                        <Input
                            label="Store URL"
                            value={wooSettings.url}
                            onChange={(e) => setWooSettings({ ...wooSettings, url: e.target.value })}
                            placeholder="https://myshop.com"
                        />
                        <div className="grid grid-cols-2 gap-2">
                            <Input
                                label="Consumer Key"
                                type="password"
                                value={wooSettings.consumerKey}
                                onChange={(e) => setWooSettings({ ...wooSettings, consumerKey: e.target.value })}
                            />
                            <Input
                                label="Consumer Secret"
                                type="password"
                                value={wooSettings.consumerSecret}
                                onChange={(e) => setWooSettings({ ...wooSettings, consumerSecret: e.target.value })}
                            />
                        </div>

                        {/* 3. New Section: Webhook Configuration Helper */}
                        <div className="bg-zinc-900/50 p-3 rounded-lg border border-white/5">
                            <label className="text-xs text-zinc-400 font-medium mb-2 block">
                                WordPress Webhook URL (Copy to WooCommerce)
                            </label>
                            <div className="flex gap-2">
                                <code className="flex-1 bg-black/30 text-zinc-300 text-xs p-2 rounded border border-white/5 truncate">
                                    {webhookUrl}
                                </code>
                                <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={handleCopyWebhook}
                                >
                                    {copySuccess || <i className="fas fa-copy" />}
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button variant="outline" className="flex-1">Test Connection</Button>
                        {/* 4. Force Sync Button */}
                        <Button
                            className="flex-1 bg-violet-600 hover:bg-violet-700"
                            onClick={handleForceSync}
                            disabled={isSyncing}
                        >
                            {isSyncing ? <i className="fas fa-spinner fa-spin" /> : 'Force Sync'}
                        </Button>
                    </div>
                </Card>

                {/* WhatsApp Card (Unchanged) */}
                <Card>
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-400 text-xl">
                                <i className="fab fa-whatsapp"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-white">WhatsApp Admin</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className={`w-2 h-2 rounded-full ${adminWhatsApp.phoneNumber ? 'bg-emerald-400' : 'bg-zinc-600'}`}></div>
                                    <span className="text-xs text-zinc-400">{adminWhatsApp.phoneNumber ? 'Active' : 'Inactive'}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-4 mb-6">
                        <p className="text-sm text-zinc-400">
                            Receive daily summaries of expiring subscriptions directly to your phone.
                        </p>
                        <Input
                            label="Admin Phone Number"
                            value={adminWhatsApp.phoneNumber}
                            onChange={(e) => setAdminWhatsApp({ ...adminWhatsApp, phoneNumber: e.target.value })}
                            placeholder="+201xxxxxxxxx"
                        />
                    </div>
                    <Button variant="outline" fullWidth>Send Test Message</Button>
                </Card>
            </div>
        </div>
    );
};
