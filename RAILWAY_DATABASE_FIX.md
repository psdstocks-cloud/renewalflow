# Fix Railway Database Connection Issue

## Problem
The backend is getting 500 errors because it can't connect to Supabase:
```
Can't reach database server at `aws-1-eu-west-3.pooler.supabase.com:5432`
```

## Solution: Update DATABASE_URL in Railway

### Step 1: Get Your Supabase Connection String

1. Go to your Supabase project: https://supabase.com/dashboard
2. Navigate to **Settings** → **Database**
3. Scroll down to **Connection string**
4. Select **Session mode** (not Transaction mode)
5. Copy the connection string - it should look like:
   ```
   postgresql://postgres.[project-ref]:[password]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
   ```

### Step 2: Update Railway Environment Variable

1. Go to your Railway project: https://railway.app
2. Click on your backend service
3. Go to the **Variables** tab
4. Find `DATABASE_URL` or create it if it doesn't exist
5. Paste your Supabase connection string
6. **Important**: Make sure the connection string includes:
   - `?pgbouncer=true` (for Session Pooler)
   - `&connection_limit=1` (recommended for serverless)
   - Or `?sslmode=require` if not using pooler

### Step 3: Verify the Connection String Format

Your `DATABASE_URL` should look like one of these:

**Option 1: Session Pooler (Recommended)**
```
postgresql://postgres.kklvoalugoviguvmxbxw:[YOUR-PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**Option 2: Direct Connection (if pooler doesn't work)**
```
postgresql://postgres:[YOUR-PASSWORD]@db.kklvoalugoviguvmxbxw.supabase.co:5432/postgres?sslmode=require
```

### Step 4: Restart Railway Service

After updating the `DATABASE_URL`:
1. Railway should automatically redeploy
2. If not, click **Deploy** → **Redeploy**
3. Check the logs to verify the connection works

### Step 5: Verify Connection

After redeploy, check Railway logs. You should see:
- ✅ No database connection errors
- ✅ Server starting successfully
- ✅ Prisma migrations running (if needed)

## Common Issues

### Issue: Still can't connect after updating
**Solution**: 
- Make sure you're using the **Session mode** connection string from Supabase
- Check that your Supabase database password is correct
- Verify the connection string doesn't have extra spaces or line breaks

### Issue: Connection works but queries fail
**Solution**:
- Make sure you're using the Session Pooler (`?pgbouncer=true`)
- The port should be `6543` for pooler, not `5432`

### Issue: "Too many connections" error
**Solution**:
- Add `&connection_limit=1` to your connection string
- This limits each Railway instance to 1 connection

## Quick Test

After fixing, the frontend should:
- ✅ Load without "Failed to load data from server" error
- ✅ Show subscribers, stats, and settings
- ✅ Allow you to create website connections

