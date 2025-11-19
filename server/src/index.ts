import express from 'express';
import cors from 'cors';
import { env } from './config/env';
import { healthRouter } from './routes/health';
import { subscriberRouter } from './routes/subscribers';
import { settingsRouter } from './routes/settings';
import { reminderRouter } from './routes/reminders';
import { wooRouter } from './routes/woo';
import { cronRouter } from './routes/cron';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors({ origin: env.FRONTEND_ORIGIN ?? '*', credentials: true }));
app.use(express.json({ limit: '1mb' }));

app.use(healthRouter);
app.use(subscriberRouter);
app.use(settingsRouter);
app.use(reminderRouter);
app.use(wooRouter);
app.use(cronRouter);

app.use(errorHandler);

app.listen(env.PORT, () => {
  console.log(`RenewalFlow API listening on port ${env.PORT}`);
});
