import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import {
  cancelSubscriber,
  createSubscriber,
  getSubscriber,
  importSubscribers,
  listSubscribers,
  subscriberStats,
  syncCustomersToSubscribers,
  updateSubscriber,
  getSyncProgress,
  clearSyncProgress,
} from '../services/subscriberService';
import { z } from 'zod';
import { getSettings } from '../services/settingsService';
import { prisma } from '../config/db';

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
    const {
      q,
      status,
      source,
      tag,
      nextRenewalFrom,
      nextRenewalTo,
      expiringInDays,
      hasPhone,
      page,
      pageSize,
      sortBy,
      sortDir,
      // Legacy params for backward compatibility
      search,
      skip,
      take,
    } = req.query;

    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const workspaceUser = await prisma.workspaceUser.findFirst({
      where: { userId: user.id },
    });

    if (!workspaceUser) {
      return res.status(404).json({ message: 'Workspace not found for user' });
    }

    // Support both new and legacy params
    const searchQuery = (q as string) || (search as string);
    const skipValue = skip ? Number(skip) : page ? (Number(page) - 1) * (pageSize ? Number(pageSize) : 25) : undefined;
    const takeValue = take ? Number(take) : pageSize ? Number(pageSize) : undefined;

    const result = await listSubscribers({
      workspaceId: workspaceUser.workspaceId,
      q: searchQuery,
      status: status as string | undefined,
      source: source as string | undefined,
      tag: tag as string | undefined,
      nextRenewalFrom: nextRenewalFrom ? (nextRenewalFrom as string) : undefined,
      nextRenewalTo: nextRenewalTo ? (nextRenewalTo as string) : undefined,
      expiringInDays: expiringInDays ? Number(expiringInDays) : undefined,
      hasPhone: hasPhone === 'true' ? true : hasPhone === 'false' ? false : undefined,
      skip: skipValue,
      take: takeValue,
      sortBy: sortBy as string | undefined,
      sortDir: (sortDir as 'asc' | 'desc') || 'asc',
    });

    res.json(result);
  } catch (error) {
    next(error);
  }
});

// IMPORTANT: These specific routes must come BEFORE /api/subscribers/:id
// Otherwise Express will match "sync-progress", "sync-from-artly", etc. as :id parameters

// Get sync progress
subscriberRouter.get('/api/subscribers/sync-progress', async (req, res, next) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const workspaceUser = await prisma.workspaceUser.findFirst({
      where: { userId: user.id },
    });

    if (!workspaceUser) {
      return res.status(404).json({ message: 'Workspace not found for user' });
    }

    const progress = getSyncProgress(workspaceUser.workspaceId);
    
    if (!progress) {
      return res.json({
        status: 'idle',
        message: 'No sync in progress',
      });
    }

    res.json(progress);
  } catch (error) {
    next(error);
  }
});

// Sync Customers from Artly integration to Subscribers
subscriberRouter.post('/api/subscribers/sync-from-artly', async (req, res, next) => {
  try {
    // Get workspaceId from authenticated user
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const workspaceUser = await prisma.workspaceUser.findFirst({
      where: { userId: user.id },
    });

    if (!workspaceUser) {
      return res.status(404).json({ message: 'Workspace not found for user' });
    }

    // Start sync in background (don't await)
    syncCustomersToSubscribers(workspaceUser.workspaceId).catch((error) => {
      console.error('[sync-from-artly] Sync error:', error);
      const progress = getSyncProgress(workspaceUser.workspaceId);
      if (progress) {
        progress.status = 'error';
        progress.message = error.message || 'Sync failed';
        progress.endTime = new Date();
      }
    });

    // Return immediately with initial progress
    res.json({
      success: true,
      message: 'Sync started',
      syncStarted: true,
    });
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

