# Run Last Purchase Date Migration

## Problem
You're getting this error:
```
The column `Subscriber.lastPurchaseDate` does not exist in the current database.
```

## Solution: Run the Migration

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase project: https://supabase.com/dashboard
2. Select your project
3. Go to **SQL Editor** (left sidebar)
4. Click **New query**
5. Copy and paste the following SQL:

```sql
-- AlterTable
ALTER TABLE "Subscriber" ADD COLUMN "lastPurchaseDate" TIMESTAMP(3);
```

6. Click **Run** (or press Cmd/Ctrl + Enter)
7. You should see "Success. No rows returned"

### Option 2: Using Railway CLI (If you have Railway CLI installed)

```bash
cd server
railway run npx prisma migrate deploy
```

### Option 3: Using Prisma Migrate (Local with DATABASE_URL)

If you have the `DATABASE_URL` environment variable set locally:

```bash
cd server
npx prisma migrate deploy
```

## Verify Migration

After running the migration, verify the column exists:

1. In Supabase SQL Editor, run:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'Subscriber' 
  AND column_name = 'lastPurchaseDate';
```

You should see the `lastPurchaseDate` column with type `timestamp without time zone`.

## After Migration

1. Refresh your RenewalFlow dashboard
2. The error should be gone
3. When you sync from WordPress, the last purchase date will be populated automatically
4. The end date will be calculated as 30 days from the last purchase date

## Troubleshooting

### Migration fails with "column already exists"?
- The column might already exist. You can skip this migration.

### Still getting the error?
- Make sure you ran the SQL in the correct database
- Check that you're connected to the production database (not a local one)
- Try refreshing the page after running the migration

