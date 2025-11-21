import { prisma } from '../config/db';

const API_KEY_PREFIX = 'artly_';

/**
 * Validate API key and return workspaceId and connection info
 */
export async function validateWorkspaceApiKey(apiKey: string): Promise<{ workspaceId: string; connectionId: string } | null> {
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    console.log('[validateWorkspaceApiKey] API key does not start with expected prefix');
    return null;
  }

  try {
    // Trim the API key to remove any whitespace
    const trimmedKey = apiKey.trim();
    
    // Find the connection by API key (exact match, case-sensitive)
    const connection = await prisma.websiteConnection.findUnique({
      where: { apiKey: trimmedKey },
      select: {
        id: true,
        workspaceId: true,
        isActive: true,
      },
    });

    if (!connection) {
      // Debug: Try to find any connection with similar key (first 30 chars)
      const similarKeys = await prisma.websiteConnection.findMany({
        where: {
          apiKey: {
            startsWith: trimmedKey.substring(0, 30),
          },
        },
        select: {
          id: true,
          websiteUrl: true,
          apiKey: true,
          isActive: true,
        },
        take: 5,
      });
      
      console.log('[validateWorkspaceApiKey] No exact match found for API key:', trimmedKey.substring(0, 30) + '...');
      console.log('[validateWorkspaceApiKey] Key length:', trimmedKey.length);
      console.log('[validateWorkspaceApiKey] Found', similarKeys.length, 'similar keys (first 30 chars match)');
      
      if (similarKeys.length > 0) {
        console.log('[validateWorkspaceApiKey] Similar keys in database:');
        similarKeys.forEach((k, i) => {
          console.log(`  [${i}] URL: ${k.websiteUrl}, Key: ${k.apiKey.substring(0, 30)}...${k.apiKey.substring(k.apiKey.length - 10)}, Length: ${k.apiKey.length}, Active: ${k.isActive}`);
        });
      }
      
      return null;
    }

    if (!connection.isActive) {
      console.log('[validateWorkspaceApiKey] Connection found but is inactive');
      return null;
    }

    // Update last sync time
    await prisma.websiteConnection.update({
      where: { id: connection.id },
      data: { lastSyncAt: new Date() },
    }).catch((err) => {
      // Ignore errors updating lastSyncAt, but log for debugging
      console.warn('[validateWorkspaceApiKey] Failed to update lastSyncAt:', err.message);
    });

    console.log('[validateWorkspaceApiKey] Valid API key for workspace:', connection.workspaceId);
    return {
      workspaceId: connection.workspaceId,
      connectionId: connection.id,
    };
  } catch (error: any) {
    // Handle database errors (e.g., table doesn't exist)
    console.error('[validateWorkspaceApiKey] Database error:', error.message);
    
    // Check if it's a "relation does not exist" error
    if (error.message?.includes('does not exist') || error.message?.includes('relation') || error.code === '42P01') {
      console.error('[validateWorkspaceApiKey] WebsiteConnection table does not exist. Please run the database migration.');
      throw new Error('Database migration required: WebsiteConnection table does not exist. Please run the migration from server/prisma/migrations/20251220000000_add_website_connections/migration.sql');
    }
    
    // Re-throw other errors
    throw error;
  }
}

/**
 * Get workspaceId from authenticated user
 */
export async function getWorkspaceIdFromUser(userId: string): Promise<string | null> {
  const workspaceUser = await prisma.workspaceUser.findFirst({
    where: { userId },
    include: { workspace: true },
  });

  return workspaceUser?.workspaceId ?? null;
}

