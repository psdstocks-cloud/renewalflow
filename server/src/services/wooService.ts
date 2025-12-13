import { prisma } from '../config/db';
import { getUnmaskedSettings } from './settingsService';
import { addDays } from 'date-fns';

export async function syncWooOrders() {
  const { wooSettings } = await getUnmaskedSettings();
  if (!wooSettings) {
    throw new Error('WooCommerce settings are missing');
  }

  // Debug Probe 2: Target specific user and specific Points API
  // User from screenshot: psdstockss@gmail.com
  const emailToFind = 'psdstockss@gmail.com';

  const searchUrl = `${wooSettings.url.replace(/\/$/, '')}/wp-json/wc/v3/customers?email=${emailToFind}`;
  const auth = Buffer.from(`${wooSettings.consumerKey}:${wooSettings.consumerSecret}`).toString('base64');
  const headers = { Authorization: `Basic ${auth}` };

  const searchRes = await fetch(searchUrl, { headers });
  if (!searchRes.ok) throw new Error(`Search failed: ${searchRes.status}`);

  const found = await searchRes.json();
  if (found.length === 0) throw new Error(`User ${emailToFind} not found via API.`);

  const user = found[0];
  const userId = user.id;

  // Try the official Points & Rewards endpoint
  const pointsUrl = `${wooSettings.url.replace(/\/$/, '')}/wp-json/wc-points-rewards/v1/customers/${userId}`;
  const pointsRes = await fetch(pointsUrl, { headers });

  const pointsStatus = pointsRes.status;
  const pointsData = await pointsRes.text(); // Get text in case it's not JSON

  throw new Error(`DEBUG 2: User ${userId} found. Points API (${pointsUrl}) Status: ${pointsStatus}. Body: ${pointsData.substring(0, 200)}`);
}
