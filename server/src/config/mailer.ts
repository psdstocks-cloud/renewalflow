import nodemailer from 'nodemailer';
import { env } from './env';

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST || 'localhost',
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465, // true for 465, false for other ports
  auth: {
    user: env.SMTP_USER || '',
    pass: env.SMTP_PASS || ''
  },
  tls: {
    rejectUnauthorized: false
  },
  // Timeout settings to prevent hanging
  connectionTimeout: 10000, // 10 seconds to establish connection
  greetingTimeout: 10000,   // 10 seconds for SMTP greeting
  socketTimeout: 15000,     // 15 seconds for socket operations
  debug: false,
  logger: false
});

export const defaultFrom = {
  name: env.SMTP_FROM_NAME ?? 'RenewalFlow',
  address: env.SMTP_FROM_EMAIL || 'noreply@renewalflow.app'
};
