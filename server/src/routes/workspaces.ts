import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/db';

export const workspaceRouter = Router();

workspaceRouter.use(authMiddleware);

// Bootstrap workspace for authenticated user
workspaceRouter.post('/api/workspaces/bootstrap', async (req, res, next) => {
  try {
    // Get user ID from auth middleware (set by authMiddleware after JWT verification)
    const user = (req as any).user;
    if (!user || !user.id) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const userId = user.id;

    // Check if user already has a workspace
    const existingWorkspaceUser = await prisma.workspaceUser.findFirst({
      where: { userId },
      include: {
        workspace: true
      }
    });

    if (existingWorkspaceUser) {
      return res.json({
        workspace: {
          id: existingWorkspaceUser.workspace.id,
          name: existingWorkspaceUser.workspace.name
        }
      });
    }

    // Create a new workspace for the user
    const workspace = await prisma.workspace.create({
      data: {
        name: 'My Workspace',
        users: {
          create: {
            userId: userId,
            role: 'OWNER'
          }
        }
      }
    });

    res.json({
      workspace: {
        id: workspace.id,
        name: workspace.name
      }
    });
  } catch (error) {
    next(error);
  }
});

