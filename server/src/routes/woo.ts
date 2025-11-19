import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { syncWooOrders } from '../services/wooService';

export const wooRouter = Router();

wooRouter.use(authMiddleware);

wooRouter.post('/api/woo/sync', async (_req, res, next) => {
  try {
    const summary = await syncWooOrders();
    res.json(summary);
  } catch (error) {
    next(error);
  }
});
