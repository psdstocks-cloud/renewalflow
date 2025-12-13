import React, { useState, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Subscriber } from '@/src/types';
import { apiFetch } from '@/src/services/apiClient';

interface EditSubscriberModalProps {
    isOpen: boolean;
    onClose: () => void;
    subscriber: Subscriber | null;
    onSuccess: () => void;
}

export const EditSubscriberModal: React.FC<EditSubscriberModalProps> = ({ isOpen, onClose, subscriber, onSuccess }) => {
    const [activeTab, setActiveTab] = useState<'details' | 'history'>('details');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [points, setPoints] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    // History state
    const [history, setHistory] = useState<any[]>([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    useEffect(() => {
        if (subscriber) {
            setName(subscriber.name);
            setEmail(subscriber.email);
            setPoints(subscriber.pointsRemaining || 0);
            setActiveTab('details');
            setHistory([]);
        }
    }, [subscriber]);

    useEffect(() => {
        if (activeTab === 'history' && subscriber) {
            fetchHistory();
        }
    }, [activeTab, subscriber]);

    const fetchHistory = async () => {
        setLoadingHistory(true);
        try {
            const data = await apiFetch(`/api/subscribers/${subscriber!.id}/history`);
            setHistory(data);
        } catch (error) {
            console.error('Failed to fetch history', error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleSave = async () => {
        if (!subscriber) return;
        setIsSaving(true);
        try {
            await apiFetch(`/api/subscribers/${subscriber.id}`, {
                method: 'PUT',
                body: JSON.stringify({ name, email, pointsRemaining: points })
            });
            onSuccess();
            onClose();
        } catch (err) {
            console.error(err);
            alert('Failed to update subscriber');
        } finally {
            setIsSaving(false);
        }
    };

    if (!subscriber) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Subscriber Details">
            <div className="flex border-b border-white/10 mb-4">
                <button
                    onClick={() => setActiveTab('details')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'details' ? 'text-violet-400 border-b-2 border-violet-400' : 'text-zinc-400 hover:text-white'}`}
                >
                    Details
                </button>
                <button
                    onClick={() => setActiveTab('history')}
                    className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'history' ? 'text-violet-400 border-b-2 border-violet-400' : 'text-zinc-400 hover:text-white'}`}
                >
                    Points History
                </button>
            </div>

            <div className="min-h-[300px]">
                {activeTab === 'details' ? (
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Name</label>
                            <input
                                type="text"
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-violet-500"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Email</label>
                            <input
                                type="email"
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-violet-500"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-zinc-400 mb-1">Points Balance</label>
                            <input
                                type="number"
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-violet-500"
                                value={points}
                                onChange={(e) => setPoints(parseInt(e.target.value) || 0)}
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <Button variant="ghost" onClick={onClose} disabled={isSaving}>Cancel</Button>
                            <Button onClick={handleSave} loading={isSaving}>Save Changes</Button>
                        </div>
                    </div>
                ) : (
                    <div>
                        {loadingHistory ? (
                            <div className="text-center py-10 text-zinc-500">Loading history...</div>
                        ) : history.length === 0 ? (
                            <div className="text-center py-10 text-zinc-500">No point history found for the last 30 days.</div>
                        ) : (
                            <div className="space-y-2 overflow-y-auto max-h-[400px] pr-2 custom-scrollbar">
                                {history.map((item, idx) => (
                                    <div key={idx} className="bg-white/5 p-3 rounded-lg flex justify-between items-center text-sm border border-white/5">
                                        <div>
                                            <div className="text-white font-medium">{item.event || 'Point Change'}</div>
                                            <div className="text-zinc-500 text-xs mt-0.5">{new Date(item.date).toLocaleString()}</div>
                                            {item.data?.admin_user_id && <div className="text-zinc-600 text-[10px] mt-0.5">By Admin</div>}
                                        </div>
                                        <div className={`font-bold text-base ${Number(item.points) > 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {Number(item.points) > 0 ? '+' : ''}{item.points}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </Modal>
    );
};
