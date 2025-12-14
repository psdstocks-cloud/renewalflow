import React from 'react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend
} from 'recharts';
import { Card } from '@/src/components/ui/Card';

// --- Types ---
interface PointsFlowData {
    date: string;
    issued: number;
    redeemed: number;
}

interface RetentionForecastData {
    date: string;
    count: number;
}

// --- Components ---

interface PointsFlowChartProps {
    data: PointsFlowData[];
    isLoading: boolean;
}

export const PointsFlowChart: React.FC<PointsFlowChartProps> = ({ data, isLoading }) => {
    if (isLoading) {
        return (
            <Card className="h-80 flex items-center justify-center">
                <i className="fas fa-circle-notch fa-spin text-zinc-500 text-2xl"></i>
            </Card>
        );
    }

    if (data.length === 0) {
        return (
            <Card className="h-80 flex items-center justify-center text-zinc-500">
                No data available
            </Card>
        );
    }

    return (
        <Card className="h-96 w-full p-4">
            <h3 className="text-lg font-bold text-white mb-4">Points Velocity</h3>
            <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
                        <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#a1a1aa"
                            tick={{ fill: '#a1a1aa', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                            minTickGap={30}
                        />
                        <YAxis
                            stroke="#a1a1aa"
                            tick={{ fill: '#a1a1aa', fontSize: 12 }}
                            tickLine={false}
                            axisLine={false}
                        />
                        <Tooltip
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                            itemStyle={{ color: '#e4e4e7' }}
                        />
                        <Legend verticalAlign="top" height={36} />
                        <Line
                            type="monotone"
                            dataKey="issued"
                            name="Points Issued"
                            stroke="#10b981" // Emerald
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6 }}
                        />
                        <Line
                            type="monotone"
                            dataKey="redeemed"
                            name="Points Redeemed"
                            stroke="#f43f5e" // Rose
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 6 }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
};

interface RetentionForecastChartProps {
    data: RetentionForecastData[];
    summary: { overdue: number, today: number, next7Days: number };
    isLoading: boolean;
}

export const RetentionForecastChart: React.FC<RetentionForecastChartProps> = ({ data, summary, isLoading }) => {
    if (isLoading) {
        return (
            <Card className="h-80 flex items-center justify-center">
                <i className="fas fa-circle-notch fa-spin text-zinc-500 text-2xl"></i>
            </Card>
        );
    }

    return (
        <Card className="h-96 w-full p-4 flex flex-col">
            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-lg font-bold text-white">Retention Forecast</h3>
                    <p className="text-sm text-zinc-400">Expiring in next 7 days</p>
                </div>
                <div className="text-right">
                    <div className="text-2xl font-bold text-violet-400">{summary.next7Days}</div>
                    <div className="text-xs text-zinc-500 uppercase tracking-wide">Total at Risk</div>
                </div>
            </div>

            <div className="flex-1 w-full min-h-0">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid stroke="#3f3f46" strokeDasharray="3 3" vertical={false} />
                        <XAxis
                            dataKey="date"
                            stroke="#a1a1aa"
                            tick={{ fill: '#a1a1aa', fontSize: 10 }}
                            tickFormatter={(val) => val.slice(5)} // Show MM-DD
                            tickLine={false}
                            axisLine={false}
                        />
                        <YAxis
                            stroke="#a1a1aa"
                            tick={{ fill: '#a1a1aa', fontSize: 10 }}
                            tickLine={false}
                            axisLine={false}
                            allowDecimals={false}
                        />
                        <Tooltip
                            cursor={{ fill: '#27272a' }}
                            contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                            itemStyle={{ color: '#e4e4e7' }}
                        />
                        <Bar
                            dataKey="count"
                            name="Expiring Subscriptions"
                            fill="#8b5cf6" // Violet
                            radius={[4, 4, 0, 0]}
                            barSize={32}
                        />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 pt-4 border-t border-zinc-800 flex justify-around text-center text-sm">
                <div>
                    <div className="text-rose-400 font-bold">{summary.overdue}</div>
                    <div className="text-zinc-600">Overdue</div>
                </div>
                <div>
                    <div className="text-amber-400 font-bold">{summary.today}</div>
                    <div className="text-zinc-600">Today</div>
                </div>
            </div>
        </Card>
    );
};
