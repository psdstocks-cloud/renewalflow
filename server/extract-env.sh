#!/bin/bash
# Script to extract environment variables for Railway deployment

if [ ! -f .env ]; then
  echo "Error: .env file not found in server directory"
  exit 1
fi

echo "=== Environment Variables for Railway ==="
echo ""
echo "Copy these to Railway's environment variables:"
echo ""

# Read .env file and extract relevant variables
grep -E "^(DATABASE_URL|PORT|ADMIN_API_KEY|CRON_API_KEY|SMTP_HOST|SMTP_PORT|SMTP_USER|SMTP_PASS|SMTP_FROM_EMAIL|SMTP_FROM_NAME|SUPABASE_KEY|SUPABASE_ANON_KEY|SUPABASE_JWT_SECRET|SUPABASE_URL|SUPABASE_SERVICE_ROLE_KEY|FRONTEND_ORIGIN|GEMINI_API_KEY|ARTLY_API_SECRET)=" .env | while IFS='=' read -r key value; do
  # Remove quotes if present
  value=$(echo "$value" | sed -e 's/^"//' -e 's/"$//' -e "s/^'//" -e "s/'$//")
  echo "$key=$value"
done

echo ""
echo "=== Note ==="
echo "PORT will be set automatically by Railway (use \$PORT in your code if needed)"
echo "Make sure to set FRONTEND_ORIGIN to your production frontend URL"

