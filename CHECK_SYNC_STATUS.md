# How to Check if Points Sync is Working

## Method 1: Check Server Logs (Recommended)

After running the sync from WordPress, check your server logs. You should see:

```
[artly/sync/points-balances] Received balance sync request
[processPointsBalances] Parsed X balances for tenant: ...
[processPointsBalances] Processed 50/X balances...
[processPointsBalances] Completed: X balances updated
```

If you see errors, they will be logged with details.

## Method 2: Use the Debug Endpoint

1. Get your API key from WordPress admin → WooCommerce → Artly Reminder Sync
2. Make a GET request to your API:

```bash
curl -H "x-artly-secret: YOUR_API_KEY" \
  https://your-api-url.com/artly/debug/balances
```

Or use a tool like Postman/Insomnia with:
- **URL**: `GET https://your-api-url.com/artly/debug/balances`
- **Header**: `x-artly-secret: YOUR_API_KEY`

The response will show:
- Total snapshots synced
- Customers with points > 0
- Recent balances with details

## Method 3: Check WordPress Plugin Logs

In WordPress, check the plugin logs:
1. Go to WooCommerce → Artly Reminder Sync
2. Look at the "Last Sync Result" section
3. Check for success messages like: "Successfully synced X points balances"

## Method 4: Check Database Directly

If you have database access, run:

```sql
-- Check total wallet snapshots
SELECT COUNT(*) as total_snapshots,
       COUNT(CASE WHEN "pointsBalance" > 0 THEN 1 END) as customers_with_points,
       SUM("pointsBalance") as total_points
FROM "WalletSnapshot"
WHERE "tenantId" = 'your-workspace-id';

-- Check recent snapshots
SELECT 
  c.email,
  c."externalUserId" as wp_user_id,
  ws."pointsBalance",
  ws."updatedAt"
FROM "WalletSnapshot" ws
JOIN "Customer" c ON c.id = ws."customerId"
WHERE ws."tenantId" = 'your-workspace-id'
ORDER BY ws."updatedAt" DESC
LIMIT 20;
```

## Method 5: Check in Dashboard

1. After syncing balances, go to your RenewalFlow dashboard
2. Click "Sync from WordPress" in the Subscribers tab
3. This will sync customers to subscribers and show their points
4. Check if subscribers now have points displayed

## Troubleshooting

### No balances found:
- Check if WordPress plugin is configured correctly
- Verify API URL and API key match
- Check WordPress error logs
- Verify WooCommerce Points & Rewards plugin is active

### Sync fails:
- Check server logs for error messages
- Verify API key is correct
- Check network connectivity between WordPress and API
- Ensure database connection is working

### Points not showing in dashboard:
- Run "Sync from WordPress" after syncing balances
- This syncs customers to subscribers and updates points

