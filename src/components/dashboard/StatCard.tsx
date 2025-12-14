import React from 'react';
import { Card } from '@/src/components/ui/Card';

interface StatCardProps {
    label: string;
    value: string;
    trend?: string;
    trendUp?: boolean;
    icon: string;
    color?: 'violet' | 'cyan' | 'emerald' | 'rose';
    onClick?: () => void;
}

export const StatCard: React.FC<StatCardProps> = ({
    label,
    value,
    trend,
    trendUp,
    icon,
    color = 'violet',
    onClick
}) => {
    const colorStyles = {
        violet: 'bg-violet-500/10 text-violet-400',
        cyan: 'bg-cyan-500/10 text-cyan-400',
        emerald: 'bg-emerald-500/10 text-emerald-400',
        rose: 'bg-rose-500/10 text-rose-400'
    };

    return (
        <div
            onClick={onClick}
            className={`${onClick ? 'cursor-pointer' : ''}`}
        >
            <Card className="relative overflow-hidden group hover:border-white/20 transition-all duration-300 transform hover:-translate-y-1">
                <div className="flex items-start justify-between">
                    <div>
                        <p className="text-zinc-500 font-medium text-sm mb-1">{label}</p>
                        <h3 className="text-3xl font-bold text-white tracking-tight">{value}</h3>

                        {trend && (
                            <div className={`flex items-center gap-1.5 mt-3 text-sm font-medium ${trendUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                                <i className={`fas fa-arrow-${trendUp ? 'up' : 'down'}`}></i>
                                <span>{trend}</span>
                            </div>
                        )}
                    </div>

                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl ${colorStyles[color]} transition-transform duration-300 group-hover:scale-110`}>
                        <i className={`fas ${icon}`}></i>
                    </div>
                </div>

                {/* Background decoration */}
                <div className={`absolute -bottom-4 -right-4 w-24 h-24 rounded-full blur-2xl opacity-20 ${colorStyles[color].split(' ')[0]}`}></div>
            </Card>
        </div>
    );
};
