import React, { useState, useEffect } from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { apiFetch } from '@/src/services/apiClient';

interface SMTPStatus {
    configured: boolean;
    connected: boolean;
    message: string;
    config?: {
        host: string;
        port: number;
        user: string;
        fromEmail: string;
        fromName: string;
    };
}

export const NotificationsTab: React.FC = () => {
    const [smtpStatus, setSmtpStatus] = useState<SMTPStatus | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isTesting, setIsTesting] = useState(false);
    const [testEmail, setTestEmail] = useState('');
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    useEffect(() => {
        checkSMTPStatus();
    }, []);

    const checkSMTPStatus = async () => {
        try {
            setIsLoading(true);
            const status = await apiFetch<SMTPStatus>('/api/smtp/status');
            setSmtpStatus(status);
            if (status.config?.fromEmail) {
                setTestEmail(status.config.fromEmail);
            }
        } catch (error: any) {
            setSmtpStatus({
                configured: false,
                connected: false,
                message: `Error: ${error.message}`
            });
        } finally {
            setIsLoading(false);
        }
    };

    const sendTestEmail = async () => {
        if (!testEmail) return;

        try {
            setIsTesting(true);
            setTestResult(null);
            const response = await apiFetch<{ success: boolean; message: string }>('/api/smtp/test', {
                method: 'POST',
                body: JSON.stringify({ to: testEmail })
            });
            setTestResult(response);
        } catch (error: any) {
            setTestResult({
                success: false,
                message: error.message
            });
        } finally {
            setIsTesting(false);
        }
    };

    const getStatusIcon = () => {
        if (!smtpStatus) return 'fa-circle-notch fa-spin';
        if (smtpStatus.connected) return 'fa-check-circle text-emerald-400';
        if (smtpStatus.configured) return 'fa-exclamation-circle text-amber-400';
        return 'fa-times-circle text-red-400';
    };

    const getStatusText = () => {
        if (!smtpStatus) return 'Checking...';
        if (smtpStatus.connected) return 'Connected';
        if (smtpStatus.configured) return 'Not Connected';
        return 'Not Configured';
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-white mb-1">Notification Settings</h2>
                <p className="text-zinc-400 text-sm">Configure how emails are sent to your subscribers.</p>
            </div>

            {/* SMTP Status Card */}
            <Card>
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <i className="fas fa-envelope text-violet-400"></i>
                        Email (SMTP)
                    </h3>
                    <div className="flex items-center gap-2">
                        <i className={`fas ${getStatusIcon()}`}></i>
                        <span className={`text-sm font-medium ${smtpStatus?.connected ? 'text-emerald-400' : 'text-zinc-400'}`}>
                            {getStatusText()}
                        </span>
                    </div>
                </div>

                {isLoading ? (
                    <div className="text-zinc-400 text-center py-8">
                        <i className="fas fa-spinner fa-spin text-xl mb-2"></i>
                        <div>Checking SMTP configuration...</div>
                    </div>
                ) : smtpStatus?.configured ? (
                    <>
                        {/* Config Details */}
                        <div className="bg-zinc-800/50 rounded-lg p-4 mb-4 space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Host</span>
                                <span className="text-white font-mono">{smtpStatus.config?.host}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">Port</span>
                                <span className="text-white font-mono">{smtpStatus.config?.port}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">From Email</span>
                                <span className="text-white font-mono">{smtpStatus.config?.fromEmail}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-zinc-400">From Name</span>
                                <span className="text-white">{smtpStatus.config?.fromName}</span>
                            </div>
                        </div>

                        {/* Connection Status */}
                        <div className={`px-4 py-3 rounded-lg mb-4 ${smtpStatus.connected ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-amber-500/10 border border-amber-500/20'}`}>
                            <p className={smtpStatus.connected ? 'text-emerald-400' : 'text-amber-400'}>
                                {smtpStatus.message}
                            </p>
                        </div>

                        {/* Test Email Section */}
                        <div className="border-t border-zinc-700/50 pt-4 mt-4">
                            <h4 className="font-medium text-white mb-3">Send Test Email</h4>
                            <div className="flex gap-2">
                                <Input
                                    placeholder="Enter email address"
                                    value={testEmail}
                                    onChange={(e) => setTestEmail(e.target.value)}
                                    className="flex-1"
                                />
                                <Button
                                    onClick={sendTestEmail}
                                    disabled={isTesting || !testEmail}
                                >
                                    {isTesting ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin mr-2"></i>
                                            Sending...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-paper-plane mr-2"></i>
                                            Send Test
                                        </>
                                    )}
                                </Button>
                            </div>

                            {testResult && (
                                <div className={`mt-3 px-4 py-3 rounded-lg ${testResult.success ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'}`}>
                                    <i className={`fas ${testResult.success ? 'fa-check-circle' : 'fa-times-circle'} mr-2`}></i>
                                    {testResult.message}
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* Not Configured */
                    <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 text-center">
                        <i className="fas fa-exclamation-triangle text-red-400 text-3xl mb-3"></i>
                        <h4 className="text-white font-medium mb-2">SMTP Not Configured</h4>
                        <p className="text-zinc-400 text-sm mb-4">
                            Set the following environment variables on your server to enable email sending:
                        </p>
                        <div className="bg-zinc-900/50 rounded-lg p-3 text-left font-mono text-xs text-zinc-300 space-y-1">
                            <div>SMTP_HOST=<span className="text-amber-400">your-smtp-host</span></div>
                            <div>SMTP_PORT=<span className="text-amber-400">587</span></div>
                            <div>SMTP_USER=<span className="text-amber-400">your-email@domain.com</span></div>
                            <div>SMTP_PASS=<span className="text-amber-400">your-password</span></div>
                            <div>SMTP_FROM_EMAIL=<span className="text-amber-400">noreply@domain.com</span></div>
                            <div>SMTP_FROM_NAME=<span className="text-amber-400">Your Company Name</span></div>
                        </div>
                    </div>
                )}

                <div className="mt-4">
                    <Button variant="ghost" size="sm" onClick={checkSMTPStatus}>
                        <i className="fas fa-sync-alt mr-2"></i>
                        Refresh Status
                    </Button>
                </div>
            </Card>

            {/* WhatsApp Status Card (placeholder) */}
            <Card>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <i className="fab fa-whatsapp text-emerald-400"></i>
                            WhatsApp
                        </h3>
                        <p className="text-sm text-zinc-400 mt-1">
                            Coming soon - Send reminders via WhatsApp
                        </p>
                    </div>
                    <span className="px-3 py-1 text-xs font-medium bg-zinc-700/50 text-zinc-400 rounded-full">
                        Coming Soon
                    </span>
                </div>
            </Card>
        </div>
    );
};
