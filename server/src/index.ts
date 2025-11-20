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
import { startCronJobs } from './services/cronScheduler';

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

app.use(healthRouter);
app.use(workspaceRouter);
app.use(websiteConnectionRouter);
app.use(subscriberRouter);
app.use(settingsRouter);
app.use(reminderRouter);
app.use(wooRouter);
app.use(cronRouter);
app.use(artlyRouter);

app.use(errorHandler);

const port = env.PORT || 4000;
const host = process.env.HOST || '0.0.0.0';

app.listen(port, host, () => {
  console.log(`RenewalFlow API listening on ${host}:${port}`);
});

startCronJobs();
