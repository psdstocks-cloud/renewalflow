# Cloudflare Pages Environment Variables

## Required Variables

Add these in **Cloudflare Pages → Your Project → Settings → Environment Variables**:

### Production Environment

```
VITE_API_BASE_URL=https://your-railway-backend.railway.app
VITE_SUPABASE_URL=https://kklvoalugoviguvmxbxw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtrbHZvYWx1Z292aWd1dm14Ynh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NTA4ODYsImV4cCI6MjA3OTEyNjg4Nn0.havfbyot24wae_d_d0mvFwzHJdzcSYFjVz5IrNYI9Hw
```

## How to Get Your Values

### 1. VITE_API_BASE_URL
- Go to Railway → Your Backend Service
- Copy the **Public URL** (e.g., `https://renewalflow-production.up.railway.app`)
- Use this as your `VITE_API_BASE_URL`

### 2. VITE_SUPABASE_URL
- Already known: `https://kklvoalugoviguvmxbxw.supabase.co`

### 3. VITE_SUPABASE_ANON_KEY
- Go to Supabase Dashboard → Settings → API
- Copy the `anon` `public` key
- It starts with `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## Quick Setup Steps

1. **Go to Cloudflare Pages Dashboard**
   - Navigate to your project: `renewalflow`

2. **Open Settings → Environment Variables**

3. **Add Each Variable** (for Production environment):
   - Click "Add variable"
   - Enter the variable name (e.g., `VITE_API_BASE_URL`)
   - Enter the value
   - Select "Production" environment
   - Click "Save"

4. **Repeat for all 3 variables**

5. **Redeploy**:
   - Go to Deployments tab
   - Click "Retry deployment" on the latest deployment
   - OR push a new commit to trigger a rebuild

## Important Notes

- ⚠️ **After adding/changing environment variables, you MUST redeploy**
- ✅ Variables prefixed with `VITE_` are exposed to the browser
- ✅ Make sure all variables are set for "Production" environment
- ✅ Double-check there are no extra spaces or quotes in the values

## Verification

After redeploying, check:
1. Visit https://renewalflow.pages.dev
2. Open Browser DevTools (F12) → Console
3. Should NOT see "Supabase environment variables are not fully configured"
4. Should NOT see "supabaseUrl is required" error

## Troubleshooting

### Still seeing errors after adding variables?

1. **Check variable names**: Must be exactly:
   - `VITE_API_BASE_URL` (not `API_BASE_URL`)
   - `VITE_SUPABASE_URL` (not `SUPABASE_URL`)
   - `VITE_SUPABASE_ANON_KEY` (not `SUPABASE_ANON_KEY`)

2. **Check environment**: Make sure variables are set for "Production"

3. **Redeploy**: Environment variables only take effect after redeployment

4. **Check build logs**: 
   - Go to Deployments → Latest deployment
   - Check if build succeeded
   - Look for any warnings about missing variables

