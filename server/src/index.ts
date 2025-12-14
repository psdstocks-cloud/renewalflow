import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { subscriberRouter } from './routes/subscribers';
import { settingsRouter } from './routes/settings';
import { reminderRouter } from './routes/reminders';
import { wooRouter } from './routes/woo';
import { cronRouter } from './routes/cron';
import { workspaceRouter } from './routes/workspaces';
import { errorHandler } from './middleware/errorHandler';
import { artlyRouter } from './routes/artly';
import { websiteConnectionRouter } from './routes/websiteConnections';
import webhookRouter from './routes/webhookRoutes';
import { startCronJobs } from './services/cronScheduler';
import { checkDatabaseConnection } from './config/db';

const app = express();

// CORS configuration - must be before routes
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:5173',
  'https://renewalflow.pages.dev',
  env.FRONTEND_ORIGIN ?? '',
].filter(Boolean);

// Log CORS configuration on startup
console.log('[CORS] Allowed origins:', allowedOrigins);
console.log('[CORS] FRONTEND_ORIGIN env:', env.FRONTEND_ORIGIN || 'NOT SET');

const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Log blocked origins for debugging
    console.log('[CORS] Blocked origin:', origin);
    callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-cron-key',
    'x-admin-api-key',
    'x-artly-secret',
  ],
  credentials: false,
  optionsSuccessStatus: 200, // Some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Handle preflight OPTIONS requests explicitly
app.options('*', cors(corsOptions));

app.use(express.json({ limit: '1mb' }));

// Log all incoming requests (for debugging)
app.use((req, res, next) => {
  console.log(`[Request] ${req.method} ${req.path}`);
  const artlySecret = Array.isArray(req.headers['x-artly-secret'])
    ? req.headers['x-artly-secret'][0]
    : req.headers['x-artly-secret'];
  console.log(`[Request] Headers:`, {
    'x-artly-secret': artlySecret ? artlySecret.substring(0, 30) + '...' : 'missing',
    'content-type': req.headers['content-type'],
    'origin': req.headers['origin'],
  });
  next();
});

// Register routes - artlyRouter should be early to avoid conflicts
app.use(healthRouter);
app.use(artlyRouter); // Move artlyRouter earlier to ensure it's checked first
app.use(workspaceRouter);
app.use(websiteConnectionRouter);
app.use('/api/webhooks', webhookRouter);
app.use(subscriberRouter);
app.use(settingsRouter);
app.use(reminderRouter);
app.use(wooRouter);
import { reportsRouter } from './routes/reports';
// ...
app.use(wooRouter);
app.use(cronRouter);
app.use(reportsRouter);

// Log registered routes for debugging
console.log('[Routes] Registered artlyRouter');
console.log('[Routes] Available artly routes: /artly/test, /artly/debug/key-check, /artly/sync/*');

// Add catch-all to see unmatched routes
app.use((req, res, next) => {
  console.log(`[Unmatched Route] ${req.method} ${req.path} - No handler found`);
  res.status(404).json({ message: 'Route not found', path: req.path });
});

app.use(errorHandler);

const port = env.PORT || 4000;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, async () => {
  console.log(`RenewalFlow API listening on ${host}:${port}`);

  // Check database connection on startup
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    console.error('[Startup] ⚠️  WARNING: Database connection failed on startup!');
    console.error('[Startup] The server will start but API requests may fail.');
    console.error('[Startup] Please check your DATABASE_URL in Railway environment variables.');
    console.error('[Startup] See FIX_RAILWAY_DATABASE_CONNECTION.md for instructions.');
  }
});

startCronJobs();
