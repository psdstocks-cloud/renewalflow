import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export function authMiddleware(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.header('x-admin-api-key');
  if (apiKey && apiKey === env.ADMIN_API_KEY) {
    return next();
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
