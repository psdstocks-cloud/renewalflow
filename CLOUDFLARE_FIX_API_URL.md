# Fix: API URL Configuration Issue

## Problem

You're seeing this error:
```
POST https://renewalflow.pages.dev/auth/renewalflow-production.up.railway.app/api/workspaces/bootstrap 405
```

This means `VITE_API_BASE_URL` is set incorrectly in Cloudflare Pages.

## Solution

### Step 1: Check Current Value

1. Go to **Cloudflare Pages → Your Project → Settings → Environment Variables**
2. Find `VITE_API_BASE_URL`
3. Check what value it has

### Step 2: Set Correct Value

The `VITE_API_BASE_URL` must be:
- ✅ A **full URL** starting with `https://`
- ✅ Your Railway backend URL
- ✅ **No trailing slash**

**Correct format:**
```
VITE_API_BASE_URL=https://renewalflow-production.up.railway.app
```

**Wrong formats (will cause errors):**
```
❌ VITE_API_BASE_URL=/auth/renewalflow-production.up.railway.app
❌ VITE_API_BASE_URL=https://renewalflow-production.up.railway.app/
❌ VITE_API_BASE_URL=renewalflow-production.up.railway.app
❌ VITE_API_BASE_URL=https://renewalflow-production.up.railway.app/api
```

### Step 3: Get Your Railway Backend URL

1. Go to **Railway Dashboard**
2. Click on your backend service
3. Go to **Settings → Networking**
4. Copy the **Public Domain** (e.g., `renewalflow-production.up.railway.app`)
5. Use: `https://renewalflow-production.up.railway.app` (add `https://` prefix)

### Step 4: Update in Cloudflare Pages

1. Go to **Cloudflare Pages → Settings → Environment Variables**
2. Find `VITE_API_BASE_URL`
3. Click **Edit**
4. Set value to: `https://your-actual-railway-url.railway.app`
5. Make sure it's set for **Production** environment
6. Click **Save**

### Step 5: Redeploy

1. Go to **Deployments** tab
2. Click **Retry deployment** on the latest deployment
3. Wait for build to complete

### Step 6: Verify

After redeploy, check browser console:
- Should see: `[apiFetch] Requesting: https://your-backend.railway.app/api/workspaces/bootstrap`
- Should NOT see: `https://renewalflow.pages.dev/auth/...`

## Supabase Configuration

**No changes needed in Supabase!** The Supabase auth is working correctly (you're able to sign in). The issue is only with the API URL configuration.

However, make sure you have:

1. **Supabase Auth enabled** for your project
2. **Email auth provider** enabled in Supabase Dashboard → Authentication → Providers
3. **Site URL** set in Supabase Dashboard → Authentication → URL Configuration:
   - Site URL: `https://renewalflow.pages.dev`
   - Redirect URLs: `https://renewalflow.pages.dev/**`

## Quick Checklist

- [ ] `VITE_API_BASE_URL` starts with `https://`
- [ ] `VITE_API_BASE_URL` has no trailing slash
- [ ] `VITE_API_BASE_URL` points to your Railway backend
- [ ] Variable is set for **Production** environment
- [ ] Redeployed after changing the variable
- [ ] Supabase Site URL is set to `https://renewalflow.pages.dev`

