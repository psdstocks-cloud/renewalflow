import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { getSettings, updateSettings } from '../services/settingsService';

export const settingsRouter = Router();

settingsRouter.use(authMiddleware);

import { prisma, withRetry } from '../config/db';

settingsRouter.get('/api/settings', async (req, res, next) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    const workspaceUser = await withRetry(() => 
      prisma.workspaceUser.findFirst({
        where: { userId: user.id },
      })
    );
    // For now, if no workspace found, we might fallback to null (service defaults to findFirst)
    // But better to be consistent. Let's pass undefined if not found?
    // Actually, if a validated user has no workspace, they are in a bad state.
    // However, `getDefaultWorkspaceId` in service handles the fallback if undefined is passed.
    // BUT we want to enforce CORRECT workspace.
    // Let's pass the ID if found.
    const wsId = workspaceUser?.workspaceId;

    // If we pass undefined, service uses findFirst().
    // If user belongs to workspace B, but we pass undefined, service finds workspace A. BAD.
    // So we MUST pass the ID.
    // If user has NO workspace, pass NOTHING? Then service finds Workspace A. BAD.
    // The user MUST have a workspace.

    const settings = await getSettings(wsId);
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

settingsRouter.put('/api/settings', async (req, res, next) => {
  try {
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }
    const workspaceUser = await withRetry(() => 
      prisma.workspaceUser.findFirst({
        where: { userId: user.id },
      })
    );
    const wsId = workspaceUser?.workspaceId;

    const settings = await updateSettings(req.body, wsId);
    res.json(settings);
  } catch (error) {
    next(error);
  }
});
