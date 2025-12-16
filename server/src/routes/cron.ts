import { Router } from 'express';
import { cronAuthMiddleware } from '../middleware/auth';
import { syncAllWooCustomers } from '../services/wooService';
import { computeReminderTasks, sendReminderBatch } from '../services/reminderService';

export const cronRouter = Router();

cronRouter.post('/api/cron/daily', cronAuthMiddleware, async (_req, res, next) => {
  try {
    const date = new Date();

    // 1. Run the Sync (Now efficient due to Phase 1)
    console.log('Running Hourly Sync...');
    const wooResult = await syncAllWooCustomers();

    // 2. Compute Reminders (This is fast, so safe to run hourly)
    const tasks = await computeReminderTasks(date);
    const reminderSummary = await sendReminderBatch(tasks);

    res.json({
      success: true,
      timestamp: date.toISOString(),
      wooSync: wooResult,
      reminders: reminderSummary
    });
  } catch (error) {
    console.error('Cron Job Failed:', error);
    // Return 500 so your Cron provider knows it failed and can retry/alert you
    res.status(500).json({ error: 'Internal Server Error' });
  }
});
