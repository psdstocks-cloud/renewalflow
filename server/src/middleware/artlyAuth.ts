import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

export const artlyAuth = (req: Request, res: Response, next: NextFunction) => {
  if (!env.ARTLY_API_SECRET) {
    return res.status(500).json({ error: 'Artly API secret not configured' });
  }

  const secret = req.headers['x-artly-secret'];
  if (secret !== env.ARTLY_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  next();
};
