import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { syncWooCustomersPage } from '../services/wooService';

export const wooRouter = Router();

wooRouter.use(authMiddleware);

wooRouter.post('/api/woo/sync', async (req, res, next) => {
  try {
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const summary = await syncWooCustomersPage(page);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});
