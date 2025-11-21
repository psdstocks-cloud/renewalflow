# Railway Database Connection Strings

## Password: `fDs7f551qxlo4scS`

## Option 1: Direct Connection (What you requested)

```
postgresql://postgres:fDs7f551qxlo4scS@db.kklvoalugoviguvmxbxw.supabase.co:5432/postgres?sslmode=require
```

**Use this if:** Session Pooler doesn't work or you prefer direct connection.

---

## Option 2: Session Pooler (RECOMMENDED for Railway + Prisma)

```
postgresql://postgres.kklvoalugoviguvmxbxw:fDs7f551qxlo4scS@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
```

**Use this if:** You want connection pooling (better for Railway/serverless).

---

## How to Update Railway

1. Go to **Railway** → Your Project → Backend Service
2. Click **Variables** tab
3. Find or create `DATABASE_URL`
4. Paste one of the connection strings above
5. Click **Save**
6. Railway will automatically redeploy

---

## Connection Test Results

⚠️ **Both connections failed in local test** - This likely means:
- Database might be **paused** in Supabase (most common)
- Need to **resume** database in Supabase Dashboard
- Or network connectivity issue

**Action:** Check Supabase Dashboard → Your Project → Make sure database is **Active** (not paused)

---

## Recommendation

**Start with Session Pooler** (Option 2) because:
- ✅ Better for Railway/serverless
- ✅ Connection pooling prevents connection exhaustion
- ✅ Works with Prisma prepared statements

**Fallback to Direct Connection** (Option 1) if Session Pooler doesn't work.

