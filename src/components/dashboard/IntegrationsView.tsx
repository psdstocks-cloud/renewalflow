import React, { useState } from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { WooSettings, WebsiteConnection } from '@/src/types';

interface IntegrationsViewProps {
    wooSettings: WooSettings;
    setWooSettings: (s: WooSettings) => void;
    connections: WebsiteConnection[];
    onCreateConnection: (url: string) => void;
    onDeleteConnection: (id: string) => void;
    onRegenerateKey: (id: string) => void;
    onSave: () => void;
    isSaving: boolean;
    onSyncWoo: () => void;
    isSyncingWoo: boolean;
    syncLog: string;
}

export const IntegrationsView: React.FC<IntegrationsViewProps> = ({
    wooSettings,
    setWooSettings,
    connections,
    onCreateConnection,
    onDeleteConnection,
    onRegenerateKey,
    onSave,
    isSaving,
    onSyncWoo,
    isSyncingWoo,
    syncLog
}) => {
    const [newUrl, setNewUrl] = useState('');
    const [copiedKey, setCopiedKey] = useState<string | null>(null);

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopiedKey(text);
        setTimeout(() => setCopiedKey(null), 2000);
    };

    return (
        <div className="space-y-6 max-w-5xl">
            <div className="grid lg:grid-cols-2 gap-8">
                {/* WooCommerce Direct */}
                <div className="space-y-6">
                    <Card>
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <i className="fab fa-wordpress text-blue-400"></i> WooCommerce API
                            </h3>
                            <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-xs font-bold uppercase">Legacy</span>
                        </div>

                        <div className="space-y-4">
                            <Input
                                label="Store URL"
                                placeholder="https://example.com"
                                value={wooSettings.url}
                                onChange={(e) => setWooSettings({ ...wooSettings, url: e.target.value })}
                            />
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
                            <div className="pt-4 flex gap-3">
                                <Button onClick={onSave} disabled={isSaving}>
                                    {isSaving ? 'Saving...' : 'Save Credentials'}
                                </Button>
                                <Button variant="outline" onClick={onSyncWoo} disabled={isSyncingWoo}>
                                    {isSyncingWoo ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-sync mr-2"></i>}
                                    Test Sync
                                </Button>
                            </div>
                            {syncLog && (
                                <div className="mt-4 p-3 bg-black/40 rounded-lg text-xs font-mono text-zinc-400 border border-white/5">
                                    {syncLog}
                                </div>
                            )}
                        </div>
                    </Card>
                </div>

                {/* Plugin Connections */}
                <div className="space-y-6">
                    <Card>
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <i className="fas fa-plug text-violet-400"></i> Website Connections
                        </h3>
                        <p className="text-sm text-zinc-400 mb-6">
                            Generate API keys to connect the RenewalFlow WordPress plugin directly.
                        </p>

                        <div className="flex gap-2 mb-6">
                            <Input
                                placeholder="https://mysite.com"
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                className="mb-0"
                            />
                            <Button onClick={() => { onCreateConnection(newUrl); setNewUrl(''); }} disabled={!newUrl}>
                                Create
                            </Button>
                        </div>

                        <div className="space-y-3">
                            {connections.map(conn => (
                                <div key={conn.id} className="p-4 rounded-xl bg-zinc-900/50 border border-white/5 hover:border-violet-500/30 transition-all">
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="font-bold text-white">{conn.websiteUrl}</span>
                                        <div className="flex gap-2">
                                            <button onClick={() => onRegenerateKey(conn.id)} className="text-xs text-zinc-500 hover:text-white" title="Regenerate Key">
                                                <i className="fas fa-redo"></i>
                                            </button>
                                            <button onClick={() => onDeleteConnection(conn.id)} className="text-xs text-zinc-500 hover:text-red-400" title="Delete">
                                                <i className="fas fa-trash"></i>
                                            </button>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-white/5">
                                        <code className="text-xs text-zinc-400 font-mono truncate flex-1">{conn.apiKey}</code>
                                        <button onClick={() => copyToClipboard(conn.apiKey)} className="text-zinc-500 hover:text-violet-400">
                                            <i className={`fas ${copiedKey === conn.apiKey ? 'fa-check' : 'fa-copy'}`}></i>
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {connections.length === 0 && (
                                <div className="text-center py-8 text-zinc-600 italic">No connections yet.</div>
                            )}
                        </div>
                    </Card>
                </div>
            </div>
        </div>
    );
};
