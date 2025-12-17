import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { transporter, defaultFrom } from '../config/mailer';
import { env } from '../config/env';
import { isBrevoApiAvailable, verifyBrevoConnection, sendBrevoEmail } from '../services/brevoService';

export const smtpRouter = Router();

smtpRouter.use(authMiddleware);

/**
 * GET /api/smtp/status
 * Check email sending capability - Brevo API first, then SMTP
 */
smtpRouter.get('/api/smtp/status', async (_req: Request, res: Response) => {
    try {
        // Check Brevo HTTP API first (preferred - works on Railway)
        if (isBrevoApiAvailable()) {
            const brevoResult = await verifyBrevoConnection();

            if (brevoResult.success) {
                return res.json({
                    configured: true,
                    connected: true,
                    method: 'BREVO_API',
                    message: brevoResult.message,
                    config: {
                        method: 'Brevo HTTP API (Port 443)',
                        fromEmail: env.SMTP_FROM_EMAIL,
                        fromName: env.SMTP_FROM_NAME || 'RenewalFlow'
                    }
                });
            } else {
                return res.json({
                    configured: true,
                    connected: false,
                    method: 'BREVO_API',
                    message: brevoResult.message,
                    config: {
                        method: 'Brevo HTTP API (Port 443)',
                        fromEmail: env.SMTP_FROM_EMAIL || 'Not set',
                        fromName: env.SMTP_FROM_NAME || 'RenewalFlow'
                    }
                });
            }
        }

        // Fall back to checking SMTP
        const isSmtpConfigured = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM_EMAIL);

        if (!isSmtpConfigured) {
            return res.json({
                configured: false,
                connected: false,
                method: 'NONE',
                message: 'No email service configured. Add BREVO_API_KEY or SMTP settings.',
                config: {
                    brevoApiKey: 'Missing',
                    smtpHost: env.SMTP_HOST ? 'Set' : 'Missing',
                    smtpUser: env.SMTP_USER ? 'Set' : 'Missing',
                    fromEmail: env.SMTP_FROM_EMAIL || 'Missing',
                    fromName: env.SMTP_FROM_NAME || 'RenewalFlow'
                }
            });
        }

        // Try SMTP verification with timeout
        const timeoutMs = 10000;
        const verifyWithTimeout = () => new Promise<boolean>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('SMTP timeout. Railway blocks port 587/465. Use BREVO_API_KEY instead.'));
            }, timeoutMs);

            transporter.verify()
                .then(() => { clearTimeout(timer); resolve(true); })
                .catch((err) => { clearTimeout(timer); reject(err); });
        });

        try {
            await verifyWithTimeout();
            return res.json({
                configured: true,
                connected: true,
                method: 'SMTP',
                message: 'SMTP connected and ready',
                config: {
                    method: `SMTP (${env.SMTP_HOST}:${env.SMTP_PORT})`,
                    fromEmail: env.SMTP_FROM_EMAIL,
                    fromName: env.SMTP_FROM_NAME || 'RenewalFlow'
                }
            });
        } catch (err: any) {
            return res.json({
                configured: true,
                connected: false,
                method: 'SMTP',
                message: err.message,
                config: {
                    method: `SMTP (${env.SMTP_HOST}:${env.SMTP_PORT})`,
                    fromEmail: env.SMTP_FROM_EMAIL,
                    fromName: env.SMTP_FROM_NAME || 'RenewalFlow',
                    hint: 'Use BREVO_API_KEY for Railway'
                }
            });
        }
    } catch (error: any) {
        res.status(500).json({
            configured: false,
            connected: false,
            method: 'ERROR',
            message: `Error: ${error.message}`
        });
    }
});

/**
 * POST /api/smtp/test
 * Send a test email using the best available method
 */
smtpRouter.post('/api/smtp/test', async (req: Request, res: Response) => {
    try {
        const { to } = req.body;
        const testEmail = to || env.SMTP_FROM_EMAIL;

        if (!testEmail) {
            return res.status(400).json({
                success: false,
                message: 'No email address provided'
            });
        }

        const testHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
        <div style="background: linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%); padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
          <h1 style="color: white; margin: 0; font-size: 24px;">🎉 Email Working!</h1>
        </div>
        <p style="color: #374151; font-size: 16px; line-height: 1.6;">
          This test email from <strong>RenewalFlow</strong> confirms your configuration is working!
        </p>
        <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="color: #6B7280; font-size: 14px; margin: 0;">
            <strong>Method:</strong> ${isBrevoApiAvailable() ? 'Brevo HTTP API' : 'SMTP'}<br/>
            <strong>Sent At:</strong> ${new Date().toISOString()}<br/>
            <strong>From:</strong> ${env.SMTP_FROM_EMAIL}
          </p>
        </div>
      </div>
    `;

        // Try Brevo API first
        if (isBrevoApiAvailable()) {
            const result = await sendBrevoEmail({
                to: testEmail,
                subject: '✅ RenewalFlow Test Email - Working!',
                html: testHtml
            });

            if (result.success) {
                return res.json({
                    success: true,
                    method: 'BREVO_API',
                    message: `Test email sent via Brevo API to ${testEmail}`,
                    to: testEmail
                });
            }
            // If Brevo fails, try SMTP
            console.warn(`Brevo API failed, trying SMTP: ${result.error}`);
        }

        // Fallback to SMTP with timeout
        const sendWithTimeout = new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('SMTP timeout. Railway blocks port 587/465. Add BREVO_API_KEY.'));
            }, 15000);

            transporter.sendMail({
                from: defaultFrom,
                to: testEmail,
                subject: '✅ RenewalFlow Test Email - Working!',
                html: testHtml,
                text: 'RenewalFlow Test Email - Your configuration is working!'
            })
                .then((result) => { clearTimeout(timer); resolve(result); })
                .catch((err) => { clearTimeout(timer); reject(err); });
        });

        await sendWithTimeout;

        res.json({
            success: true,
            method: 'SMTP',
            message: `Test email sent via SMTP to ${testEmail}`,
            to: testEmail
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});
