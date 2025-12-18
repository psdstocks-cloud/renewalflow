import React, { useState } from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { ReminderConfig, EmailTemplateConfig } from '@/src/types';
import { apiFetch } from '@/src/services/apiClient';

interface AutomationTabProps {
    reminderConfig: ReminderConfig;
    setReminderConfig: (c: ReminderConfig) => void;
    emailTemplate: EmailTemplateConfig;
    setEmailTemplate: (c: EmailTemplateConfig) => void;
    onSave?: () => void;
}

interface TestEmailResponse {
    success: boolean;
    message: string;
    preview?: { subject: string; body: string };
}

export const AutomationTab: React.FC<AutomationTabProps> = ({
    reminderConfig, setReminderConfig, emailTemplate, setEmailTemplate, onSave
}) => {
    const [isGeneratingPreview, setIsGeneratingPreview] = useState(false);
    const [previewContent, setPreviewContent] = useState<{ subject: string; body: string } | null>(null);
    const [testEmail, setTestEmail] = useState('');
    const [isSendingTest, setIsSendingTest] = useState(false);
    const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

    // Generate AI preview
    const handleGeneratePreview = async () => {
        setIsGeneratingPreview(true);
        setPreviewContent(null);
        try {
            const response = await apiFetch<TestEmailResponse>('/api/emails/preview', {
                method: 'POST',
                body: JSON.stringify({
                    template: emailTemplate,
                    // Use sample data for preview
                    subscriberData: {
                        name: 'Ahmed',
                        planName: 'Premium Plan',
                        amount: 299,
                        currency: 'EGP',
                        pointsRemaining: 450,
                        daysUntilExpiry: 3,
                        paymentLink: 'https://example.com/renew'
                    }
                })
            });
            if (response.preview) {
                setPreviewContent(response.preview);
            }
        } catch (error) {
            console.error('Preview generation failed:', error);
        } finally {
            setIsGeneratingPreview(false);
        }
    };

    // Send test email
    const handleSendTest = async () => {
        if (!testEmail) return;
        setIsSendingTest(true);
        setTestResult(null);
        try {
            const response = await apiFetch<TestEmailResponse>('/api/emails/test', {
                method: 'POST',
                body: JSON.stringify({
                    to: testEmail,
                    template: emailTemplate
                })
            });
            setTestResult({ success: response.success, message: response.message });
        } catch (error: any) {
            setTestResult({ success: false, message: error.message || 'Failed to send test email' });
        } finally {
            setIsSendingTest(false);
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-bold text-white mb-1">Automation Rules</h2>
                <p className="text-zinc-400 text-sm">Configure when and how your customers are notified.</p>
            </div>

            {/* Visual Timeline */}
            <Card>
                <h3 className="text-lg font-bold text-white mb-6">Reminder Timeline</h3>
                <div className="relative pl-8 border-l border-white/10 space-y-8">

                    {/* First Reminder */}
                    <div className="relative">
                        <div className="absolute -left-[39px] w-5 h-5 rounded-full bg-zinc-900 border-2 border-violet-500 ring-4 ring-zinc-900"></div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-violet-400">First Reminder</h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-zinc-400">Send</span>
                                    <input
                                        type="number"
                                        className="w-16 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-sm text-center text-white"
                                        value={reminderConfig.firstReminderDays}
                                        onChange={(e) => setReminderConfig({ ...reminderConfig, firstReminderDays: Number(e.target.value) })}
                                    />
                                    <span className="text-xs text-zinc-400">days before expiry</span>
                                </div>
                            </div>
                            <div className="text-sm text-zinc-400">
                                Sends an email warning about upcoming expiration using the template below.
                            </div>
                        </div>
                    </div>

                    {/* Final Reminder */}
                    <div className="relative">
                        <div className="absolute -left-[39px] w-5 h-5 rounded-full bg-zinc-900 border-2 border-rose-500 ring-4 ring-zinc-900"></div>
                        <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                            <div className="flex justify-between items-center mb-3">
                                <h4 className="font-bold text-rose-400">Urgent Reminder</h4>
                                <div className="flex items-center gap-2">
                                    <span className="text-xs text-zinc-400">Send</span>
                                    <input
                                        type="number"
                                        className="w-16 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-sm text-center text-white"
                                        value={reminderConfig.finalReminderDays}
                                        onChange={(e) => setReminderConfig({ ...reminderConfig, finalReminderDays: Number(e.target.value) })}
                                    />
                                    <span className="text-xs text-zinc-400">days before expiry</span>
                                </div>
                            </div>
                            <div className="text-sm text-zinc-400">
                                Sends a high-priority email + WhatsApp message (if enabled).
                            </div>
                        </div>
                    </div>

                    {/* Expiry */}
                    <div className="relative">
                        <div className="absolute -left-[39px] w-5 h-5 rounded-full bg-zinc-700 ring-4 ring-zinc-900"></div>
                        <h4 className="font-bold text-zinc-500 py-1">Subscription Expires</h4>
                    </div>

                </div>
            </Card>

            {/* Email Template Editor */}
            <Card>
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <i className="fas fa-envelope text-violet-400"></i> Email Template
                        </h3>
                        <p className="text-sm text-zinc-400 mt-1">
                            Configure the email content. AI will personalize it for each subscriber.
                        </p>
                    </div>
                </div>

                <div className="grid lg:grid-cols-2 gap-6">
                    {/* Editor Side */}
                    <div className="space-y-4">
                        <Input
                            label="Subject Line"
                            value={emailTemplate.subjectTemplate}
                            onChange={(e) => setEmailTemplate({ ...emailTemplate, subjectTemplate: e.target.value })}
                            placeholder="Your subscription is expiring soon..."
                        />

                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1.5 ml-1">
                                Body Template (variables: {'{name}'}, {'{plan}'}, {'{days}'}, {'{points}'}, {'{link}'})
                            </label>
                            <textarea
                                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-white resize-y focus:outline-none focus:border-violet-500 h-32 text-sm"
                                value={emailTemplate.bodyTemplate}
                                onChange={(e) => setEmailTemplate({ ...emailTemplate, bodyTemplate: e.target.value })}
                                placeholder="Hi {name}, your {plan} subscription expires in {days} days..."
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1.5 ml-1">
                                AI Context (tone, style, special instructions)
                            </label>
                            <textarea
                                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-white resize-y focus:outline-none focus:border-violet-500 h-24 text-sm font-mono"
                                value={emailTemplate.context}
                                onChange={(e) => setEmailTemplate({ ...emailTemplate, context: e.target.value })}
                                placeholder="Keep emails friendly and concise. Mention the renewal benefits..."
                            />
                        </div>

                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                onClick={handleGeneratePreview}
                                disabled={isGeneratingPreview}
                            >
                                {isGeneratingPreview ? (
                                    <><i className="fas fa-spinner fa-spin mr-2"></i>Generating...</>
                                ) : (
                                    <><i className="fas fa-eye mr-2"></i>Preview with AI</>
                                )}
                            </Button>
                        </div>
                    </div>

                    {/* Preview Side */}
                    <div className="bg-white rounded-xl overflow-hidden text-zinc-900 shadow-2xl">
                        <div className="bg-zinc-100 border-b border-zinc-200 p-3 flex items-center gap-2">
                            <div className="flex gap-1.5">
                                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                                <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                                <div className="w-3 h-3 rounded-full bg-green-400"></div>
                            </div>
                            <div className="flex-1 text-center text-xs font-medium text-zinc-500 bg-white mx-4 rounded py-1 truncate">
                                {previewContent?.subject || emailTemplate.subjectTemplate.replace('{name}', 'Ahmed')}
                            </div>
                        </div>
                        <div className="p-6 max-h-80 overflow-y-auto">
                            {previewContent ? (
                                <div
                                    className="prose prose-sm max-w-none"
                                    dangerouslySetInnerHTML={{ __html: previewContent.body }}
                                />
                            ) : (
                                <div className="text-zinc-500 text-center py-8">
                                    <i className="fas fa-magic text-4xl mb-4 text-zinc-300"></i>
                                    <p>Click "Preview with AI" to see how the email will look</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </Card>

            {/* Test Email Section */}
            <Card>
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <i className="fas fa-paper-plane text-cyan-400"></i> Send Test Email
                </h3>
                <div className="flex gap-3 items-end">
                    <div className="flex-1">
                        <Input
                            label="Test Email Address"
                            type="email"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="your@email.com"
                        />
                    </div>
                    <Button
                        onClick={handleSendTest}
                        disabled={isSendingTest || !testEmail}
                    >
                        {isSendingTest ? (
                            <><i className="fas fa-spinner fa-spin mr-2"></i>Sending...</>
                        ) : (
                            <><i className="fas fa-paper-plane mr-2"></i>Send Test</>
                        )}
                    </Button>
                </div>
                {testResult && (
                    <div className={`mt-3 p-3 rounded-lg text-sm ${testResult.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        <i className={`fas ${testResult.success ? 'fa-check-circle' : 'fa-exclamation-circle'} mr-2`}></i>
                        {testResult.message}
                    </div>
                )}
            </Card>

        </div>
    );
};
