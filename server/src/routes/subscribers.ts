import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  cancelSubscriber,
  createSubscriber,
  getSubscriber,
  importSubscribers,
  listSubscribers,
  subscriberStats,
  updateSubscriber
} from '../services/subscriberService';
import { z } from 'zod';
import { getSettings } from '../services/settingsService';

export const subscriberRouter = Router();

subscriberRouter.use(authMiddleware);

subscriberRouter.get('/api/subscribers/stats', async (_req, res, next) => {
  try {
    const { reminderConfig } = await getSettings();
    const stats = await subscriberStats(new Date(), reminderConfig.firstReminderDays);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

subscriberRouter.get('/api/subscribers', async (req, res, next) => {
  try {
    const { status, search, skip, take } = req.query;
    const result = await listSubscribers({
      status: status as string | undefined,
      search: search as string | undefined,
      skip: skip ? Number(skip) : undefined,
      take: take ? Number(take) : undefined
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

subscriberRouter.get('/api/subscribers/:id', async (req, res, next) => {
  try {
    const subscriber = await getSubscriber(req.params.id);
    if (!subscriber) {
      return res.status(404).json({ message: 'Subscriber not found' });
    }
    res.json(subscriber);
  } catch (error) {
    next(error);
  }
});

subscriberRouter.post('/api/subscribers', async (req, res, next) => {
  try {
    const subscriber = await createSubscriber(req.body);
    res.status(201).json(subscriber);
  } catch (error) {
    next(error);
  }
});

subscriberRouter.put('/api/subscribers/:id', async (req, res, next) => {
  try {
    const subscriber = await updateSubscriber(req.params.id, req.body);
    res.json(subscriber);
  } catch (error) {
    next(error);
  }
});

subscriberRouter.delete('/api/subscribers/:id', async (req, res, next) => {
  try {
    const subscriber = await cancelSubscriber(req.params.id);
    res.json(subscriber);
  } catch (error) {
    next(error);
  }
});

subscriberRouter.post('/api/subscribers/import', async (req, res, next) => {
  try {
    const schema = z.object({ subscribers: z.array(z.any()) });
    const { subscribers } = schema.parse(req.body);
    const summary = await importSubscribers(subscribers as any);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});
