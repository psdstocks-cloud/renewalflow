import React from 'react';
import { Card } from '@/src/components/ui/Card';
import { Button } from '@/src/components/ui/Button';
import { ReminderTask } from '@/src/types';
import { useLanguage } from '@/src/context/LanguageContext';

interface ActionCenterProps {
    tasks: ReminderTask[];
    onSend: (task: ReminderTask) => void;
    sendingTaskId: string | null;
    onSendBatch: () => void;
    isBatchSending: boolean;
}

export const ActionCenter: React.FC<ActionCenterProps> = ({
    tasks,
    onSend,
    sendingTaskId,
    onSendBatch,
    isBatchSending
}) => {
    const { t } = useLanguage();

    if (tasks.length === 0) {
        return (
            <Card className="text-center py-16">
                <div className="w-20 h-20 rounded-full bg-emerald-500/10 mx-auto flex items-center justify-center text-emerald-400 text-3xl mb-6">
                    <i className="fas fa-check"></i>
                </div>
                <h3 className="text-xl font-bold text-white mb-2">All Caught Up!</h3>
                <p className="text-zinc-400">No subscriptions require reminders today.</p>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-xl font-bold text-white">{t('action_center')}</h2>
                    <p className="text-zinc-400">You have <span className="text-violet-400 font-bold">{tasks.length}</span> tasks requiring attention.</p>
                </div>
                <Button
                    onClick={onSendBatch}
                    variant="primary"
                    disabled={isBatchSending || tasks.length === 0}
                    icon={<i className={`fas ${isBatchSending ? 'fa-spinner fa-spin' : 'fa-paper-plane'}`}></i>}
                >
                    Process All ({tasks.length})
                </Button>
            </div>

            <div className="grid gap-4">
                {tasks.map((task) => (
                    <Card key={task.id} className="group hover:border-violet-500/30 transition-all" noPadding>
                        <div className="p-5 flex items-center justify-between">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-cyan-400 flex items-center justify-center text-white font-bold text-sm">
                                    {(task.subscriber?.name || '?').charAt(0)}
                                </div>
                                <div>
                                    <h4 className="font-bold text-white text-lg">{task.subscriber?.name || 'Unknown Subscriber'}</h4>
                                    <div className="flex items-center gap-3 text-sm mt-1">
                                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${task.daysUntilExpiry < 0 ? 'bg-red-500/10 text-red-400' : 'bg-amber-500/10 text-amber-400'}`}>
                                            {Math.abs(task.daysUntilExpiry)} Days {task.daysUntilExpiry < 0 ? 'Overdue' : 'Left'}
                                        </span>
                                        <span className="text-zinc-500">{task.subscriber?.planName || 'No Plan'}</span>
                                        <span className="text-violet-400 font-medium flex items-center gap-1">
                                            <i className="fas fa-coins text-xs"></i> {task.subscriber?.pointsRemaining || 0} Points
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="text-right hidden sm:block mr-4">
                                    <div className="text-xs text-zinc-500 uppercase tracking-wider mb-1">Reminder Type</div>
                                    <div className="font-mono text-sm text-cyan-400">{task.type}</div>
                                </div>
                                <Button
                                    size="sm"
                                    variant="secondary"
                                    onClick={() => onSend(task)}
                                    disabled={sendingTaskId === task.id}
                                >
                                    {sendingTaskId === task.id ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                                    <span className="ml-2">Send</span>
                                </Button>
                            </div>
                        </div>
                    </Card>
                ))}
            </div>
        </div>
    );
};
