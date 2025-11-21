# Test Connection Debugging Guide

## Problem
When clicking "Test Connection" in WordPress, there are NO logs in Railway showing `[artlyAuth]`. This means the request isn't reaching the backend.

## Step 1: Verify Request Reaches Server

After Railway redeploys, test if requests can reach the server:

```bash
curl https://renewalflow-production.up.railway.app/artly/test
```

**Expected:** Should return JSON with `message: "Test endpoint reached successfully!"`

If this fails, the issue is network/connectivity.

## Step 2: Test with API Key Header

```bash
curl -H "x-artly-secret: artly_cmi7hksdw00009k3k0f0fxcfn_83e58ed3ee0dd457872080fbf38354eaa577e99279b9dd87d2e887fa5c902934" \
     https://renewalflow-production.up.railway.app/artly/debug/key-check
```

**Expected:** Should return JSON showing if the key matches the database.

## Step 3: Check WordPress Plugin URL

In WordPress admin, verify:
1. **Reminder Engine URL** is set to: `https://renewalflow-production.up.railway.app`
2. **API Secret** matches the key from RenewalFlow dashboard exactly

## Step 4: Check Railway Logs

After clicking "Test Connection" in WordPress:
1. Go to Railway → Your Service → Logs
2. Look for:
   - `[Request] POST /artly/sync/users` - Shows request reached server
   - `[artlyAuth] ===== MIDDLEWARE CALLED =====` - Shows auth middleware was called
   - Any error messages

## Step 5: Common Issues

### Issue 1: No logs at all
**Cause:** Request isn't reaching Railway
**Solutions:**
- Check WordPress can reach the internet
- Verify Railway URL is correct (no trailing slash)
- Check if WordPress firewall is blocking outbound requests

### Issue 2: CORS errors
**Cause:** WordPress origin not in allowed list
**Solution:** Railway logs will show `[CORS] Blocked origin: ...`

### Issue 3: 401 Unauthorized
**Cause:** API key doesn't match
**Solution:** Use `/artly/debug/key-check` endpoint to compare keys

## Step 6: Manual Test from WordPress

You can also test directly from WordPress by adding this to `functions.php` temporarily:

```php
add_action('admin_init', function() {
    if (isset($_GET['test_artly_connection'])) {
        $api_url = get_option('_artly_reminder_engine_url');
        $api_secret = get_option('_artly_reminder_engine_secret');
        
        $response = wp_remote_get($api_url . '/artly/test', [
            'headers' => [
                'x-artly-secret' => $api_secret,
            ],
        ]);
        
        if (is_wp_error($response)) {
            wp_die('Error: ' . $response->get_error_message());
        }
        
        wp_die('<pre>' . print_r(wp_remote_retrieve_body($response), true) . '</pre>');
    }
});
```

Then visit: `https://yourwordpress.com/wp-admin/?test_artly_connection=1`

