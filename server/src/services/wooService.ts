import { prisma } from '../config/db';
import { getUnmaskedSettings } from './settingsService';
import { addDays } from 'date-fns';

interface CustomSyncUser {
  id: number;
  email: string;
  name: string;
  points: number;
  last_order_date: string | null;
}

export async function syncWooCustomersPage(page: number = 1, workspaceId?: string, fetchHistory: boolean = false) {
  // Resolve workspace ID
  let wsId = workspaceId;
  if (!wsId) {
    const defaultWs = await prisma.workspace.findFirst();
    if (!defaultWs) throw new Error('No workspace found');
    wsId = defaultWs.id;
  }

  const { wooSettings } = await getUnmaskedSettings(wsId);
  if (!wooSettings) {
    throw new Error('WooCommerce settings are missing');
  }

  // Use the custom endpoint we added to the plugin
  const baseUrl = `${wooSettings.url.replace(/\/$/, '')}/wp-json/artly/v1/sync`;
  const auth = Buffer.from(`${wooSettings.consumerKey}:${wooSettings.consumerSecret}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };

  const limit = 10;
  let created = 0;
  let updated = 0;

  console.log(`[Sync] Fetching page ${page} with limit ${limit}`);

  // Add secret key for security
  let url = `${baseUrl}?page=${page}&limit=${limit}&secret=renewalflow_secure_sync_2024`;

  if (wooSettings.lastSync) {
    console.log(`[Sync] Found lastSync: ${wooSettings.lastSync}`);
    url += `&updated_after=${encodeURIComponent(wooSettings.lastSync)}`;
  } else {
    console.log(`[Sync] No lastSync found in settings. Performing full sync.`);
  }

  console.log(`[Sync] Fetching: ${url.replace('renewalflow_secure_sync_2024', 'REDACTED')}`);

  const response = await fetch(url, { headers });
  console.log(`[Sync] Response status: ${response.status}`);

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("Plugin Endpoint Not Found. Please update 'Artly Reminder Bridge' plugin on WordPress.");
    }
    throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  const users = json.data as CustomSyncUser[];
  const meta = json.meta as { page: number; limit: number; total_users: number };

  if (!users) {
    return { created: 0, updated: 0, totalUsers: 0, totalPages: 0, currentPage: page };
  }

  for (const user of users) {
    if (!user.email) continue;

    const lastOrderDate = user.last_order_date ? new Date(user.last_order_date) : new Date();
    const nextPaymentDate = addDays(lastOrderDate, 30);
    const points = typeof user.points === 'number' ? user.points : parseInt(user.points || '0', 10);

    // Ensure email is unique within the WORKSPACE?
    // The schema says `email` is `@unique` globally on Subscriber model?
    // `email String @unique`. Yes, global unique constraint.
    // This assumes one subscriber email can only exist in ONE workspace.
    // That might be a limitation, but for now we follow the schema.
    const existing = await prisma.subscriber.findUnique({ where: { email: user.email } });

    if (existing) {
      // If existing subscriber belongs to different workspace, we might have an issue strictly speaking,
      // but we will update it.
      await prisma.subscriber.update({
        where: { id: existing.id },
        data: {
          name: user.name || existing.name,
          pointsRemaining: points,
          startDate: lastOrderDate,
          endDate: nextPaymentDate,
          // We don't change workspaceId on update
        }
      });
      // Update history if requested
      if (fetchHistory) {
        await processUserHistory(existing.id, user.email, wsId);
      }
      updated++;
    } else {
      const newSub = await prisma.subscriber.create({
        data: {
          workspaceId: wsId,
          email: user.email,
          name: user.name || 'Woo Customer',
          planName: 'Standard',
          amount: 0,
          currency: 'EGP',
          status: 'ACTIVE',
          pointsRemaining: points,
          startDate: lastOrderDate,
          endDate: nextPaymentDate
        }
      });
      // Initial history fetch for new user
      if (fetchHistory) {
        await processUserHistory(newSub.id, user.email, wsId);
      }
      created++;
    }
  }

  const totalUsers = meta.total_users || 0;
  const totalPages = Math.ceil(totalUsers / limit);

  return { created, updated, totalUsers, totalPages, currentPage: page };
}

export async function processUserHistory(subscriberId: string, email: string, wsId: string) {
  let created = 0;
  try {
    const history = await fetchUserPointsHistory(email, wsId);

    if (history.length > 0) {
      for (const entry of history) {
        // Prevent duplicates by checking externalId (constructed from log ID)
        const externalId = `woo_${entry.id}`;

        // Check if exists
        const exists = await prisma.pointHistory.findUnique({
          where: { externalId }
        });

        if (!exists) {
          await prisma.pointHistory.create({
            data: {
              subscriberId: subscriberId,
              change: typeof entry.points === 'number' ? entry.points : parseInt(entry.points, 10),
              reason: entry.event || 'WooCommerce Event',
              date: new Date(entry.date),
              externalId: externalId
            }
          });
          created++;
        }
      }
    }
  } catch (err) {
    console.error(`[History Core] Failed for ${email}:`, err);
  }
  return created;
}

export async function syncAllWooCustomers(workspaceId?: string) {
  let page = 1;
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalProcessed = 0;

  while (true) {
    const res = await syncWooCustomersPage(page, workspaceId);
    totalCreated += res.created;
    totalUpdated += res.updated;
    totalProcessed += 50; // approximate, or we can use users length if we exposed it

    if (page >= res.totalPages || res.totalPages === 0) {
      break;
    }
    page++;
    // Add small delay to be nice to the server in a tight loop
    await new Promise(r => setTimeout(r, 500));
  }

  return { created: totalCreated, updated: totalUpdated, totalOrdersProcessed: totalProcessed };
}

export interface PointLogEntry {
  id: number;
  user_id: number;
  date: string;
  points: string | number;
  event: string;
  order_id: string | number | null;
  admin_user_id: string | number | null;
  data: any;
}

export async function fetchUserPointsHistory(email: string, workspaceId?: string): Promise<PointLogEntry[]> {
  // Resolve workspace ID
  let wsId = workspaceId;
  if (!wsId) {
    const defaultWs = await prisma.workspace.findFirst();
    if (!defaultWs) throw new Error('No workspace found');
    wsId = defaultWs.id;
  }

  const { wooSettings } = await getUnmaskedSettings(wsId);
  if (!wooSettings) {
    throw new Error('WooCommerce settings are missing');
  }

  // Use the custom endpoint we added to the plugin
  const baseUrl = `${wooSettings.url.replace(/\/$/, '')}/wp-json/artly/v1/user-history`;
  const auth = Buffer.from(`${wooSettings.consumerKey}:${wooSettings.consumerSecret}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };

  const url = `${baseUrl}?email=${encodeURIComponent(email)}&secret=renewalflow_secure_sync_2024`;

  try {
    const response = await fetch(url, { headers });

    if (!response.ok) {
      console.warn(`[Woo] History fetch failed: ${response.status} ${response.statusText} `);
      return [];
    }

    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (err) {
    console.error(`[Woo] History fetch error: `, err);
    return [];
  }
}


export async function backfillHistoryBatch(page: number, limit: number, workspaceId?: string) {
  // Resolve workspace ID
  let wsId = workspaceId;
  if (!wsId) {
    const defaultWs = await prisma.workspace.findFirst();
    if (!defaultWs) throw new Error('No workspace found');
    wsId = defaultWs.id;
  }

  // Count total for progress calculation
  const totalSubscribers = await prisma.subscriber.count({ where: { workspaceId: wsId } });
  const totalPages = Math.ceil(totalSubscribers / limit);

  // Get batch
  const subscribers = await prisma.subscriber.findMany({
    where: { workspaceId: wsId },
    select: { id: true, email: true },
    skip: (page - 1) * limit,
    take: limit,
    orderBy: { id: 'asc' } // Ensure consistent ordering
  });

  console.log(`[Backfill] Processing batch ${page}/${totalPages} (${subscribers.length} users)...`);

  let processed = 0;
  let historyEntries = 0;

  for (const sub of subscribers) {
    try {
      const count = await processUserHistory(sub.id, sub.email, wsId);
      historyEntries += count;
      processed++;

      // Rate limit - wait 100ms between user fetches (reduced since batch is small)
      await new Promise(r => setTimeout(r, 100));

    } catch (err) {
      console.error(`[Backfill] Failed for ${sub.email}:`, err);
    }
  }

  return {
    processed,
    historyEntriesCreated: historyEntries,
    pagination: {
      page,
      limit,
      totalSubscribers,
      totalPages,
      hasMore: page < totalPages
    }
  };
}
