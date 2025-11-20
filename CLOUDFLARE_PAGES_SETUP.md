# Cloudflare Pages Deployment Setup

## Required Environment Variables

Add these environment variables in Cloudflare Pages → Settings → Environment Variables:

### Production Environment Variables

```
VITE_API_BASE_URL=https://your-railway-backend-url.railway.app
VITE_SUPABASE_URL=https://kklvoalugoviguvmxbxw.supabase.co
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

### How to Get Your Values

1. **VITE_API_BASE_URL**: 
   - Get your Railway backend URL (e.g., `https://renewalflow-production.up.railway.app`)
   - This should be your Railway service URL

2. **VITE_SUPABASE_URL**: 
   - Already set: `https://kklvoalugoviguvmxbxw.supabase.co`

3. **VITE_SUPABASE_ANON_KEY**: 
   - Get from Supabase Dashboard → Settings → API → `anon` `public` key
   - It should look like: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

## Build Settings

- **Build command**: `npm run build`
- **Build output directory**: `dist`
- **Root directory**: `/` (project root)

## Common Issues

### White Page / Blank Screen

1. **Check Browser Console**: Open DevTools (F12) → Console tab
   - Look for errors about missing environment variables
   - Look for module not found errors

2. **Verify Environment Variables**: 
   - Go to Cloudflare Pages → Your Project → Settings → Environment Variables
   - Ensure all three variables are set for "Production"
   - **Important**: After adding/changing env vars, you need to **redeploy**

3. **Check Build Logs**:
   - Go to Cloudflare Pages → Your Project → Deployments
   - Click on the latest deployment
   - Check if the build succeeded

4. **Verify API URL**:
   - Make sure `VITE_API_BASE_URL` points to your Railway backend
   - Test the backend URL directly: `https://your-backend.railway.app/health`
   - Should return: `{"status":"ok"}`

### CORS Errors

If you see CORS errors in the console:
- Make sure `FRONTEND_ORIGIN=https://renewalflow.pages.dev` is set in your Railway backend environment variables
- Redeploy the backend after adding this variable

### Routing Issues (404 on refresh)

The `public/_redirects` file should handle this, but if you still have issues:
- Ensure the file exists in the `public/` directory
- The file should contain: `/*    /index.html   200`

## Testing After Deployment

1. Visit: https://renewalflow.pages.dev
2. Open Browser DevTools (F12)
3. Check Console for errors
4. Check Network tab to see if API calls are being made
5. Try signing in to test the full flow

## Quick Fix Checklist

- [ ] Environment variables set in Cloudflare Pages
- [ ] Backend deployed and accessible
- [ ] `FRONTEND_ORIGIN` set in Railway backend
- [ ] Redeployed after adding environment variables
- [ ] Checked browser console for errors
- [ ] Verified `public/_redirects` file exists

