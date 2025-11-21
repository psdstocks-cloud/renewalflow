# Run Customer Table Migration

## Problem
The `Customer` table doesn't exist in your database, causing the sync to fail with:
```
The table `public.Customer` does not exist in the current database.
```

## Solution: Run the Migration

You need to run the migration that creates the `Customer` table and related tables.

### Step 1: Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"

### Step 2: Run the Migration

Copy and paste the entire contents of this file into the SQL Editor:
- `server/prisma/migrations/20251201000000_artly_reminder/migration.sql`

Then click "Run" to execute the migration.

### Step 3: Verify Tables Were Created

Run this query to verify the tables exist:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('Customer', 'Tenant', 'PointsBatch', 'PointsTransaction', 'WalletSnapshot', 'Subscription', 'ReminderRule', 'ReminderJob')
ORDER BY table_name;
```

You should see all 8 tables listed.

### Step 4: Test Sync Again

After running the migration, try syncing users again from WordPress. It should work now.

## What This Migration Creates

This migration creates the following tables needed for the Artly integration:
- `Tenant` - Multi-tenant support
- `Customer` - Stores WordPress users
- `PointsBatch` - Points batches for customers
- `PointsTransaction` - Points transaction history
- `WalletSnapshot` - Current points balance per customer
- `Subscription` - Subscription data
- `ReminderRule` - Reminder rules
- `ReminderJob` - Scheduled reminder jobs

## Alternative: Run All Migrations

If you want to ensure all migrations are up to date, you can also run Prisma migrations directly (if you have access to the database):

```bash
cd server
npx prisma migrate deploy
```

But since you're using Supabase, it's easier to run the SQL migration directly in the SQL Editor.

