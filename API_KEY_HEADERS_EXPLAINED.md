# API Key Headers Explained

## Two Different API Keys for Different Purposes

### 1. `x-artly-secret` (WordPress Plugin - Workspace-Specific)

**Used by:** WordPress plugin for syncing data  
**Header name:** `x-artly-secret` (Express normalizes to lowercase)  
**Value:** Workspace-specific API key from RenewalFlow dashboard (starts with `artly_`)  
**Where to get it:** RenewalFlow dashboard → Integrations tab → Copy API key  
**Example:** `artly_cmi7hksdw00009k3k0f0fxcfn_2f189216e6576e27c44ee8341ba5a8713cf1c4a1a9b1937bdfa910e1076fb3dc`

**Current WordPress Plugin Implementation:**
```php
'headers' => array(
    'Content-Type'   => 'application/json',
    'x-artly-secret' => $api_secret,  // ✅ Correct
),
```

### 2. `x-admin-api-key` (Global Admin - Service-to-Service)

**Used by:** Admin operations, cron jobs, service-to-service calls  
**Header name:** `x-admin-api-key` (Express normalizes to lowercase)  
**Value:** Global `ADMIN_API_KEY` environment variable  
**Where to get it:** Generated and set in Railway environment variables  
**Example:** `f1eb40d8f55784a91d5c04edb053fa972d87fba479e87b7de83c89e202059acf`

**Usage Example:**
```bash
curl -H "x-admin-api-key: your_admin_key_here" \
     https://renewalflow-production.up.railway.app/api/health
```

## Why Two Different Keys?

- **`x-artly-secret`**: Workspace-specific, isolated per user/workspace, stored in database
- **`x-admin-api-key`**: Global admin key, for backend operations, stored in environment variables

## Current Implementation Status

✅ **WordPress Plugin** correctly uses `x-artly-secret`  
✅ **Backend** correctly validates `x-artly-secret` in `artlyAuth` middleware  
✅ **Backend** correctly validates `x-admin-api-key` in `authMiddleware` for admin routes

## Troubleshooting

### If you get "Unauthorized" with WordPress plugin:

1. **Check the header name** - Must be exactly `x-artly-secret` (lowercase)
2. **Check the API key** - Must match the one in RenewalFlow dashboard
3. **Check database migration** - `WebsiteConnection` table must exist
4. **Check Railway logs** - Look for `[artlyAuth]` messages to see what's happening

### Header Name Case Sensitivity

Express.js automatically normalizes HTTP headers to lowercase, so:
- `X-Artly-Secret` → becomes `x-artly-secret`
- `X-ARTLY-SECRET` → becomes `x-artly-secret`
- `x-artly-secret` → stays `x-artly-secret`

All of these will work, but the plugin should send it as `x-artly-secret` for consistency.

