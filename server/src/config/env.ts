import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  ADMIN_API_KEY: z.string().optional(),
  CRON_API_KEY: z.string().optional(),
  GEMINI_API_KEY: z.string().optional(),
  SUPABASE_KEY: z.string().optional(),
  SUPABASE_ANON_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().min(1, 'SUPABASE_JWT_SECRET is required'),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SMTP_HOST: z.string().min(1, 'SMTP_HOST is required'),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().min(1, 'SMTP_USER is required'),
  SMTP_PASS: z.string().min(1, 'SMTP_PASS is required'),
  SMTP_FROM_EMAIL: z.string().email('SMTP_FROM_EMAIL must be valid'),
  SMTP_FROM_NAME: z.string().optional(),
  FRONTEND_ORIGIN: z.string().optional()
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
