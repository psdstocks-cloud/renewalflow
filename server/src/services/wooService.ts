import { prisma } from '../config/db';
import { getSettings } from './settingsService';
import { addDays } from 'date-fns';

interface WooOrder {
  id: number;
  total: string;
  currency: string;
  date_created: string;
  billing: {
    first_name: string;
    last_name: string;
    email: string;
  };
}

export async function syncWooOrders() {
  const { wooSettings } = await getSettings();
  if (!wooSettings) {
    throw new Error('WooCommerce settings are missing');
  }

  const url = `${wooSettings.url.replace(/\/$/, '')}/wp-json/wc/v3/orders?status=processing,completed&per_page=20`;
  const auth = Buffer.from(`${wooSettings.consumerKey}:${wooSettings.consumerSecret}`).toString('base64');

  const response = await fetch(url, {
    headers: {
      Authorization: `Basic ${auth}`
    }
  });

  if (!response.ok) {
    throw new Error(`WooCommerce sync failed: ${response.status} ${response.statusText}`);
  }

  const orders = (await response.json()) as WooOrder[];
  let created = 0;
  let updated = 0;

  for (const order of orders) {
    if (!order.billing.email) continue;
    const customerName = `${order.billing.first_name} ${order.billing.last_name}`.trim();
    const amount = parseFloat(order.total);
    const points = Math.floor(amount * wooSettings.pointsPerCurrency);
    const startDate = new Date(order.date_created);
    const endDate = addDays(startDate, 30);

    const existing = await prisma.subscriber.findUnique({ where: { email: order.billing.email } });
    if (existing) {
      await prisma.subscriber.update({
        where: { id: existing.id },
        data: {
          planName: existing.planName ?? 'Woo Order',
          amount,
          currency: order.currency ?? existing.currency,
          endDate: addDays(existing.endDate, 30),
          pointsRemaining: existing.pointsRemaining + points,
          status: 'ACTIVE'
        }
      });
      updated += 1;
    } else {
      await prisma.subscriber.create({
        data: {
          name: customerName || 'Woo Customer',
          email: order.billing.email,
          phone: undefined,
          planName: 'Woo Order',
          amount,
          currency: order.currency ?? 'EGP',
          pointsRemaining: points,
          status: 'ACTIVE',
          startDate,
          endDate,
          paymentLink: undefined
        }
      });
      created += 1;
    }
  }

  return { created, updated, totalOrdersProcessed: orders.length };
}
