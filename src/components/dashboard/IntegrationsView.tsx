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
    onBackfillWoo: () => void; // New prop
    isBackfillingWoo: boolean; // New prop
    backfillProgress?: number; // New prop for percentage
    syncProgress?: number; // New prop for sync progress percentage
    syncLog: string;
    onSyncRecent: () => void; // New prop
    isSyncingRecent: boolean; // New prop
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
    onBackfillWoo,
    isBackfillingWoo,
    backfillProgress,
    syncProgress,
    syncLog,
    onSyncRecent,
    isSyncingRecent
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
                            {/* Removed Legacy badge to avoid confusion */}
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
                            <div className="pt-4 flex flex-col gap-3">
                                <div className="flex flex-wrap gap-3">
                                    <Button onClick={onSave} disabled={isSaving}>
                                        {isSaving ? 'Saving...' : 'Save Credentials'}
                                    </Button>
                                    <Button variant="outline" onClick={onSyncWoo} disabled={isSyncingWoo || isBackfillingWoo || isSyncingRecent}>
                                        {isSyncingWoo ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-sync mr-2"></i>}
                                        Sync Now
                                    </Button>
                                    <Button variant="outline" onClick={onSyncRecent} disabled={isSyncingWoo || isBackfillingWoo || isSyncingRecent}>
                                        {isSyncingRecent ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-bolt mr-2 text-yellow-500"></i>}
                                        Fetch Recent Activity
                                    </Button>
                                    <Button variant="secondary" onClick={onBackfillWoo} disabled={isSyncingWoo || isBackfillingWoo || isSyncingRecent}>
                                        {isBackfillingWoo ? <i className="fas fa-spinner fa-spin mr-2"></i> : <i className="fas fa-history mr-2"></i>}
                                        Fetch Deep History
                                    </Button>
                                </div>

                                {isSyncingWoo && syncProgress !== undefined && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-zinc-400">
                                            <span>Progress</span>
                                            <span>{Math.round(syncProgress)}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-zinc-800 rounded overflow-hidden transition-all">
                                            <div
                                                className="h-full bg-violet-500 transition-all duration-300 ease-out"
                                                style={{ width: `${syncProgress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}
                                {isSyncingWoo && syncProgress === undefined && (
                                    <div className="w-full h-1 bg-zinc-800 rounded overflow-hidden">
                                        <div className="h-full bg-violet-500 animate-progress-indeterminate"></div>
                                    </div>
                                )}

                                {isSyncingRecent && (
                                    <div className="w-full h-1 bg-zinc-800 rounded overflow-hidden">
                                        <div className="h-full bg-yellow-500 animate-progress-indeterminate"></div>
                                    </div>
                                )}

                                {isBackfillingWoo && backfillProgress !== undefined && (
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-zinc-400">
                                            <span>Progress</span>
                                            <span>{Math.round(backfillProgress)}%</span>
                                        </div>
                                        <div className="w-full h-2 bg-zinc-800 rounded overflow-hidden transition-all">
                                            <div
                                                className="h-full bg-violet-500 transition-all duration-300 ease-out"
                                                style={{ width: `${backfillProgress}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )}

                                {wooSettings.lastSync && (
                                    <div className="text-xs text-zinc-500 text-center">
                                        Last synced: {new Date(wooSettings.lastSync).toLocaleString()}
                                    </div>
                                )}
                            </div>
                            {syncLog && (
                                <div className={`mt-2 p-3 rounded-lg text-xs font-mono border ${syncLog.startsWith('Error') ? 'bg-red-500/10 text-red-400 border-red-500/20' : 'bg-black/40 text-green-400 border-white/5'}`}>
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
