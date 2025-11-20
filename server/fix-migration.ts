import { PrismaClient } from '@prisma/client';
import { config } from 'dotenv';
config();

const prisma = new PrismaClient();

async function fixFailedMigration() {
  try {
    console.log('Checking migration status...');
    
    // Mark the failed migration as rolled back
    // This allows new migrations to be applied
    await prisma.$executeRawUnsafe(`
      UPDATE "_prisma_migrations" 
      SET "finished_at" = NOW(), 
          "rolled_back_at" = NOW(),
          "logs" = 'Manually rolled back due to failure'
      WHERE "migration_name" = '20251201000000_artly_reminder' 
        AND "finished_at" IS NULL;
    `);
    
    console.log('✅ Failed migration marked as rolled back');
    console.log('You can now run: npx prisma migrate deploy');
  } catch (error) {
    console.error('Error fixing migration:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixFailedMigration();

