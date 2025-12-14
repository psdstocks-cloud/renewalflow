import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/db';
import { syncWooCustomersPage, backfillHistoryBatch } from '../services/wooService';

export const wooRouter = Router();

wooRouter.use(authMiddleware);

wooRouter.post('/api/woo/backfill', async (req, res, next) => {
  try {
    const user = (req as any).user;
    const workspaceUser = await prisma.workspaceUser.findFirst({ where: { userId: user.id } });
    if (!workspaceUser) return res.status(404).json({ message: 'Workspace not found' });

    const page = parseInt(req.query.page as string || '1');
    const limit = parseInt(req.query.limit as string || '10');

    // Trigger batch process
    const summary = await backfillHistoryBatch(page, limit, workspaceUser.workspaceId);
    res.json(summary);
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

    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const summary = await syncWooCustomersPage(page, workspaceUser.workspaceId);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});
