# Railway Environment Variables

Copy these environment variables to your Railway project settings.

## How to Get Your Values

Run this command in your terminal from the project root:

```bash
cd server && cat .env | grep -E "^(DATABASE_URL|PORT|ADMIN_API_KEY|CRON_API_KEY|SMTP_|SUPABASE_|FRONTEND_ORIGIN|GEMINI_API_KEY|ARTLY_API_SECRET)="
```

Or check your `server/.env` file manually.

## Required Environment Variables

### Database
```
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@db.kklvoalugoviguvmxbxw.supabase.co:5432/postgres?sslmode=require
```
*(Use your Supabase connection string - Session Pooler or Direct)*

### Server
```
PORT=$PORT
```
*(Railway sets this automatically - your code should use `process.env.PORT`)*

### API Keys
```
ADMIN_API_KEY=your_admin_api_key_here
CRON_API_KEY=your_cron_api_key_here
GEMINI_API_KEY=your_gemini_api_key_here
ARTLY_API_SECRET=your_artly_api_secret_here
```

### Supabase
```
SUPABASE_URL=https://kklvoalugoviguvmxbxw.supabase.co
SUPABASE_KEY=your_service_role_key_here
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_JWT_SECRET=your_jwt_secret_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### SMTP (Email)
```
SMTP_HOST=smtp-relay.brevo.com
SMTP_PORT=587
SMTP_USER=your_brevo_smtp_user
SMTP_PASS=your_brevo_smtp_password
SMTP_FROM_EMAIL=your_from_email@example.com
SMTP_FROM_NAME=RenewalFlow
```

### Frontend
```
FRONTEND_ORIGIN=https://your-frontend-domain.com
```
*(Set this to your production frontend URL, e.g., https://renewalflow.vercel.app)*

---

## Quick Copy Command

If you have access to your `.env` file, you can extract all values at once:

```bash
cd server
cat .env | grep -E "^(DATABASE_URL|ADMIN_API_KEY|CRON_API_KEY|SMTP_|SUPABASE_|FRONTEND_ORIGIN|GEMINI_API_KEY|ARTLY_API_SECRET)="
```

Then copy each line to Railway's environment variables section.

## Railway Setup Steps

1. Go to your Railway project → Service → Variables
2. Click "New Variable" for each variable above
3. Paste the name and value
4. For `PORT`, Railway will set it automatically (you can skip this one)
5. Save and redeploy

