import nodemailer from 'nodemailer';
import { env } from './env';

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_PORT === 465,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  },
  tls: {
    rejectUnauthorized: false
  },
  debug: false,
  logger: false
});

export const defaultFrom = {
  name: env.SMTP_FROM_NAME ?? 'RenewalFlow',
  address: env.SMTP_FROM_EMAIL
};
