import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { validateWorkspaceApiKey } from '../services/workspaceApiKeyService';

export const artlyAuth = async (req: Request, res: Response, next: NextFunction) => {
  // Check for workspace-specific API key (from WebsiteConnection)
  const apiKey = req.headers['x-artly-secret'] as string;
  
  if (!apiKey) {
    console.log('[artlyAuth] Missing x-artly-secret header');
    return res.status(401).json({ error: 'Missing API key' });
  }

  console.log('[artlyAuth] Validating API key:', apiKey.substring(0, 30) + '...');

  try {
    // Validate the API key and get workspace info
    const keyInfo = await validateWorkspaceApiKey(apiKey);
    
    if (!keyInfo) {
      // Fallback to global API secret for backward compatibility (if configured)
      if (env.ARTLY_API_SECRET && apiKey === env.ARTLY_API_SECRET) {
        console.log('[artlyAuth] Using legacy ARTLY_API_SECRET');
        // Legacy mode: use default tenant 'artly'
        (req as any).workspaceId = null;
        return next();
      }
      
      console.log('[artlyAuth] Invalid API key - not found in database or inactive');
      return res.status(401).json({ 
        error: 'Invalid API key. Please check: 1) The API key matches the one in your RenewalFlow dashboard, 2) The database migration has been run (WebsiteConnection table exists), 3) The connection is active.' 
      });
    }

    // Attach workspace info to request
    (req as any).workspaceId = keyInfo.workspaceId;
    (req as any).connectionId = keyInfo.connectionId;

    console.log('[artlyAuth] API key validated successfully for workspace:', keyInfo.workspaceId);
    next();
  } catch (error: any) {
    console.error('[artlyAuth] Error validating API key:', error.message);
    
    // Check if it's a migration error
    if (error.message?.includes('migration required') || error.message?.includes('does not exist')) {
      return res.status(500).json({ 
        error: 'Database migration required',
        message: 'The WebsiteConnection table does not exist. Please run the database migration from server/prisma/migrations/20251220000000_add_website_connections/migration.sql in your Supabase SQL Editor.',
        details: error.message
      });
    }
    
    return res.status(500).json({ 
      error: 'Internal server error during API key validation',
      message: error.message 
    });
  }
};
