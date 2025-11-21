# Fix Railway Database Connection Error

## Problem
Railway can't connect to Supabase database:
```
Can't reach database server at `aws-1-eu-west-3.pooler.supabase.com:5432`
```

## Solution: Update DATABASE_URL in Railway

### Step 1: Get Correct Supabase Connection String

1. **Go to Supabase Dashboard**: https://supabase.com/dashboard
2. **Select your project**: `kklvoalugoviguvmxbxw`
3. **Navigate to**: Settings → Database
4. **Scroll to**: Connection string section
5. **Select**: **Session pooler** (Method)
6. **Copy the connection string** - it should look like:
   ```
   postgresql://postgres.kklvoalugoviguvmxbxw:[YOUR-PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:5432/postgres
   ```

**Important Notes:**
- ✅ Supavisor Session Mode uses port **5432** (this is correct!)
- ✅ Must add `?pgbouncer=true&connection_limit=1` to the connection string
- ✅ Use **Session pooler**, not Transaction mode
- ✅ Session Mode supports prepared statements (works with Prisma)

### Step 2: Update Railway Environment Variable

1. **Go to Railway**: https://railway.app
2. **Select your project** → **Backend service**
3. **Click**: Variables tab
4. **Find or create**: `DATABASE_URL`
5. **Paste** the connection string from Step 1
6. **Save** the variable

### Step 3: Verify Connection String Format

Your `DATABASE_URL` should look like this:

**✅ Correct Format (Supavisor Session Mode):**
```
postgresql://postgres.kklvoalugoviguvmxbxw:[YOUR-PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
```

**❌ Wrong Format (what you might have now):**
```
postgresql://postgres.kklvoalugoviguvmxbxw:[PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:5432/postgres
```
- Missing `?pgbouncer=true` parameter
- Missing `&connection_limit=1` parameter
- Port 5432 is correct for Session Mode!

### Step 4: Restart Railway Service

After updating `DATABASE_URL`:
1. Railway should **automatically redeploy**
2. If not, go to **Deployments** → Click **Redeploy**
3. Wait for deployment to complete

### Step 5: Verify Connection

Check Railway logs. You should see:
- ✅ No database connection errors
- ✅ Server starting successfully
- ✅ "RenewalFlow API listening on 0.0.0.0:8080"

### Alternative: Direct Connection (if pooler doesn't work)

If the pooler still doesn't work, try direct connection:

1. In Supabase Dashboard → Settings → Database
2. Select **Direct connection** (not Pooler)
3. Copy the connection string
4. It should look like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.kklvoalugoviguvmxbxw.supabase.co:5432/postgres?sslmode=require
   ```
5. Update `DATABASE_URL` in Railway with this value

## Quick Checklist

- [ ] Got connection string from Supabase (Session pooler, port 5432)
- [ ] Added `?pgbouncer=true&connection_limit=1` to connection string
- [ ] Replaced `[YOUR-PASSWORD]` with actual database password
- [ ] Updated `DATABASE_URL` in Railway Variables
- [ ] Railway service redeployed
- [ ] Checked logs - connection successful
- [ ] Frontend can now load data

## Still Having Issues?

1. **Check Supabase Database Status**:
   - Go to Supabase Dashboard
   - Make sure database is not paused
   - Check if there are any service issues

2. **Verify Password**:
   - Make sure the password in the connection string is correct
   - You can reset it in Supabase → Settings → Database

3. **Test Connection Locally**:
   - Copy the connection string to your local `server/.env`
   - Run: `cd server && npx prisma db pull`
   - If it works locally, the connection string is correct

4. **Check Railway Logs**:
   - Go to Railway → Your Service → Logs
   - Look for any error messages
   - Share the error if it persists

