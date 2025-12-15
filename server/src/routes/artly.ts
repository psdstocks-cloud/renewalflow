import { Router } from 'express';
import { artlyAuth } from '../middleware/artlyAuth';
import { authMiddleware } from '../middleware/auth';
import {
  processPointsEvents,
  processPointsBalances,
  processPointsChanges,
  processSubscriptions,
  processUsers,
  processCharges,
} from '../services/artlyService';
import {
  createSyncJob,
  getSyncJob,
  updateJobProgress,
  failJob,
  cancelJob,
} from '../services/syncJobService';
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

// Test endpoint to verify route registration (NO AUTH for debugging)
artlyRouter.post('/artly/sync/points-balances/start/test', async (req, res) => {
  res.json({
    message: 'Route /artly/sync/points-balances/start is registered',
    timestamp: new Date().toISOString(),
  });
});

// New job-based endpoints for points balance sync
artlyRouter.post('/artly/sync/points-balances/start', artlyAuth, async (req, res, next) => {
  try {
    const workspaceId = (req as any).workspaceId;
    const balances = Array.isArray(req.body) ? req.body : [];

    console.log('[artly/sync/points-balances/start] ===== ENDPOINT CALLED =====');
    console.log('[artly/sync/points-balances/start] WorkspaceId:', workspaceId);
    console.log('[artly/sync/points-balances/start] Body length:', balances.length);
    console.log('[artly/sync/points-balances/start] Headers:', {
      'x-artly-secret': req.headers['x-artly-secret'] ? 'present' : 'missing',
      'content-type': req.headers['content-type'],
    });

    // workspaceId should always be set by artlyAuth middleware (or null for legacy mode)
    // If it's undefined, something went wrong with auth
    if (workspaceId === undefined) {
      console.error('[artly/sync/points-balances/start] workspaceId is undefined - auth middleware may have failed');
      return res.status(401).json({ message: 'Unauthorized', error: 'Authentication failed' });
    }

    // Create sync job
    const job = createSyncJob('points-balances', workspaceId, balances.length);

    console.log('[artly/sync/points-balances/start] Created job:', job.jobId);

    // Start async processing (don't await)
    processPointsBalances(balances, workspaceId, job.jobId).catch((error) => {
      console.error('[artly/sync/points-balances/start] Sync error:', error);
      failJob(job.jobId, error.message || 'Unknown error during sync');
    });

    // Return jobId immediately
    console.log('[artly/sync/points-balances/start] Returning jobId:', job.jobId);
    res.json({
      success: true,
      jobId: job.jobId,
      message: 'Sync job started',
    });
  } catch (error: any) {
    console.error('[artly/sync/points-balances/start] Error:', error);
    next(error);
  }
});

