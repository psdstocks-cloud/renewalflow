import React from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';

export const ProfileTab: React.FC = () => {
    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h2 className="text-xl font-bold text-white mb-1">Your Profile</h2>
                <p className="text-zinc-400 text-sm">Manage your personal information and security.</p>
            </div>

            <div className="flex items-center gap-4 mb-8">
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-3xl font-bold text-white shadow-xl shadow-violet-500/20">
                    A
                </div>
                <div>
                    <Button variant="outline" size="sm">Upload New Picture</Button>
                    <p className="text-xs text-zinc-500 mt-2">JPG, GIF or PNG. Max size of 800K</p>
                </div>
            </div>

            <Card>
                <h3 className="text-lg font-bold text-white mb-4">Personal Information</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2 sm:col-span-1">
                        <Input label="First Name" placeholder="Ahmed" />
                    </div>
                    <div className="col-span-2 sm:col-span-1">
                        <Input label="Last Name" placeholder="Abdelghany" />
                    </div>
                    <div className="col-span-2">
                        <Input label="Email Address" type="email" placeholder="ahmed@example.com" />
                    </div>
                </div>
                <div className="mt-6 flex justify-end">
                    <Button variant="primary">Save Changes</Button>
                </div>
            </Card>

            <Card>
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-lg font-bold text-white mb-1">Password</h3>
                        <p className="text-sm text-zinc-400">Change your password to keep your account secure.</p>
                    </div>
                    <Button variant="outline">Change Password</Button>
                </div>
            </Card>

            <div className="pt-6 border-t border-white/5">
                <h3 className="text-red-400 font-bold mb-2">Danger Zone</h3>
                <div className="flex justify-between items-center bg-red-500/5 border border-red-500/10 rounded-xl p-4">
                    <div>
                        <p className="text-white font-medium">Delete Account</p>
                        <p className="text-xs text-zinc-500">Permanently delete your account and all data.</p>
                    </div>
                    <Button variant="danger">Delete Account</Button>
                </div>
            </div>

        </div>
    );
};
