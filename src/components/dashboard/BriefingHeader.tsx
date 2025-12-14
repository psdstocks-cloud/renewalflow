import React, { useState } from 'react';
import { Card } from '@/src/components/ui/Card';

interface Insight {
    type: 'urgent' | 'warning' | 'info' | 'success';
    message: string;
    action?: string;
}

interface BriefingHeaderProps {
    greeting: string;
    suggestions: Insight[];
    isLoading: boolean;
    onAction?: (action: string) => void;
}

export const BriefingHeader: React.FC<BriefingHeaderProps> = ({ greeting, suggestions, isLoading, onAction }) => {
    const [isVisible, setIsVisible] = useState(true);

    if (isLoading) {
        return (
            <div className="mb-8 animate-pulse flex flex-col gap-2">
                <div className="h-8 w-48 bg-zinc-800 rounded"></div>
                <div className="h-4 w-96 bg-zinc-800 rounded"></div>
            </div>
        );
    }

    if (!isVisible) return null;

    return (
        <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 animate-fade-in-up">
            <div>
                <h1 className="text-3xl font-bold text-white mb-2 tracking-tight">
                    {greeting}, Ahmed! <span className="text-2xl">👋</span>
                </h1>
                <p className="text-zinc-400">
                    Here is your briefing for today.
                </p>
            </div>

            <div className="flex flex-col gap-3 w-full sm:w-auto">
                {suggestions.map((insight, idx) => (
                    <div
                        key={idx}
                        className={`
                    p-3 rounded-xl border border-white/5 backdrop-blur-sm flex items-center justify-between gap-4 text-sm
                    ${insight.type === 'urgent' ? 'bg-rose-500/10 border-rose-500/20 text-rose-200' : ''}
                    ${insight.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-200' : ''}
                    ${insight.type === 'info' ? 'bg-indigo-500/10 border-indigo-500/20 text-indigo-200' : ''}
                    ${insight.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' : ''}
                `}
                    >
                        <div className="flex items-center gap-2">
                            {insight.type === 'urgent' && <i className="fas fa-exclamation-circle text-rose-400"></i>}
                            {insight.type === 'warning' && <i className="fas fa-exclamation-triangle text-amber-400"></i>}
                            {insight.type === 'info' && <i className="fas fa-info-circle text-indigo-400"></i>}
                            {insight.type === 'success' && <i className="fas fa-check-circle text-emerald-400"></i>}
                            <span>{insight.message}</span>
                        </div>

                        {insight.action && (
                            <button
                                onClick={() => onAction && onAction(insight.action)}
                                className="text-xs font-bold uppercase tracking-wider hover:underline whitespace-nowrap"
                            >
                                {insight.action} <i className="fas fa-arrow-right ml-1"></i>
                            </button>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