artlyRouter.get('/artly/sync/points-balances/status', artlyAuth, async (req, res, next) => {
  try {
    const workspaceId = (req as any).workspaceId;
    const jobId = req.query.jobId as string;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const job = getSyncJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify job belongs to this workspace
    if (job.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({
      success: true,
      job: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        total: job.total,
        processed: job.processed,
        stepMessage: job.stepMessage,
        error: job.error,
        result: job.result,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
        completedAt: job.completedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

artlyRouter.post('/artly/sync/points-balances/cancel', artlyAuth, async (req, res, next) => {
  try {
    const workspaceId = (req as any).workspaceId;
    const jobId = req.body.jobId as string;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required' });
    }

    const job = getSyncJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    // Verify job belongs to this workspace
    if (job.workspaceId !== workspaceId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Only cancel if job is still running
    if (job.status !== 'running' && job.status !== 'pending') {
      return res.json({
        success: true,
        message: 'Job is already completed or cancelled',
        job: {
          jobId: job.jobId,
          status: job.status,
        },
      });
    }

    cancelJob(jobId);

    res.json({
      success: true,
      message: 'Job cancellation requested',
      jobId: jobId,
    });
  } catch (error) {
    next(error);
  }
});

// Legacy endpoint (kept for backward compatibility)
artlyRouter.post('/artly/sync/points-balances', artlyAuth, async (req, res, next) => {
  try {
    const workspaceId = (req as any).workspaceId;
    console.log('[artly/sync/points-balances] Received balance sync request (legacy)');
    console.log('[artly/sync/points-balances] WorkspaceId:', workspaceId);
    console.log('[artly/sync/points-balances] Body length:', Array.isArray(req.body) ? req.body.length : 'not an array');

    const result = await processPointsBalances(req.body, workspaceId);
    console.log('[artly/sync/points-balances] Sync completed:', result);
    res.json(result);
  } catch (error) {
    console.error('[artly/sync/points-balances] Error:', error);
    next(error);
  }
});

// Debug endpoint to check synced balances (requires auth)
artlyRouter.get('/artly/debug/balances', artlyAuth, async (req, res, next) => {
  try {
    const workspaceId = (req as any).workspaceId;
    const tenantId = workspaceId || 'artly';

    // Get wallet snapshots with customer info
    const snapshots = await prisma.walletSnapshot.findMany({
      where: { tenantId },
      include: {
        customer: {
          select: {
            id: true,
            email: true,
            externalUserId: true,
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20, // Get top 20 most recently updated
    });

    // Get total count
    const totalCount = await prisma.walletSnapshot.count({
      where: { tenantId },
    });

    // Get customers with points > 0
    const customersWithPoints = await prisma.walletSnapshot.count({
      where: {
        tenantId,
        pointsBalance: { gt: 0 },
      },
    });

    res.json({
      tenantId,
      workspaceId,
      totalSnapshots: totalCount,
      customersWithPoints,
      recentSnapshots: snapshots.map(s => ({
        email: s.customer.email,
        wpUserId: s.customer.externalUserId.toString(),
        pointsBalance: s.pointsBalance,
        updatedAt: s.updatedAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

artlyRouter.post('/artly/sync/points-changes', artlyAuth, async (req, res, next) => {
  try {
    const workspaceId = (req as any).workspaceId;
    const result = await processPointsChanges(req.body, workspaceId);
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

// Helper to run sync steps sequentially in background
async function runSequentialSync(connection: { websiteUrl: string; apiKey: string }) {
  const steps = ['users', 'points', 'charges'];
  const baseUrl = `${connection.websiteUrl.replace(/\/$/, '')}/wp-json/artly/v1/sync-all`;
  const headers = {
    'Content-Type': 'application/json',
    'x-artly-secret': connection.apiKey,
    'User-Agent': 'RenewalFlow-Backend/1.0',
  };

  console.log('[runSequentialSync] Starting background sequential sync...');

  for (const step of steps) {
    try {
      console.log(`[runSequentialSync] Triggering step: ${step}`);
      const stepUrl = `${baseUrl}?step=${step}`;

      const response = await fetch(stepUrl, {
        method: 'POST',
        headers,
        signal: AbortSignal.timeout(600000), // 10 minute timeout per step
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error(`[runSequentialSync] Step ${step} failed: ${response.status} ${errorText}`);
        // We continue to next step? Or stop? 
        // If users fail, points might fail too. But let's try to continue to be resilient? 
        // Actually, usually better to stop if a dependency fails. But here they are somewhat independent.
        // Let's continue but log error. The WP side also records the error in the option.
      } else {
        console.log(`[runSequentialSync] Step ${step} completed successfully`);
      }
    } catch (error: any) {
      console.error(`[runSequentialSync] Error executing step ${step}:`, error);
    }
  }
  console.log('[runSequentialSync] All steps finished.');
}

// Full sync endpoint - Triggers background sequential sync
artlyRouter.post('/artly/sync-all', authMiddleware, async (req, res, next) => {
  try {
    // Get workspaceId from authenticated user
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

    const workspaceId = workspaceUser.workspaceId;

    // Get the website connection to find the WordPress site URL
    const connection = await prisma.websiteConnection.findFirst({
      where: { workspaceId },
      select: { websiteUrl: true, apiKey: true },
    });

    if (!connection) {
      return res.status(404).json({
        message: 'No website connection found. Please create a connection in the Integrations tab.'
      });
    }

    // 1. Initialize Sync on WordPress (Reset progress)
    const wpUrl = `${connection.websiteUrl.replace(/\/$/, '')}/wp-json/artly/v1/sync-all?step=init`;
    console.log('[artly/sync-all] Initializing sync:', wpUrl);

    try {
      const initResponse = await fetch(wpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-artly-secret': connection.apiKey,
          'User-Agent': 'RenewalFlow-Backend/1.0',
        },
        signal: AbortSignal.timeout(30000), // 30s timeout for init
      });

      if (!initResponse.ok) {
        const errorText = await initResponse.text();
        return res.status(initResponse.status).json({
          message: 'Failed to initialize sync on WordPress',
          error: errorText
        });
      }
    } catch (initError: any) {
      console.error('[artly/sync-all] Init failed:', initError);
      return res.status(502).json({
        message: 'Failed to contact WordPress site',
        error: initError.message
      });
    }

    // 2. Start Background Orchestration (Fire and Forget)
    runSequentialSync(connection).catch(err => {
      console.error('[artly/sync-all] Background sync error:', err);
    });

    // 3. Return immediately
    res.json({
      success: true,
      message: 'Full sync started in background',
      status: 'started'
    });

  } catch (error: any) {
    console.error('[artly/sync-all] Error:', error);
    next(error);
  }
});

// Get full sync progress endpoint
artlyRouter.get('/artly/sync-all/progress', authMiddleware, async (req, res, next) => {
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

    const workspaceId = workspaceUser.workspaceId;

    const connection = await prisma.websiteConnection.findFirst({
      where: { workspaceId },
      select: { websiteUrl: true, apiKey: true },
    });

    if (!connection) {
      return res.status(404).json({
        message: 'No website connection found',
        status: 'idle'
      });
    }

    // Call WordPress plugin progress endpoint
    const wpUrl = `${connection.websiteUrl.replace(/\/$/, '')}/wp-json/artly/v1/sync-all/progress`;

    try {
      const response = await fetch(wpUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-artly-secret': connection.apiKey,
          'User-Agent': 'RenewalFlow-Backend/1.0',
        },
        signal: AbortSignal.timeout(10000), // 10s timeout for status
      });

      if (!response.ok) {
        return res.status(response.status).json({
          message: 'Failed to get progress',
          status: 'idle'
        });
      }

      const progress = await response.json();
      res.json(progress);
    } catch (fetchError: any) {
      console.error('[artly/sync-all/progress] Fetch error:', fetchError.message);
      // Return idle status if we can't connect, so frontend doesn't crash
      res.json({ status: 'idle', message: 'Connection failed' });
    }
  } catch (error: any) {
    console.error('[artly/sync-all/progress] Error:', error);
    res.json({ status: 'idle' });
  }
});
