import { prisma } from '../config/db';
import { getUnmaskedSettings } from './settingsService';
import { addDays } from 'date-fns';

export async function syncWooOrders() {
  const { wooSettings } = await getUnmaskedSettings();
  if (!wooSettings) {
    throw new Error('WooCommerce settings are missing');
  }

  // Debug Probe: Fetch 1 customer to find the Points Key
  const url = `${wooSettings.url.replace(/\/$/, '')}/wp-json/wc/v3/customers?per_page=1`;
  const auth = Buffer.from(`${wooSettings.consumerKey}:${wooSettings.consumerSecret}`).toString('base64');

  const response = await fetch(url, { headers: { Authorization: `Basic ${auth}` } });

  if (!response.ok) {
    throw new Error(`Sync failed: ${response.status} ${response.statusText}`);
  }

  const customers = await response.json();
  if (customers.length === 0) {
    throw new Error("Connected successfully, but found NO customers.");
  }

  const sample = customers[0];
  // Inspect meta_data to find points
  const metaKeys = sample.meta_data?.map((m: any) => `${m.key}: ${m.value}`).join(', ');

  // We intentionally throw this to see the data in the UI
  throw new Error(`DEBUG: Found Customer ${sample.email}. Keys: ${Object.keys(sample).join(', ')}. Meta: ${metaKeys}`);
}
