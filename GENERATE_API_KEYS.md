# How to Generate and Set ADMIN_API_KEY

## What is ADMIN_API_KEY?

`ADMIN_API_KEY` is used for service-to-service authentication. It allows:
- Admin operations without user authentication
- Cron job authentication (if `CRON_API_KEY` is not set separately)
- Backend-to-backend API calls

## Generate a Secure API Key

### Option 1: Using Node.js (Recommended)
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

This will output a 64-character hexadecimal string like:
```
a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
```

### Option 2: Using OpenSSL
```bash
openssl rand -hex 32
```

### Option 3: Using Online Generator
You can use any secure random string generator, but make sure it's at least 32 bytes (64 hex characters).

## Where to Set ADMIN_API_KEY

### 1. Local Development (server/.env)

Add this line to your `server/.env` file:
```bash
ADMIN_API_KEY=your_generated_key_here
```

### 2. Railway (Production)

1. Go to your Railway project: https://railway.app
2. Click on your backend service
3. Go to the **Variables** tab
4. Click **New Variable**
5. Name: `ADMIN_API_KEY`
6. Value: Paste your generated key
7. Click **Add**
8. Railway will automatically redeploy

## Optional: CRON_API_KEY

If you want a separate key for cron jobs (recommended), generate another key and set it as `CRON_API_KEY` in Railway. If not set, cron jobs will use `ADMIN_API_KEY`.

## Security Best Practices

1. **Never commit API keys to Git** - They're already in `.gitignore`
2. **Use different keys for different environments** (dev vs production)
3. **Rotate keys periodically** - Generate new keys and update them
4. **Keep keys secret** - Don't share them in screenshots or logs

## Example .env Entry

```bash
ADMIN_API_KEY=a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456
CRON_API_KEY=f6e5d4c3b2a198765432109876543210fedcba9876543210fedcba9876543210
```

## Verify It's Working

After setting the key, you can test it by making a request with the header:
```bash
curl -H "x-admin-api-key: your_key_here" https://renewalflow-production.up.railway.app/api/health
```

You should get a successful response.

