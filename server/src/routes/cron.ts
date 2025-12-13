import { Router } from 'express';
import { cronAuthMiddleware } from '../middleware/auth';
import { syncAllWooCustomers } from '../services/wooService';
import { computeReminderTasks, sendReminderBatch } from '../services/reminderService';

export const cronRouter = Router();

cronRouter.post('/api/cron/daily', cronAuthMiddleware, async (_req, res, next) => {
  try {
    const date = new Date();
    let wooResult = null;
    try {
      wooResult = await syncAllWooCustomers();
    } catch (error) {
      console.warn('Woo sync failed during cron', error);
    }
    const tasks = await computeReminderTasks(date);
    const reminderSummary = await sendReminderBatch(tasks);
    res.json({ date: date.toISOString().slice(0, 10), wooSync: wooResult, reminders: reminderSummary });
  } catch (error) {
    next(error);
  }
});
