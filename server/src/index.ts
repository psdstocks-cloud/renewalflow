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
const corsOptions = {
  origin: [
    'http://localhost:3000',
    'http://localhost:5173',
    env.FRONTEND_ORIGIN ?? '',
  ].filter(Boolean),
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'x-cron-key',
    'x-admin-api-key',
  ],
  credentials: false,
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
