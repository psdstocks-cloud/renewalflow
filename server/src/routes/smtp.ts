import { Router, Request, Response } from 'express';
import { authMiddleware } from '../middleware/auth';
import { transporter, defaultFrom } from '../config/mailer';
import { env } from '../config/env';

export const smtpRouter = Router();

smtpRouter.use(authMiddleware);

/**
 * GET /api/smtp/status
 * Check if SMTP is configured and verify connection (with timeout)
 */
smtpRouter.get('/api/smtp/status', async (_req: Request, res: Response) => {
    try {
        const isConfigured = !!(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS && env.SMTP_FROM_EMAIL);

        if (!isConfigured) {
            return res.json({
                configured: false,
                connected: false,
                message: 'SMTP not configured. Set SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM_EMAIL environment variables.',
                config: {
                    host: env.SMTP_HOST ? 'Set' : 'Missing',
                    port: env.SMTP_PORT,
                    user: env.SMTP_USER ? 'Set' : 'Missing',
                    pass: env.SMTP_PASS ? 'Set' : 'Missing',
                    fromEmail: env.SMTP_FROM_EMAIL || 'Missing',
                    fromName: env.SMTP_FROM_NAME || 'RenewalFlow'
                }
            });
        }

        // Try to verify connection with a timeout
        const timeoutMs = 10000; // 10 second timeout

        const verifyWithTimeout = () => new Promise<boolean>((resolve, reject) => {
            const timer = setTimeout(() => {
                reject(new Error('Connection timeout after 10 seconds'));
            }, timeoutMs);

            transporter.verify()
                .then(() => {
                    clearTimeout(timer);
                    resolve(true);
                })
                .catch((err) => {
                    clearTimeout(timer);
                    reject(err);
                });
        });

        try {
            await verifyWithTimeout();
            return res.json({
                configured: true,
                connected: true,
                message: 'SMTP connected and ready to send emails',
                config: {
                    host: env.SMTP_HOST,
                    port: env.SMTP_PORT,
                    user: '***' + env.SMTP_USER.slice(-4),
                    fromEmail: env.SMTP_FROM_EMAIL,
                    fromName: env.SMTP_FROM_NAME || 'RenewalFlow'
                }
            });
        } catch (err: any) {
            return res.json({
                configured: true,
                connected: false,
                message: `SMTP connection failed: ${err.message}`,
                config: {
                    host: env.SMTP_HOST,
                    port: env.SMTP_PORT,
                    user: '***' + env.SMTP_USER.slice(-4),
                    fromEmail: env.SMTP_FROM_EMAIL,
                    fromName: env.SMTP_FROM_NAME || 'RenewalFlow'
                }
            });
        }
    } catch (error: any) {
        res.status(500).json({
            configured: false,
            connected: false,
            message: `Error checking SMTP: ${error.message}`
        });
    }
});

/**
 * POST /api/smtp/test
 * Send a test email to verify SMTP works
 */
smtpRouter.post('/api/smtp/test', async (req: Request, res: Response) => {
    try {
        const { to } = req.body;
        const testEmail = to || env.SMTP_FROM_EMAIL;

        if (!testEmail) {
            return res.status(400).json({
                success: false,
                message: 'No email address provided and SMTP_FROM_EMAIL not set'
            });
        }

        // Send test email
        await transporter.sendMail({
            from: defaultFrom,
            to: testEmail,
            subject: '✅ RenewalFlow Test Email - SMTP Working!',
            html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px;">
          <div style="background: linear-gradient(135deg, #8B5CF6 0%, #06B6D4 100%); padding: 24px; border-radius: 12px; text-align: center; margin-bottom: 24px;">
            <h1 style="color: white; margin: 0; font-size: 24px;">🎉 SMTP Connection Successful!</h1>
          </div>
          <p style="color: #374151; font-size: 16px; line-height: 1.6;">
            This is a test email from <strong>RenewalFlow</strong>. If you're reading this, your SMTP configuration is working correctly!
          </p>
          <div style="background: #F3F4F6; padding: 16px; border-radius: 8px; margin: 24px 0;">
            <p style="color: #6B7280; font-size: 14px; margin: 0;">
              <strong>SMTP Host:</strong> ${env.SMTP_HOST}<br/>
              <strong>Sent At:</strong> ${new Date().toISOString()}<br/>
              <strong>From:</strong> ${env.SMTP_FROM_EMAIL}
            </p>
          </div>
          <p style="color: #9CA3AF; font-size: 12px; text-align: center; margin-top: 32px;">
            RenewalFlow - Subscription Renewal Reminders
          </p>
        </div>
      `,
            text: `RenewalFlow Test Email - SMTP Working!\n\nThis is a test email from RenewalFlow. Your SMTP configuration is working correctly!\n\nSMTP Host: ${env.SMTP_HOST}\nSent At: ${new Date().toISOString()}`
        });

        res.json({
            success: true,
            message: `Test email sent successfully to ${testEmail}`,
            to: testEmail
        });
    } catch (error: any) {
        res.status(500).json({
            success: false,
            message: `Failed to send test email: ${error.message}`
        });
    }
});
