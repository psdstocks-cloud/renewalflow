import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { validateWorkspaceApiKey } from '../services/workspaceApiKeyService';

export const artlyAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Check for workspace-specific API key (from WebsiteConnection)
  const apiKey = req.headers['x-artly-secret'] as string;
  
  if (!apiKey) {
    return res.status(401).json({ error: 'Missing API key' });
  }

  // Validate the API key and get workspace info
  const keyInfo = await validateWorkspaceApiKey(apiKey);
  
  if (!keyInfo) {
    // Fallback to global API secret for backward compatibility (if configured)
    if (env.ARTLY_API_SECRET && apiKey === env.ARTLY_API_SECRET) {
      // Legacy mode: use default tenant 'artly'
      (req as any).workspaceId = null;
      return next();
    }
    
    return res.status(401).json({ error: 'Invalid API key' });
  }

  // Attach workspace info to request
  (req as any).workspaceId = keyInfo.workspaceId;
  (req as any).connectionId = keyInfo.connectionId;

  next();
};
