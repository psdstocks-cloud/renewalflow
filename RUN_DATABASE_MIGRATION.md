# Run Database Migration for Website Connections

## Problem
You're getting "Unauthorized" errors because the `WebsiteConnection` table doesn't exist in your database yet.

## Solution: Run the Migration

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New query**
5. Copy and paste the entire contents of `server/prisma/migrations/20251220000000_add_website_connections/migration.sql`
6. Click **Run** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned"

### Option 2: Using Prisma Migrate (Local)

If you have local access to the database:

```bash
cd server
npx prisma migrate deploy
```

## Verify Migration

After running the migration, verify the table exists:

1. In Supabase SQL Editor, run:
```sql
SELECT * FROM "WebsiteConnection" LIMIT 1;
```

If you get an error saying the table doesn't exist, the migration didn't run successfully.

## After Migration

1. Go to your RenewalFlow dashboard: https://renewalflow.pages.dev
2. Navigate to **Integrations** tab
3. Add your website URL and click **Connect Website**
4. Copy the generated API key
5. In WordPress, paste the API key in the plugin settings
6. Click **Test Connection** to verify it works
7. Try syncing users/points/charges

## Troubleshooting

### Still getting "Unauthorized"?
- Make sure you copied the API key exactly (no extra spaces)
- The API key should start with `artly_`
- Verify the API key exists in the database:
  ```sql
  SELECT * FROM "WebsiteConnection" WHERE "apiKey" = 'your-api-key-here';
  ```

### Migration fails?
- Check if the table already exists:
  ```sql
  SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_name = 'WebsiteConnection'
  );
  ```
- If it exists, you can skip the migration
- If it doesn't exist and migration fails, check the error message

