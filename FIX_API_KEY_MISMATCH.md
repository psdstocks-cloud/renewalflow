# Fix API Key Mismatch Issue

## Problem Identified

The API keys appear to match, but the database query doesn't find the row. This could mean:
1. The key in the database is slightly different (maybe regenerated?)
2. There's a character mismatch we can't see
3. The key needs to be refreshed

## Solution: Get the EXACT API Key from Database

### Step 1: Get the Full API Key from Database

Run this in Supabase SQL Editor:
```sql
SELECT 
  "id",
  "websiteUrl",
  "apiKey",  -- This will show the FULL key
  "isActive",
  "workspaceId"
FROM "WebsiteConnection"
WHERE "websiteUrl" = 'https://psdstocks.com/';
```

**Share the FULL `apiKey` value** (you can mask the middle part if needed, but we need to see the full length)

### Step 2: Compare Character by Character

The key you shared:
- WordPress: `artly_cmi7hksdw00009k3k0f0fxcfn_83e58ed3ee0dd457872080fbf38354eaa577e99279b9dd87d2e887fa5c902934`
- Dashboard: `artly_cmi7hksdw00009k3k0f0fxcfn_83e58ed3ee0dd457872080fbf38354eaa577e99279b9dd87d2e887fa5c902934`

**Length check:** Count the characters. It should be exactly the same length.

### Step 3: Check Railway Logs for API Key Validation

The Railway logs you shared don't show any `[artlyAuth]` messages, which means:
- Either no requests are reaching the backend
- Or the requests are failing before reaching the auth middleware

**Try this:**
1. In WordPress, click "Test Connection" button
2. Immediately check Railway logs (refresh the logs page)
3. Look for `[artlyAuth]` messages
4. Share those log lines

### Step 4: Quick Fix - Regenerate the API Key

If the keys don't match exactly, regenerate:

1. **In RenewalFlow Dashboard:**
   - Go to Integrations tab
   - Click "Regenerate Key" on your website connection
   - Copy the NEW API key

2. **In WordPress:**
   - Paste the NEW API key
   - Click "Save settings"
   - Click "Test Connection"

This ensures both sides have the exact same key.

## Most Likely Issue

Based on the image showing the database has a connection, but the query doesn't find it with the exact key, the API key in the database might have been regenerated or is slightly different.

**Quick test:** Run this to see ALL keys in the database:
```sql
SELECT "websiteUrl", "apiKey", "isActive" 
FROM "WebsiteConnection";
```

Then compare the full `apiKey` value with what you have in WordPress.

