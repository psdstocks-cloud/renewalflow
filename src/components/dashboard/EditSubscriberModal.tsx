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
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [points, setPoints] = useState(0);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (subscriber) {
            setName(subscriber.name);
            setEmail(subscriber.email);
            setPoints(subscriber.pointsRemaining || 0);
        }
    }, [subscriber]);

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
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Subscriber">
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
        </Modal>
    );
};
