# Debug "Unauthorized" Error - Information Needed

To fix this once and for all, please share the following information:

## 1. Check if Database Migration Was Run

**Run this in Supabase SQL Editor:**
```sql
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_name = 'WebsiteConnection'
);
```

**Expected result:** Should return `true` (or `t`)

**If it returns `false`:** The migration hasn't been run. Run the migration SQL from `server/prisma/migrations/20251220000000_add_website_connections/migration.sql`

---

## 2. Check if API Key Exists in Database

**Run this in Supabase SQL Editor (replace with your actual API key):**
```sql
SELECT * FROM "WebsiteConnection" 
WHERE "apiKey" = 'artly_cmi7hksdw00009k3k0f0fxcfn_2f189216e6576e27c44ee8341ba5a8713cf1c4a1a9b1937bdfa910e1076fb3dc';
```

**What to share:**
- Does it return a row? (Yes/No)
- If yes, what are the values for `isActive`, `workspaceId`?

---

## 3. Railway Backend Logs

**From Railway dashboard:**
1. Go to your backend service
2. Click on **Deployments** → Latest deployment → **View Logs**
3. Look for lines containing `[artlyAuth]` or `[validateWorkspaceApiKey]`
4. Copy the last 20-30 lines of logs

**What to look for:**
- `[artlyAuth] Validating API key: ...`
- `[artlyAuth] Invalid API key - not found in database or inactive`
- `[validateWorkspaceApiKey] No connection found for API key`
- Any database errors

---

## 4. WordPress Plugin API Key

**From WordPress admin:**
1. Go to WooCommerce → Artly Reminder Sync
2. Check the API Key field
3. Share the **first 30 characters** and **last 10 characters** (for security):
   - Example: `artly_cmi7hksdw00009k3k0f0fxcfn_...fb3dc`

**Also check:**
- Is there any whitespace before/after the key?
- Does it start with `artly_`?

---

## 5. RenewalFlow Dashboard API Key

**From RenewalFlow dashboard:**
1. Go to Integrations tab
2. Find your website connection
3. Share the **first 30 characters** and **last 10 characters** of the API key shown there
4. Verify it matches the one in WordPress

---

## 6. Test the API Key Directly

**Run this in Supabase SQL Editor:**
```sql
-- Get all website connections to see what's in the database
SELECT 
  "id",
  "websiteUrl",
  LEFT("apiKey", 30) || '...' || RIGHT("apiKey", 10) as "apiKeyPreview",
  "isActive",
  "workspaceId",
  "createdAt"
FROM "WebsiteConnection";
```

**Share the results** (you can mask sensitive parts)

---

## Quick Fix Checklist

Before sharing info, try these in order:

1. ✅ **Run the database migration** (if WebsiteConnection table doesn't exist)
2. ✅ **Verify API key in WordPress matches dashboard** (exact match, no spaces)
3. ✅ **Check Railway logs** for specific error messages
4. ✅ **Verify connection is active** in database (`isActive = true`)
5. ✅ **Check if workspaceId exists** in the WebsiteConnection record

---

## Most Common Issues

1. **Migration not run** → WebsiteConnection table doesn't exist
2. **API key mismatch** → Extra spaces or different key
3. **Connection inactive** → `isActive = false` in database
4. **Database connection issue** → Railway can't reach Supabase

