import { Router } from 'express';
import { authMiddleware } from '../middleware/auth';
import { prisma } from '../config/db';
import { randomBytes } from 'crypto';
import { z } from 'zod';

export const websiteConnectionRouter = Router();
websiteConnectionRouter.use(authMiddleware);

const createConnectionSchema = z.object({
  websiteUrl: z.string().url('Invalid website URL'),
});

const updateConnectionSchema = z.object({
  websiteUrl: z.string().url('Invalid website URL').optional(),
  isActive: z.boolean().optional(),
});

// Helper to get workspaceId from authenticated user
async function getWorkspaceId(req: any): Promise<string> {
  const user = req.user;
  if (!user || !user.id) {
    throw new Error('User not authenticated');
  }

  const workspaceUser = await prisma.workspaceUser.findFirst({
    where: { userId: user.id },
  });

  if (!workspaceUser) {
    throw new Error('User does not have a workspace');
  }

  return workspaceUser.workspaceId;
}

// Get all website connections for the workspace
websiteConnectionRouter.get('/api/website-connections', async (req, res, next) => {
  try {
    const workspaceId = await getWorkspaceId(req);

    const connections = await prisma.websiteConnection.findMany({
      where: { workspaceId },
      select: {
        id: true,
        websiteUrl: true,
        apiKey: true,
        isActive: true,
        lastSyncAt: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(connections);
  } catch (error) {
    next(error);
  }
});

// Create a new website connection
websiteConnectionRouter.post('/api/website-connections', async (req, res, next) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const { websiteUrl } = createConnectionSchema.parse(req.body);

    // Check if workspace already has a connection (limit to 1 per workspace)
    const existing = await prisma.websiteConnection.findFirst({
      where: { workspaceId, isActive: true },
    });

    if (existing) {
      return res.status(400).json({
        error: 'Workspace already has an active website connection. Please deactivate the existing one first.',
      });
    }

    // Generate a secure API key
    const apiKey = `artly_${workspaceId}_${randomBytes(32).toString('hex')}`;

    const connection = await prisma.websiteConnection.create({
      data: {
        workspaceId,
        websiteUrl,
        apiKey,
        isActive: true,
      },
      select: {
        id: true,
        websiteUrl: true,
        apiKey: true,
        isActive: true,
        createdAt: true,
      },
    });

    res.status(201).json(connection);
  } catch (error) {
    next(error);
  }
});

// Update a website connection
websiteConnectionRouter.put('/api/website-connections/:id', async (req, res, next) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const { id } = req.params;
    const data = updateConnectionSchema.parse(req.body);

    const connection = await prisma.websiteConnection.findFirst({
      where: { id, workspaceId },
    });

    if (!connection) {
      return res.status(404).json({ error: 'Website connection not found' });
    }

    const updated = await prisma.websiteConnection.update({
      where: { id },
      data,
      select: {
        id: true,
        websiteUrl: true,
        apiKey: true,
        isActive: true,
        lastSyncAt: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Regenerate API key
websiteConnectionRouter.post('/api/website-connections/:id/regenerate-key', async (req, res, next) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const { id } = req.params;

    const connection = await prisma.websiteConnection.findFirst({
      where: { id, workspaceId },
    });

    if (!connection) {
      return res.status(404).json({ error: 'Website connection not found' });
    }

    // Generate a new secure API key
    const newApiKey = `artly_${workspaceId}_${randomBytes(32).toString('hex')}`;

    const updated = await prisma.websiteConnection.update({
      where: { id },
      data: { apiKey: newApiKey },
      select: {
        id: true,
        websiteUrl: true,
        apiKey: true,
        isActive: true,
        updatedAt: true,
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

// Delete a website connection
websiteConnectionRouter.delete('/api/website-connections/:id', async (req, res, next) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    const { id } = req.params;

    const connection = await prisma.websiteConnection.findFirst({
      where: { id, workspaceId },
    });

    if (!connection) {
      return res.status(404).json({ error: 'Website connection not found' });
    }

    await prisma.websiteConnection.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

