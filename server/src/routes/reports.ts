import { Router } from 'express';
import { prisma } from '../config/db';
import { startOfDay, addDays, format, subDays, isBefore, isAfter, isSameDay } from 'date-fns';

export const reportsRouter = Router();

// --- 1. Retention Forecast (Stacked Bar / Aggregated View) ---
reportsRouter.get('/api/reports/retention', async (req, res, next) => {
    try {
        const today = startOfDay(new Date());
        const weekFromNow = addDays(today, 7);
        const monthFromNow = addDays(today, 30);

        // Fetch all active subscribers
        const subscribers = await prisma.subscriber.findMany({
            where: {
                status: 'ACTIVE',
                endDate: { not: undefined } // Ensure strictly has date
            },
            select: { endDate: true, pointsRemaining: true }
        });

        // Buckets
        let overdue = 0;
        let todayCount = 0;
        let tomorrowCount = 0;
        let next7Days = 0;
        let next30Days = 0;

        // Daily breakdown for the next 7 days (for Bar Chart)
        const dailyForecast: { date: string, count: number }[] = [];
        for (let i = 0; i <= 6; i++) {
            dailyForecast.push({ date: format(addDays(today, i), 'yyyy-MM-dd'), count: 0 });
        }

        subscribers.forEach(sub => {
            const date = new Date(sub.endDate);

            if (isBefore(date, today)) {
                overdue++;
            } else if (isSameDay(date, today)) {
                todayCount++;
                dailyForecast[0].count++;
            } else if (isSameDay(date, addDays(today, 1))) {
                tomorrowCount++;
                dailyForecast[1].count++;
            } else {
                // Remaining 5 days of the week
                if (isBefore(date, weekFromNow)) {
                    // Find index in dailyForecast
                    const dateStr = format(date, 'yyyy-MM-dd');
                    const dayIdx = dailyForecast.findIndex(d => d.date === dateStr);
                    if (dayIdx !== -1) dailyForecast[dayIdx].count++;
                }
            }

            // Aggregate high level
            if (isAfter(date, today) && isBefore(date, weekFromNow)) {
                next7Days++; // This includes tomorrow but excludes today based on logic above? Let's keep it simple.
                // Actually, let's make next7Days include today for "Next 7 Days workload"
            }

            if (isAfter(date, today) && isBefore(date, monthFromNow)) {
                next30Days++;
            }
        });

        res.json({
            summary: { overdue, today: todayCount, tomorrow: tomorrowCount, next7Days, next30Days },
            dailyForecast
        });

    } catch (error) {
        next(error);
    }
});

// --- 2. Points Velocity (Line Chart) ---
reportsRouter.get('/api/reports/points-flow', async (req, res, next) => {
    try {
        const today = new Date();
        const thirtyDaysAgo = subDays(today, 30);

        const history = await prisma.pointHistory.findMany({
            where: {
                date: { gte: thirtyDaysAgo }
            },
            orderBy: { date: 'asc' }
        });

        // Aggregate by day
        // Structure: { date: '2023-01-01', issued: 100, redeemed: 50 }
        const map = new Map<string, { issued: number, redeemed: number }>();

        // Initialize last 30 days with 0
        for (let i = 0; i <= 30; i++) {
            const d = format(subDays(today, 30 - i), 'yyyy-MM-dd');
            map.set(d, { issued: 0, redeemed: 0 });
        }

        history.forEach((entry: any) => {
            const d = format(new Date(entry.date), 'yyyy-MM-dd');
            if (map.has(d)) {
                const current = map.get(d)!;
                if (entry.change > 0) {
                    current.issued += entry.change;
                } else {
                    current.redeemed += Math.abs(entry.change);
                }
            }
        });

        const chartData = Array.from(map.entries()).map(([date, values]) => ({
            date,
            issued: values.issued,
            redeemed: values.redeemed
        }));

        res.json(chartData);

    } catch (error) {
        next(error);
    }
});

// --- 3. Good Morning Briefing (Actionable Insights) ---
reportsRouter.get('/api/reports/briefing', async (req, res, next) => {
    try {
        const today = startOfDay(new Date());
        const weekFromNow = addDays(today, 7);

        // Fetch key metrics
        const [overdueCount, expiringSoonCount, recentRedemptions] = await Promise.all([
            prisma.subscriber.count({
                where: {
                    status: 'ACTIVE',
                    endDate: { lt: today }
                }
            }),
            prisma.subscriber.count({
                where: {
                    status: 'ACTIVE',
                    endDate: { gte: today, lte: weekFromNow }
                }
            }),
            prisma.pointHistory.count({
                where: {
                    change: { lt: 0 }, // Redeemed
                    date: { gte: subDays(today, 7) }
                }
            })
        ]);

        // Generate Suggestions
        const suggestions: { type: 'urgent' | 'warning' | 'info' | 'success', message: string, action?: string }[] = [];

        // 1. Retention (Urgent/Warning)
        if (overdueCount > 0) {
            suggestions.push({
                type: 'urgent',
                message: `${overdueCount} subscriptions are overdue. Service may be interrupted.`,
                action: 'Review Overdue'
            });
        }

        if (expiringSoonCount > 0) {
            suggestions.push({
                type: 'warning',
                message: `${expiringSoonCount} renewals coming up this week. Ensure reminders are active.`,
                action: 'View Upcoming'
            });
        } else {
            suggestions.push({
                type: 'success',
                message: "Clear week ahead! No upcoming renewals in the next 7 days.",
            });
        }

        // 2. Engagement (Info)
        if (recentRedemptions === 0) {
            suggestions.push({
                type: 'info',
                message: "No points redeemed in the last 7 days. Consider a 'Double Points' campaign to boost engagement.",
            });
        }

        // Determine Time of Day Greeting
        const hour = new Date().getHours();
        let greeting = 'Good Morning';
        if (hour >= 12) greeting = 'Good Afternoon';
        if (hour >= 17) greeting = 'Good Evening';

        res.json({
            greeting,
            suggestions
        });

    } catch (error) {
        next(error);
    }
});
