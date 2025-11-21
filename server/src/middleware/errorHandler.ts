import { NextFunction, Request, Response } from 'express';

export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  console.error('[ErrorHandler]', err);
  
  if (res.headersSent) {
    return;
  }

  const message = err instanceof Error ? err.message : 'Internal Server Error';
  
  // Check if it's a database connection error
  if (err instanceof Error && err.message?.includes("Can't reach database server")) {
    const dbUrl = process.env.DATABASE_URL || '';
    const isPooler = dbUrl.includes('pooler.supabase.com');
    const port = dbUrl.match(/:(\d+)\//)?.[1];
    const hasParams = dbUrl.includes('?');
    
    console.error('[ErrorHandler] Database connection error detected');
    console.error('  - Using pooler:', isPooler);
    console.error('  - Port in URL:', port);
    console.error('  - Has query parameters:', hasParams);
    
    // Provide helpful error message
    let helpfulMessage = 'Database connection failed. ';
    
    if (isPooler) {
      if (port === '5432') {
        // Supavisor Session Mode
        helpfulMessage += 'Using Supabase Supavisor Session Mode (port 5432). ';
        if (!hasParams) {
          helpfulMessage += 'The connection string may be missing required parameters. ';
          helpfulMessage += 'Try adding ?pgbouncer=true&connection_limit=1 to your DATABASE_URL. ';
        } else {
          helpfulMessage += 'Please verify: 1) Database password is correct, 2) Database is not paused, 3) Network connectivity. ';
        }
      } else if (port === '6543') {
        // Supavisor Transaction Mode
        helpfulMessage += 'Using Supabase Supavisor Transaction Mode (port 6543). ';
        helpfulMessage += 'Note: Transaction Mode does not support prepared statements. ';
        helpfulMessage += 'If using Prisma, you may need to configure it for Transaction Mode. ';
      }
      helpfulMessage += 'Please check your DATABASE_URL in Railway environment variables.';
    } else {
      // Direct connection
      helpfulMessage += 'Using Direct Connection. ';
      if (!dbUrl.includes('sslmode=require')) {
        helpfulMessage += 'Direct connections should include ?sslmode=require. ';
      }
      helpfulMessage += 'Please verify: 1) Database password is correct, 2) Database is not paused, 3) Network connectivity. ';
      helpfulMessage += 'Check Railway logs for more details.';
    }
    
    return res.status(500).json({ 
      message: helpfulMessage,
      error: 'Database connection error',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
  
  // Check for Prisma errors
  if (err instanceof Error && err.message?.includes('prisma.')) {
    console.error('[ErrorHandler] Prisma error detected');
    return res.status(500).json({ 
      message: 'Database operation failed',
      error: err.message,
      details: process.env.NODE_ENV === 'development' ? err.stack : undefined
    });
  }
  
  res.status(500).json({ message });
}
