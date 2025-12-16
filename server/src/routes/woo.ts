import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/db';
import { syncWooCustomersPage, backfillHistoryBatch, startBackgroundBackfill, syncAllWooCustomers } from '../services/wooService';
import { getSettings } from '../services/settingsService';

export const wooRouter = Router();

wooRouter.use(authMiddleware);

wooRouter.post('/api/woo/backfill', async (req, res, next) => {
  try {
    const user = (req as any).user;
    const workspaceUser = await prisma.workspaceUser.findFirst({ where: { userId: user.id } });
    if (!workspaceUser) return res.status(404).json({ message: 'Workspace not found' });

    // New Background Mode
    if (req.query.background === 'true') {
      const job = await startBackgroundBackfill(workspaceUser.workspaceId);
      return res.json({ background: true, job });
    }

    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '10');

    // Trigger batch process (blocking)
    const summary = await backfillHistoryBatch(page, limit, workspaceUser.workspaceId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

wooRouter.get('/api/woo/status', async (req, res, next) => {
  try {
    const user = (req as any).user;
    const workspaceUser = await prisma.workspaceUser.findFirst({ where: { userId: user.id } });
    if (!workspaceUser) return res.status(404).json({ message: 'Workspace not found' });

    const settings = await getSettings(workspaceUser.workspaceId);

    // Return the persistent DB status or default to idle
    const status = settings.wooSettings?.syncStatus || {
      state: 'idle',
      message: 'Ready to sync',
      progress: 0,
      lastUpdated: new Date().toISOString()
    };

    res.json(status);
  } catch (error) {
    next(error);
  }
});

wooRouter.post('/api/woo/sync', async (req, res, next) => {
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

    const updatedAfter = req.query.updated_after as string | undefined;

    // Background Mode (Force Sync)
    if (req.query.background === 'true') {
      // Fire and forget - using the instrumented syncAllWooCustomers which updates DB status
      syncAllWooCustomers(workspaceUser.workspaceId).catch(err => {
        console.error('[Background Sync] Failed:', err);
      });

      return res.json({
        background: true,
        message: 'Sync started in background',
        status: 'started'
      });
    }

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const fetchHistory = req.query.include_history === 'true';
    const summary = await syncWooCustomersPage(page, workspaceUser.workspaceId, fetchHistory, updatedAfter);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});
