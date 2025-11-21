# Fix Supabase Connection Error (Port 5432)

## Problem
Your application is trying to connect to Supabase on port 5432 but getting connection errors:
```
Can't reach database server at `aws-1-eu-west-3.pooler.supabase.com:5432`
```

## Understanding Supabase Connection Methods

Supabase now uses **Supavisor** for connection pooling:

1. **Supavisor Session Mode** - Port **5432** (what you're seeing in dashboard)
   - Supports prepared statements ✅
   - Works with Prisma ✅
   - IPv4 and IPv6 compatible

2. **Supavisor Transaction Mode** - Port **6543**
   - Does NOT support prepared statements ❌
   - Requires Prisma configuration changes
   - IPv4 and IPv6 compatible

3. **Direct Connection** - Port **5432**
   - Direct connection to database
   - Requires IPv6 support
   - Use `?sslmode=require`

## Solution: Fix Your Connection String

Since Supabase dashboard shows port **5432** for Session pooler, that's correct! The issue is likely missing connection parameters.

### Step 1: Get Your Connection String from Supabase

1. Go to Supabase Dashboard → Settings → Database
2. Select **Connection String** tab
3. Select **Session pooler** (Method)
4. Copy the connection string

It should look like:
```
postgresql://postgres.kklvoalugoviguvmxbxw:[YOUR-PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:5432/postgres
```

### Step 2: Add Required Parameters

**For Supavisor Session Mode (port 5432):**
Add these parameters to your connection string:
```
postgresql://postgres.kklvoalugoviguvmxbxw:[YOUR-PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
```

**Important parameters:**
- `?pgbouncer=true` - Enables connection pooling
- `&connection_limit=1` - Limits connections (important for serverless)

### Step 3: Update Railway Environment Variable

1. Go to Railway → Your Project → Backend Service
2. Click **Variables** tab
3. Find or create `DATABASE_URL`
4. Paste the connection string with parameters:
   ```
   postgresql://postgres.kklvoalugoviguvmxbxw:[YOUR-PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
   ```
5. **Replace `[YOUR-PASSWORD]`** with your actual database password
6. Save the variable

### Step 4: Verify Connection String Format

Your `DATABASE_URL` should look like this:

**✅ Correct Format (Supavisor Session Mode):**
```
postgresql://postgres.kklvoalugoviguvmxbxw:your_password_here@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
```

**❌ Common Issues:**
- Missing `?pgbouncer=true` parameter
- Missing `&connection_limit=1` parameter
- Wrong password
- Password contains special characters that need URL encoding

### Step 5: Restart Railway Service

After updating `DATABASE_URL`:
1. Railway should automatically redeploy
2. If not, go to **Deployments** → Click **Redeploy**
3. Wait for deployment to complete

### Step 6: Check Railway Logs

After redeploy, check Railway logs. You should see:
- ✅ `[Database] Connection successful`
- ✅ No database connection errors
- ✅ Server starting successfully

## Alternative: Use Direct Connection

If the pooler still doesn't work, try Direct Connection:

1. In Supabase Dashboard → Settings → Database
2. Select **Direct connection** (not Pooler)
3. Copy the connection string
4. It should look like:
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.kklvoalugoviguvmxbxw.supabase.co:5432/postgres?sslmode=require
   ```
5. Update `DATABASE_URL` in Railway with this value

**Note:** Direct connection requires IPv6 support. Railway should support this.

## Troubleshooting

### Issue: Still getting connection errors

1. **Verify Password:**
   - Make sure the password in the connection string is correct
   - Reset it in Supabase → Settings → Database if needed
   - If password contains special characters, URL encode them:
     - `@` becomes `%40`
     - `#` becomes `%23`
     - `%` becomes `%25`
     - etc.

2. **Check Database Status:**
   - Go to Supabase Dashboard
   - Make sure database is not paused
   - Check if there are any service issues

3. **Test Connection Locally:**
   - Copy the connection string to your local `server/.env`
   - Run: `cd server && npx prisma db pull`
   - If it works locally, the connection string is correct
   - If it fails locally, the connection string is wrong

4. **Check Railway Network:**
   - Railway should have IPv4 and IPv6 support
   - Supavisor Session Mode works with both

### Issue: Connection works locally but not on Railway

- Check Railway logs for specific error messages
- Verify environment variable is set correctly
- Make sure Railway service has network access
- Try Direct Connection instead of pooler

## Quick Checklist

- [ ] Got connection string from Supabase (Session pooler, port 5432)
- [ ] Added `?pgbouncer=true&connection_limit=1` parameters
- [ ] Replaced `[YOUR-PASSWORD]` with actual password
- [ ] URL encoded any special characters in password
- [ ] Updated `DATABASE_URL` in Railway Variables
- [ ] Railway service redeployed
- [ ] Checked logs - connection successful
- [ ] Frontend can now load data

## Still Having Issues?

If you're still getting errors after following these steps:

1. Check Railway logs for the exact error message
2. Verify the connection string format matches the examples above
3. Try Direct Connection as an alternative
4. Contact Supabase support if database appears to be down

