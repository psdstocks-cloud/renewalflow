import React from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { Input } from '@/src/components/ui/Input';
import { Subscriber } from '@/src/types';
import { useLanguage } from '@/src/context/LanguageContext';

interface SubscribersViewProps {
    subscribers: Subscriber[];
    isLoading: boolean;
    searchQuery: string;
    onSearchChange: (q: string) => void;
    onEdit: (sub: Subscriber) => void;
    onDelete: (id: string) => void;
    page: number;
    total: number;
    onPageChange: (p: number) => void;
    onAddSubscriber: () => void;
}

export const SubscribersView: React.FC<SubscribersViewProps> = ({
    subscribers,
    isLoading,
    searchQuery,
    onSearchChange,
    onEdit,
    onDelete,
    page,
    total,
    onPageChange,
    onAddSubscriber
}) => {
    const { t } = useLanguage();
    const PAGE_SIZE = 25;
    const totalPages = Math.ceil(total / PAGE_SIZE);

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
                <div className="relative w-full max-w-md">
                    <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500"></i>
                    <input
                        type="text"
                        placeholder={t('search_placeholder')}
                        className="w-full bg-zinc-900 border border-zinc-800 rounded-xl py-2.5 pl-11 pr-4 text-white focus:outline-none focus:border-violet-500 transition-colors"
                        value={searchQuery}
                        onChange={(e) => onSearchChange(e.target.value)}
                    />
                </div>
                <Button onClick={onAddSubscriber} icon={<i className="fas fa-plus"></i>}>
                    Add Subscriber
                </Button>
            </div>

            <Card noPadding className="overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-white/5 border-b border-white/5 text-zinc-400 text-sm uppercase tracking-wider">
                                <th className="p-4 pl-6 font-medium">Customer</th>
                                <th className="p-4 font-medium">Plan</th>
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium">Renewal Date</th>
                                <th className="p-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-zinc-500">
                                        <i className="fas fa-circle-notch fa-spin mr-2"></i> Loading...
                                    </td>
                                </tr>
                            ) : subscribers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-zinc-500">
                                        No subscribers found.
                                    </td>
                                </tr>
                            ) : (
                                subscribers.map((sub) => (
                                    <tr key={sub.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="p-4 pl-6">
                                            <div className="font-bold text-white">{sub.name}</div>
                                            <div className="text-zinc-500 text-xs">{sub.email}</div>
                                        </td>
                                        <td className="p-4 text-zinc-300">
                                            {sub.planName}
                                            <div className="text-xs text-zinc-500">{sub.amount} {sub.currency}</div>
                                        </td>
                                        <td className="p-4">
                                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border
                           ${sub.status === 'ACTIVE'
                                                    ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                    : 'bg-red-500/10 text-red-400 border-red-500/20'}
                         `}>
                                                {sub.status}
                                            </span>
                                        </td>
                                        <td className="p-4 text-zinc-300 font-mono text-sm">
                                            {new Date(sub.endDate).toLocaleDateString()}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button onClick={() => onEdit(sub)} className="p-2 text-zinc-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                                    <i className="fas fa-edit"></i>
                                                </button>
                                                <button onClick={() => onDelete(sub.id)} className="p-2 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors">
                                                    <i className="fas fa-trash-alt"></i>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="p-4 border-t border-white/5 flex items-center justify-between">
                        <span className="text-sm text-zinc-500">
                            Page {page} of {totalPages}
                        </span>
                        <div className="flex gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === 1}
                                onClick={() => onPageChange(page - 1)}
                            >
                                Previous
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={page === totalPages}
                                onClick={() => onPageChange(page + 1)}
                            >
                                Next
                            </Button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
};
