import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import * as jwt from 'jsonwebtoken';
import { supabase } from '../config/supabase';

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  // Method 1: Check for admin API key (for service-to-service calls)
  const apiKey = req.header('x-admin-api-key');
  if (apiKey && apiKey === env.ADMIN_API_KEY) {
    return next();
  }

  // Method 2: Check for Supabase JWT token (for user authentication)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);

      // Use Supabase client to verify the token
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        console.error('[Auth] Supabase token verification failed:', error?.message);
        return res.status(401).json({
          message: 'Unauthorized',
          error: 'Invalid token',
          details: process.env.NODE_ENV === 'development' ? error?.message : undefined
        });
      }

      // Attach user info to request
      (req as any).user = {
        id: user.id,
        email: user.email,
        role: user.role || 'authenticated'
      };

      return next();
    } catch (error: any) {
      // Token verification failed
      console.error('[Auth] Token verification error:', error.message);
      return res.status(401).json({
        message: 'Unauthorized',
        error: 'Invalid token',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }

  return res.status(401).json({ message: 'Unauthorized' });
}

export function cronAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  const cronKey = req.header('x-cron-key') ?? req.header('x-admin-api-key');
  const expected = env.CRON_API_KEY ?? env.ADMIN_API_KEY;
  if (cronKey && cronKey === expected) {
    return next();
  }
  return res.status(401).json({ message: 'Unauthorized' });
}

export async function hybridAuthMiddleware(req: Request, res: Response, next: NextFunction) {
  // 1. Try Cron/Admin Auth
  const cronKey = req.header('x-cron-key') ?? req.header('x-admin-api-key');
  const expected = env.CRON_API_KEY ?? env.ADMIN_API_KEY;

  // DEBUG: Log what we're comparing
  console.log('[hybridAuth] Checking cron auth:', {
    receivedKey: cronKey ? `${cronKey.substring(0, 20)}...` : 'NONE',
    expectedKey: expected ? `${expected.substring(0, 20)}...` : 'NOT_SET',
    match: cronKey === expected
  });

  if (cronKey && cronKey === expected) {
    console.log('[hybridAuth] ✅ Cron key matched!');
    return next();
  }

  // 2. Try User JWT Auth (reuses authMiddleware logic)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (!error && user) {
        (req as any).user = {
          id: user.id,
          email: user.email,
          role: user.role || 'authenticated'
        };
        return next();
      }
    } catch (ignore) {
      // Just fall through to 401
    }
  }

  return res.status(401).json({ message: 'Unauthorized: Requires Cron Key or User Login' });
}
