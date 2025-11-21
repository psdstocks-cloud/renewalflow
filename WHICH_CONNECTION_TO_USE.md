# Which Supabase Connection Type Should You Use?

## Recommendation: **Session Pooler** ✅

For your setup (Prisma + Railway), use **Session Pooler** (port 5432).

## Connection Types Comparison

### 1. Session Pooler (Port 5432) ✅ **RECOMMENDED**

**Use this one!**

- ✅ **Supports prepared statements** - Prisma requires this
- ✅ **Connection pooling** - Better for serverless/Railway
- ✅ **IPv4 and IPv6 compatible**
- ✅ **Works with Prisma** - No configuration changes needed
- ✅ **Port 5432** - Standard PostgreSQL port

**Connection String Format:**
```
postgresql://postgres.kklvoalugoviguvmxbxw:[PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
```

**When to use:**
- ✅ Using Prisma (you are)
- ✅ Deploying on Railway/serverless (you are)
- ✅ Need connection pooling
- ✅ Need prepared statements support

---

### 2. Transaction Pooler (Port 6543) ❌ **NOT RECOMMENDED**

**Don't use this with Prisma!**

- ❌ **Does NOT support prepared statements** - Prisma won't work properly
- ✅ Connection pooling available
- ✅ IPv4 and IPv6 compatible
- ❌ Requires Prisma configuration changes
- ⚠️ Port 6543

**Connection String Format:**
```
postgresql://postgres.kklvoalugoviguvmxbxw:[PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1
```

**When to use:**
- ❌ NOT for Prisma
- ✅ For simple query libraries that don't use prepared statements
- ✅ For high-throughput transaction-based workloads

---

### 3. Direct Connection (Port 5432) ⚠️ **NOT RECOMMENDED**

**Use only if pooler doesn't work**

- ✅ Supports prepared statements
- ❌ **No connection pooling** - Can exhaust connections on Railway
- ❌ Requires IPv6 support
- ⚠️ Not optimized for serverless

**Connection String Format:**
```
postgresql://postgres:[PASSWORD]@db.kklvoalugoviguvmxbxw.supabase.co:5432/postgres?sslmode=require
```

**When to use:**
- ⚠️ Only if pooler connections fail
- ⚠️ For development/testing
- ❌ Not recommended for production on Railway

---

## Quick Decision Guide

**For Prisma + Railway:**
1. ✅ **First choice:** Session Pooler (port 5432)
2. ⚠️ **Fallback:** Direct Connection (if pooler fails)
3. ❌ **Don't use:** Transaction Pooler (port 6543)

## How to Get Session Pooler Connection String

1. Go to **Supabase Dashboard** → Your Project
2. Go to **Settings** → **Database**
3. Scroll to **Connection string** section
4. Select:
   - **Type:** URI
   - **Source:** Primary Database
   - **Method:** **Session pooler** ← Choose this!
5. Copy the connection string
6. Add parameters: `?pgbouncer=true&connection_limit=1`

**Final connection string should look like:**
```
postgresql://postgres.kklvoalugoviguvmxbxw:[YOUR-PASSWORD]@aws-1-eu-west-3.pooler.supabase.com:5432/postgres?pgbouncer=true&connection_limit=1
```

## Why Session Pooler?

1. **Prisma Compatibility:** Prisma uses prepared statements, which Session Pooler supports
2. **Connection Pooling:** Prevents connection exhaustion on Railway
3. **Serverless Optimized:** Designed for serverless/server environments
4. **No Code Changes:** Works with your existing Prisma setup

## Summary

**✅ Use: Session Pooler (port 5432)**
- Best for Prisma
- Best for Railway
- Supports prepared statements
- Has connection pooling

**❌ Don't use: Transaction Pooler (port 6543)**
- Doesn't support prepared statements
- Prisma won't work properly

**⚠️ Fallback: Direct Connection**
- Only if pooler fails
- No pooling (less efficient)

