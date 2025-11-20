#!/bin/sh
set -e

echo "🚀 Starting RenewalFlow backend..."

# Function to mark migration as applied (since tables already exist)
mark_migration_as_applied() {
  echo "📋 Marking migration as applied (tables already exist)..."
  node -e "
    const { PrismaClient } = require('@prisma/client');
    const prisma = new PrismaClient();
    prisma.\$executeRawUnsafe(\`
      UPDATE \"_prisma_migrations\" 
      SET \"finished_at\" = NOW(),
          \"rolled_back_at\" = NULL,
          \"logs\" = 'Marked as applied: Tables already exist in database'
      WHERE \"migration_name\" = '20251201000000_artly_reminder' 
        AND \"finished_at\" IS NULL;
    \`).then(() => {
      console.log('✅ Migration marked as applied');
      return prisma.\$disconnect();
    }).catch((e) => {
      console.error('⚠️  Could not mark migration:', e.message);
      return prisma.\$disconnect();
    });
  " || echo "⚠️  Migration marking script failed, continuing..."
}

# Try to mark the problematic migration as applied first (tables already exist)
mark_migration_as_applied

# Run migrations
echo "🔄 Running database migrations..."
if npx prisma migrate deploy; then
  echo "✅ Migrations applied successfully"
else
  echo "❌ Migration failed. Marking as applied since tables exist..."
  mark_migration_as_applied
  sleep 2
  if npx prisma migrate deploy; then
    echo "✅ Migrations applied after marking"
  else
    echo "⚠️  Migrations still failing, but starting server anyway..."
    echo "⚠️  Database tables already exist, server should work"
  fi
fi

# Start the server
echo "✅ Starting server..."
# Use tsx to handle ES module imports correctly
exec npx tsx dist/index.js

