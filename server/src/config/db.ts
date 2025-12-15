import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Parse connection limit from DATABASE_URL if present
function getConnectionLimit(): number {
  const dbUrl = env.DATABASE_URL;
  const connectionLimitMatch = dbUrl.match(/connection_limit=(\d+)/i);
  if (connectionLimitMatch) {
    return parseInt(connectionLimitMatch[1], 10);
  }
  // Default to 10 if not specified (for parallel execution support)
  return 10;
}

// Create PrismaClient instance with proper logging and connection pool configuration
export const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' 
    ? [{ emit: 'event', level: 'query' }, { emit: 'stdout', level: 'error' }, { emit: 'stdout', level: 'warn' }]
    : [{ emit: 'stdout', level: 'error' }],
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
});

// Check and warn about connection pool settings
const connectionLimit = getConnectionLimit();
if (connectionLimit < 5) {
  console.warn(`[Database] ⚠️  Connection pool limit is ${connectionLimit}. For parallel sync operations, consider increasing it to at least 5.`);
  console.warn(`[Database] Update your DATABASE_URL to include: ?connection_limit=10 (or higher)`);
}

// Export connection limit for use in other modules
export const CONNECTION_LIMIT = connectionLimit;

// Retry wrapper for database operations with connection pool error handling
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error: any) {
      lastError = error;
      
      // Check if it's a connection pool error
      const isPoolError = error.message?.includes('connection pool') || 
                         error.message?.includes('connection_limit') ||
                         error.message?.includes('Timed out fetching a new connection');
      
      if (isPoolError && attempt < maxRetries) {
        // Exponential backoff: 1s, 2s, 4s
        const delay = baseDelay * Math.pow(2, attempt);
        console.warn(`[Database] Connection pool error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // Not a pool error or max retries reached
      throw error;
    }
  }
  
  throw lastError || new Error('Operation failed after retries');
}

// Helper function to check database connection
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log('[Database] Connection successful');
    return true;
  } catch (error: any) {
    console.error('[Database] Connection failed:', error.message);
    
    // Provide helpful error messages based on the error
    if (error.message?.includes("Can't reach database server")) {
      const dbUrl = env.DATABASE_URL;
      const isPooler = dbUrl?.includes('pooler.supabase.com');
      const port = dbUrl?.match(/:(\d+)\//)?.[1];
      const hasParams = dbUrl?.includes('?');
      
      console.error('[Database] Connection Error Details:');
      console.error('  - Using pooler:', isPooler);
      console.error('  - Port in URL:', port);
      console.error('  - Has query parameters:', hasParams);
      
      if (isPooler) {
        // Supavisor Session Mode uses port 5432, Transaction Mode uses 6543
        if (port === '5432') {
          console.error('[Database] Using Supavisor Session Mode (port 5432)');
          if (!hasParams) {
            console.error('[Database] ⚠️  WARNING: Missing connection parameters!');
            console.error('[Database] Fix: Add connection parameters to DATABASE_URL');
            console.error('[Database] Example: ...postgres?pgbouncer=true&connection_limit=1');
          }
        } else if (port === '6543') {
          console.error('[Database] Using Supavisor Transaction Mode (port 6543)');
          console.error('[Database] Note: Transaction Mode does not support prepared statements');
          console.error('[Database] Prisma may need configuration adjustments');
        }
      } else {
        console.error('[Database] Using Direct Connection (port 5432)');
        if (!dbUrl?.includes('sslmode=require')) {
          console.error('[Database] ⚠️  WARNING: Direct connection should include ?sslmode=require');
        }
      }
      
      console.error('[Database] Common fixes:');
      console.error('  1. Verify database password is correct');
      console.error('  2. Check if database is paused in Supabase dashboard');
      console.error('  3. Ensure connection string includes required parameters');
      console.error('  4. Try Direct Connection if pooler fails');
    }
    
    return false;
  }
}

// Graceful shutdown
export async function disconnectDatabase(): Promise<void> {
  try {
    await prisma.$disconnect();
    console.log('[Database] Disconnected successfully');
  } catch (error) {
    console.error('[Database] Error disconnecting:', error);
  }
}

// Handle process termination
process.on('beforeExit', async () => {
  await disconnectDatabase();
});
