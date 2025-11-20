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
    // Find the connection by API key
    const connection = await prisma.websiteConnection.findUnique({
      where: { apiKey },
      select: {
        id: true,
        workspaceId: true,
        isActive: true,
      },
    });

    if (!connection) {
      console.log('[validateWorkspaceApiKey] No connection found for API key:', apiKey.substring(0, 20) + '...');
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

