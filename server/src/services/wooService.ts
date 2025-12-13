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

export async function syncWooOrders() {
  const { wooSettings } = await getUnmaskedSettings();
  if (!wooSettings) {
    throw new Error('WooCommerce settings are missing');
  }

  // Use the custom endpoint we added to the plugin
  // Note: Standard WP API is /wp-json/, not /wp-json/wc/v3 for custom routes
  const baseUrl = `${wooSettings.url.replace(/\/$/, '')}/wp-json/artly/v1/sync`;
  const auth = Buffer.from(`${wooSettings.consumerKey}:${wooSettings.consumerSecret}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };

  let page = 1;
  const limit = 50;
  let created = 0;
  let updated = 0;
  let totalProcessed = 0;

  while (true) {
    const response = await fetch(`${baseUrl}?page=${page}&limit=${limit}`, { headers });

    if (!response.ok) {
      // Fallback: If 404, it means the user hasn't updated the plugin yet. Throw helpful error.
      if (response.status === 404) {
        throw new Error("Plugin Endpoint Not Found. Please update 'Artly Reminder Bridge' plugin on WordPress to the latest version provided.");
      }
      throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    const users = json.data as CustomSyncUser[];

    if (!users || users.length === 0) {
      break; // Done
    }

    for (const user of users) {
      if (!user.email) continue;

      // Use last order date or fallback to now if never purchased
      const lastOrderDate = user.last_order_date ? new Date(user.last_order_date) : new Date();
      const nextPaymentDate = addDays(lastOrderDate, 30); // Simple +30 logic

      // Format Points: Ensure it's a number
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
            // Keep existing plan name / status if possible, or defaulting?
            // We'll trust existing status unless we want to activate them
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
              planName: 'Standard', // Default
              amount: 0, // We don't know amount from this lightweight sync
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

    totalProcessed += users.length;

    // Check if we reached the end
    if (users.length < limit) {
      break;
    }

    page++;
  }

  return { created, updated, totalOrdersProcessed: totalProcessed };
}
