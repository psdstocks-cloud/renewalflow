import { prisma } from '../config/db';
import { getUnmaskedSettings } from './settingsService';
import { addDays } from 'date-fns';

export async function syncWooOrders() {
  const { wooSettings } = await getUnmaskedSettings();
  if (!wooSettings) {
    throw new Error('WooCommerce settings are missing');
  }

  // Debug Probe 3: Check Points Plugin Namespace directly
  const pointsUrl = `${wooSettings.url.replace(/\/$/, '')}/wp-json/wc-points-rewards/v1/customers`;
  const auth = Buffer.from(`${wooSettings.consumerKey}:${wooSettings.consumerSecret}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };

  const res = await fetch(pointsUrl, { headers });
  const status = res.status;
  const text = await res.text(); // Get raw text to see errors/HTML/JSON

  throw new Error(`DEBUG 3: Points API (${pointsUrl}) Status: ${status}. Body: ${text.substring(0, 300)}`);
}
