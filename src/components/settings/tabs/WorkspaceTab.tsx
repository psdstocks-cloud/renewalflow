import React from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';

export const WorkspaceTab: React.FC = () => {
    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-xl font-bold text-white mb-1">Workspace Settings</h2>
                <p className="text-zinc-400 text-sm">Manage brand identity and support contact info.</p>
            </div>

            <Card>
                <h3 className="text-lg font-bold text-white mb-4">Brand Identity</h3>
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Logo</label>
                        <div className="border-2 border-dashed border-zinc-700 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:bg-white/5 transition-colors cursor-pointer">
                            <i className="fas fa-cloud-upload-alt text-2xl text-zinc-500 mb-2"></i>
                            <p className="text-sm text-zinc-400">Click to upload or drag and drop</p>
                            <p className="text-xs text-zinc-600">SVG, PNG, JPG (max. 2MB)</p>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-zinc-300 mb-2">Brand Color</label>
                        <div className="flex items-center gap-3">
                            <input type="color" className="w-10 h-10 rounded-lg p-0 bg-transparent border-0 cursor-pointer" defaultValue="#8b5cf6" />
                            <span className="text-zinc-400 text-sm">#8b5cf6</span>
                        </div>
                        <p className="text-xs text-zinc-500 mt-1">Used for buttons and highlights in your emails.</p>
                    </div>
                </div>
            </Card>

            <Card>
                <h3 className="text-lg font-bold text-white mb-4">Support Contact</h3>
                <p className="text-sm text-zinc-400 mb-4">
                    When customers reply to automated emails, who should receive them?
                </p>
                <div className="space-y-4">
                    <Input label="Reply-To Email" type="email" placeholder="support@yourcompany.com" />
                    <Input label="Support Phone (WhatsApp)" placeholder="+201000000000" />
                </div>
                <div className="mt-6 flex justify-end">
                    <Button variant="primary">Save Workspace</Button>
                </div>
            </Card>

        </div>
    );
};
