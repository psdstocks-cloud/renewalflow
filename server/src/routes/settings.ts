import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getSettings, updateSettings } from '../services/settingsService';

export const settingsRouter = Router();

settingsRouter.use(authMiddleware);

settingsRouter.get('/api/settings', async (_req, res, next) => {
  try {
    const settings = await getSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

settingsRouter.put('/api/settings', async (req, res, next) => {
  try {
    const settings = await updateSettings(req.body);
    res.json(settings);
  } catch (error) {
    next(error);
  }
});
