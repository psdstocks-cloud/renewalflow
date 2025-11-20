import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import * as jwt from 'jsonwebtoken';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
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
      // Verify JWT using Supabase JWT secret
      const decoded = jwt.verify(token, env.SUPABASE_JWT_SECRET) as any;
      
      // Attach user info to request
      (req as any).user = {
        id: decoded.sub || decoded.user_id,
        email: decoded.email,
        role: decoded.role
      };
      
      return next();
    } catch (error) {
      // JWT verification failed
      return res.status(401).json({ message: 'Unauthorized', error: 'Invalid token' });
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
