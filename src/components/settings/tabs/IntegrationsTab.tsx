import React from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { AdminWhatsAppConfig, WooSettings } from '@/src/types';

interface IntegrationsTabProps {
    adminWhatsApp: AdminWhatsAppConfig;
    setAdminWhatsApp: (c: AdminWhatsAppConfig) => void;
    wooSettings: WooSettings;
    setWooSettings: (c: WooSettings) => void;
}

export const IntegrationsTab: React.FC<IntegrationsTabProps> = ({
    adminWhatsApp, setAdminWhatsApp, wooSettings, setWooSettings
}) => {
    return (
        <div className="space-y-6 max-w-4xl">
            <div>
                <h2 className="text-xl font-bold text-white mb-1">Integrations & Connections</h2>
                <p className="text-zinc-400 text-sm">Manage external services connected to RenewalFlow.</p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
                {/* WooCommerce */}
                <Card>
                    <div className="flex items-start justify-between mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 text-xl">
                                <i className="fab fa-wordpress"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-white">WooCommerce</h3>
                                <div className="flex items-center gap-1.5 mt-1">
                                    <div className={`w-2 h-2 rounded-full ${wooSettings.url ? 'bg-emerald-400' : 'bg-red-500'}`}></div>
                                    <span className="text-xs text-zinc-400">{wooSettings.url ? 'Connected' : 'Disconnected'}</span>
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
                    </div>
                    <Button variant="outline" fullWidth>Test Connection</Button>
                </Card>

                {/* WhatsApp */}
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
