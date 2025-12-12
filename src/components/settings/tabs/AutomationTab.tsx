import React, { useState } from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { ReminderConfig, EmailTemplateConfig } from '@/src/types';

interface AutomationTabProps {
    reminderConfig: ReminderConfig;
    setReminderConfig: (c: ReminderConfig) => void;
    emailTemplate: EmailTemplateConfig;
    setEmailTemplate: (c: EmailTemplateConfig) => void;
}

export const AutomationTab: React.FC<AutomationTabProps> = ({
    reminderConfig, setReminderConfig, emailTemplate, setEmailTemplate
}) => {
    const [activePreview, setActivePreview] = useState('email');

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
                                        className="w-16 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-sm text-center"
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
                                        className="w-16 bg-zinc-900 border border-zinc-700 rounded-md px-2 py-1 text-sm text-center"
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

            {/* Smart Sending */}
            <Card>
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            <i className="fas fa-magic text-amber-400"></i> Smart Sending (AI)
                        </h3>
                        <p className="text-sm text-zinc-400 mt-1">
                            Automatically optimize send times based on when users are most likely to open.
                        </p>
                    </div>
                    <div className="relative inline-block w-12 mr-2 align-middle select-none transition duration-200 ease-in">
                        <input type="checkbox" name="toggle" id="toggle" className="toggle-checkbox absolute block w-6 h-6 rounded-full bg-white border-4 appearance-none cursor-pointer translate-x-6 border-violet-500" />
                        <label htmlFor="toggle" className="toggle-label block overflow-hidden h-6 rounded-full bg-violet-500 cursor-pointer"></label>
                    </div>
                </div>
            </Card>

            {/* Template Editor */}
            <div className="grid lg:grid-cols-2 gap-6">
                <div className="space-y-4">
                    <h3 className="font-bold text-white">Email Content</h3>
                    <Input
                        label="Subject Line"
                        value={emailTemplate.subjectTemplate}
                        onChange={(e) => setEmailTemplate({ ...emailTemplate, subjectTemplate: e.target.value })}
                    />
                    <div>
                        <label className="block text-sm font-medium text-zinc-400 mb-1.5 ml-1">Context for AI</label>
                        <textarea
                            className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 text-white resize-y focus:outline-none focus:border-violet-500 h-32 text-sm font-mono"
                            value={emailTemplate.context}
                            onChange={(e) => setEmailTemplate({ ...emailTemplate, context: e.target.value })}
                            placeholder="Instruct the AI on tone and style..."
                        ></textarea>
                    </div>
                    <Button fullWidth>Save Configuration</Button>
                </div>

                <div className="bg-white rounded-xl overflow-hidden text-zinc-900 shadow-2xl">
                    <div className="bg-zinc-100 border-b border-zinc-200 p-3 flex items-center gap-2">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-red-400"></div>
                            <div className="w-3 h-3 rounded-full bg-amber-400"></div>
                            <div className="w-3 h-3 rounded-full bg-green-400"></div>
                        </div>
                        <div className="flex-1 text-center text-xs font-medium text-zinc-500 bg-white mx-4 rounded py-1">
                            Preview: {emailTemplate.subjectTemplate.replace('{name}', 'Ahmed')}
                        </div>
                    </div>
                    <div className="p-8">
                        <div className="w-12 h-12 rounded bg-violet-600 mb-6 flex items-center justify-center text-white font-bold">L</div>
                        <h1 className="text-2xl font-bold mb-4">Your subscription is ending soon</h1>
                        <p className="text-zinc-600 mb-6 leading-relaxed">
                            Hi Ahmed,<br /><br />
                            We noticed your subscription expires in <b>3 days</b>. You have <b>450 points</b> remaining.
                            Renew now to keep your benefits using the link below.
                        </p>
                        <button className="bg-violet-600 text-white px-6 py-3 rounded-lg font-bold w-full">
                            Renew Subscription
                        </button>
                        <p className="text-xs text-zinc-400 mt-8 text-center">
                            © 2024 RenewalFlow Inc.
                        </p>
                    </div>
                </div>
            </div>

        </div>
    );
};
