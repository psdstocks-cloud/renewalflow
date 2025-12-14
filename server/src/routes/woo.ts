import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/db';
import { syncWooCustomersPage, backfillHistoryBatch, startBackgroundBackfill, startBackgroundSync, getSyncStatus } from '../services/wooService';

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

    const status = getSyncStatus(workspaceUser.workspaceId);
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

    // New Background Mode
    if (req.query.background === 'true') {
      const job = await startBackgroundSync(workspaceUser.workspaceId, updatedAfter);
      return res.json({ background: true, job });
    }

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const fetchHistory = req.query.include_history === 'true';
    const summary = await syncWooCustomersPage(page, workspaceUser.workspaceId, fetchHistory, updatedAfter);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});
