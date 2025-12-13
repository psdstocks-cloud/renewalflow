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

export async function syncWooCustomersPage(page: number = 1) {
  const { wooSettings } = await getUnmaskedSettings();
  if (!wooSettings) {
    throw new Error('WooCommerce settings are missing');
  }

  // Use the custom endpoint we added to the plugin
  const baseUrl = `${wooSettings.url.replace(/\/$/, '')}/wp-json/artly/v1/sync`;
  const auth = Buffer.from(`${wooSettings.consumerKey}:${wooSettings.consumerSecret}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };

  const limit = 50;
  let created = 0;
  let updated = 0;

  const response = await fetch(`${baseUrl}?page=${page}&limit=${limit}&secret=renewalflow_secure_sync_2024`, { headers });

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

    const existing = await prisma.subscriber.findUnique({ where: { email: user.email } });

    if (existing) {
      await prisma.subscriber.update({
        where: { id: existing.id },
        data: {
          name: user.name || existing.name,
          pointsRemaining: points,
          startDate: lastOrderDate,
          endDate: nextPaymentDate,
        }
      });
      updated++;
    } else {
      const workspace = await prisma.workspace.findFirst();
      if (workspace) {
        await prisma.subscriber.create({
          data: {
            workspaceId: workspace.id,
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
        created++;
      }
    }
  }

  const totalUsers = meta.total_users || 0;
  const totalPages = Math.ceil(totalUsers / limit);

  return { created, updated, totalUsers, totalPages, currentPage: page };
}
