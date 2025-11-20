import { prisma } from '../config/db';

const API_KEY_PREFIX = 'artly_';

/**
 * Validate API key and return workspaceId and connection info
 */
export async function validateWorkspaceApiKey(apiKey: string): Promise<{ workspaceId: string; connectionId: string } | null> {
  if (!apiKey.startsWith(API_KEY_PREFIX)) {
    return null;
  }

  // Find the connection by API key
  const connection = await prisma.websiteConnection.findUnique({
    where: { apiKey },
    select: {
      id: true,
      workspaceId: true,
      isActive: true,
    },
  });

  if (!connection || !connection.isActive) {
    return null;
  }

  // Update last sync time
  await prisma.websiteConnection.update({
    where: { id: connection.id },
    data: { lastSyncAt: new Date() },
  }).catch(() => {
    // Ignore errors updating lastSyncAt
  });

  return {
    workspaceId: connection.workspaceId,
    connectionId: connection.id,
  };
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

