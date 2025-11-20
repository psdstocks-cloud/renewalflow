#!/bin/sh
set -e

echo "🚀 Starting RenewalFlow backend..."

# Change to server directory
cd "$(dirname "$0")"

# Function to resolve failed migration
resolve_failed_migration() {
  echo "📋 Attempting to resolve failed migration..."
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.\$executeRawUnsafe(\`
      UPDATE \"_prisma_migrations\" 
      SET \"finished_at\" = NOW(), 
          \"rolled_back_at\" = NOW(),
          \"logs\" = 'Auto-resolved: Migration rolled back due to failure'
      WHERE \"migration_name\" = '20251201000000_artly_reminder' 
        AND \"finished_at\" IS NULL;
    \`).then(() => {
      console.log('✅ Failed migration marked as rolled back');
      return prisma.\$disconnect();
    }).catch((e) => {
      console.error('⚠️  Could not resolve migration:', e.message);
      return prisma.\$disconnect();
    });
  " || echo "⚠️  Migration resolution script failed, continuing..."
}

# Try to resolve failed migrations first
resolve_failed_migration

# Run migrations
echo "🔄 Running database migrations..."
if npx prisma migrate deploy; then
  echo "✅ Migrations applied successfully"
else
  echo "❌ Migration failed. Attempting to resolve and retry..."
  resolve_failed_migration
  sleep 2
  if npx prisma migrate deploy; then
    echo "✅ Migrations applied after resolution"
  else
    echo "⚠️  Migrations still failing, but starting server anyway..."
    echo "⚠️  You may need to manually resolve the migration in Supabase"
  fi
fi

# Start the server
echo "✅ Starting server..."
exec npm start

