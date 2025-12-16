import React, { useState } from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { AdminWhatsAppConfig, WooSettings, WebsiteConnection } from '@/src/types';
import { apiFetch } from '@/src/services/apiClient';

interface IntegrationsTabProps {
    adminWhatsApp: AdminWhatsAppConfig;
    setAdminWhatsApp: (c: AdminWhatsAppConfig) => void;
    wooSettings: WooSettings;
    setWooSettings: (c: WooSettings) => void;
    // Connections Props
    connections: WebsiteConnection[];
    onCreateConnection: (url: string) => void;
    onDeleteConnection: (id: string) => void;
    onRegenerateKey: (id: string) => void;
}

export const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
    adminWhatsApp, setAdminWhatsApp, wooSettings, setWooSettings,
    connections, onCreateConnection, onDeleteConnection, onRegenerateKey
}) => {
    const [isSyncing, setIsSyncing] = useState(false);
    const [copySuccess, setCopySuccess] = useState('');

    // Connections UI State
    const [newUrl, setNewUrl] = useState('');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(text);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    // 1. Calculate the Webhook URL dynamically
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
            await apiFetch('/api/cron/daily', { method: 'POST' });
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
        <div className="space-y-6 max-w-5xl">
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
                        <Button
                            className="flex-1 bg-violet-600 hover:bg-violet-700"
                            onClick={handleForceSync}
                            disabled={isSyncing}
                        >
                            {isSyncing ? <i className="fas fa-spinner fa-spin" /> : 'Force Sync'}
                        </Button>
                    </div>
                </Card>

                <div className="space-y-6">
                    {/* WhatsApp Card */}
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

                    {/* Website Connections (Plugin) */}
                    <Card>
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <i className="fas fa-plug text-violet-400"></i> Plugin Connections
                        </h3>
                        <p className="text-xs text-zinc-400 mb-4">
                            Generate API keys to connect the RenewalFlow WordPress plugin directly.
                        </p>

                        <div className="flex gap-2 mb-4">
                            <Input
                                placeholder="https://mysite.com"
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                className="mb-0"
                            />
                            <Button onClick={() => { onCreateConnection(newUrl); setNewUrl(''); }} disabled={!newUrl} size="sm">
                                Create
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {connections.map(conn => (
                                <div key={conn.id} className="p-3 rounded-lg bg-zinc-900/50 border border-white/5 hover:border-violet-500/30 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-white text-sm">{conn.websiteUrl}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => onRegenerateKey(conn.id)} className="text-xs text-zinc-500 hover:text-white" title="Regenerate Key">
                                                <i className="fas fa-redo"></i>
                                            </button>
                                            <button onClick={() => onDeleteConnection(conn.id)} className="text-xs text-zinc-500 hover:text-red-400" title="Delete">
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 bg-black/40 p-1.5 rounded border border-white/5">
                                        <code className="text-xs text-zinc-400 font-mono truncate flex-1">{conn.apiKey}</code>
                                        <button onClick={() => copyToClipboard(conn.apiKey)} className="text-zinc-500 hover:text-violet-400">
                                            <i className={`fas ${copiedKey === conn.apiKey ? 'fa-check' : 'fa-copy'}`}></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {connections.length === 0 && (
                                <div className="text-center py-4 text-zinc-600 italic text-sm">No connections yet.</div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
