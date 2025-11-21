import { Router } from 'express';
import { artlyAuth } from '../middleware/artlyAuth';
import {
  processPointsEvents,
  processSubscriptions,
  processUsers,
  processCharges,
} from '../services/artlyService';
import { prisma } from '../config/db';

export const artlyRouter = Router();

// Log when router is initialized
console.log('[artlyRouter] Router initialized, registering routes...');

// Simple test endpoint (NO AUTH - to verify requests reach the server)
artlyRouter.get('/artly/test', async (req, res) => {
  console.log('[artly/test] ===== ENDPOINT HANDLER CALLED =====');
  console.log('[artly/test] Test endpoint called!');
  console.log('[artly/test] Headers:', req.headers);
  console.log('[artly/test] Sending response...');
  res.json({ 
    message: 'Test endpoint reached successfully!',
    timestamp: new Date().toISOString(),
    headers: {
      'x-artly-secret': req.headers['x-artly-secret'] ? 'present' : 'missing',
      'content-type': req.headers['content-type'],
    }
  });
  console.log('[artly/test] Response sent');
});

// Debug endpoint to check API key (NO AUTH - for debugging)
artlyRouter.get('/artly/debug/key-check', async (req, res) => {
  const apiKey = (req.headers['x-artly-secret'] as string)?.trim();
  
  if (!apiKey) {
    return res.json({ error: 'No x-artly-secret header provided' });
  }
  
  try {
    // Check if key exists in database
    const connection = await prisma.websiteConnection.findUnique({
      where: { apiKey },
      select: {
        id: true,
        websiteUrl: true,
        isActive: true,
        workspaceId: true,
      },
    });
    
    // Also check for similar keys
    const similarKeys = await prisma.websiteConnection.findMany({
      where: {
        apiKey: {
          startsWith: apiKey.substring(0, 30),
        },
      },
      select: {
        websiteUrl: true,
        apiKey: true,
        isActive: true,
      },
      take: 5,
    });
    
    return res.json({
      providedKey: {
        length: apiKey.length,
        prefix: apiKey.substring(0, 30),
        suffix: apiKey.substring(apiKey.length - 10),
        fullKey: apiKey, // For debugging - remove in production
      },
      exactMatch: connection ? {
        found: true,
        isActive: connection.isActive,
        websiteUrl: connection.websiteUrl,
        workspaceId: connection.workspaceId,
      } : { found: false },
      similarKeys: similarKeys.map(k => ({
        websiteUrl: k.websiteUrl,
        keyLength: k.apiKey.length,
        keyPrefix: k.apiKey.substring(0, 30),
        keySuffix: k.apiKey.substring(k.apiKey.length - 10),
        fullKey: k.apiKey, // For debugging
        isActive: k.isActive,
      })),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
});

artlyRouter.post('/artly/sync/points-events', artlyAuth, async (req, res, next) => {
  try {
    const workspaceId = (req as any).workspaceId;
    const result = await processPointsEvents(req.body, workspaceId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

artlyRouter.post('/artly/sync/subscriptions', artlyAuth, async (req, res, next) => {
  try {
    const workspaceId = (req as any).workspaceId;
    const result = await processSubscriptions(req.body, workspaceId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

artlyRouter.post('/artly/sync/users', artlyAuth, async (req, res, next) => {
  try {
    const workspaceId = (req as any).workspaceId;
    const result = await processUsers(req.body, workspaceId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

artlyRouter.post('/artly/sync/charges', artlyAuth, async (req, res, next) => {
  try {
    const workspaceId = (req as any).workspaceId;
    const result = await processCharges(req.body, workspaceId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});
