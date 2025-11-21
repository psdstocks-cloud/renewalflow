import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { validateWorkspaceApiKey } from '../services/workspaceApiKeyService';

export const artlyAuth = async (req: Request, res: Response, next: NextFunction) => {
  console.log('[artlyAuth] ===== MIDDLEWARE CALLED =====');
  console.log('[artlyAuth] Method:', req.method);
  console.log('[artlyAuth] Path:', req.path);
  console.log('[artlyAuth] URL:', req.url);
  
  // Check for workspace-specific API key (from WebsiteConnection)
  // Express normalizes headers to lowercase, so 'X-Artly-Secret' becomes 'x-artly-secret'
  const apiKey = (req.headers['x-artly-secret'] as string)?.trim();
  
  // Log all headers for debugging
  console.log('[artlyAuth] All headers:', Object.keys(req.headers));
  console.log('[artlyAuth] x-artly-secret header:', apiKey ? `Present (length: ${apiKey.length})` : 'MISSING');
  console.log('[artlyAuth] x-artly-secret value (first 30):', apiKey ? apiKey.substring(0, 30) + '...' : 'N/A');
  console.log('[artlyAuth] x-artly-secret value (last 10):', apiKey ? '...' + apiKey.substring(apiKey.length - 10) : 'N/A');
  
  if (!apiKey) {
    console.log('[artlyAuth] ❌ Missing x-artly-secret header - returning 401');
    return res.status(401).json({ error: 'Missing API key. Please send the API key in the x-artly-secret header.' });
  }

  console.log('[artlyAuth] ✅ API key present, validating...');
  console.log('[artlyAuth] Full API key:', apiKey);

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
