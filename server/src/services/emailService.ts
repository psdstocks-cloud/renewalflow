import { transporter, defaultFrom } from '../config/mailer';
import { env } from '../config/env';
import { isBrevoApiAvailable, sendBrevoEmail } from './brevoService';

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendTrackedEmailPayload extends SendEmailPayload {
  emailLogId: string; // Must create EmailLog first to get this ID
}

// Get the backend URL for tracking pixels
function getTrackingBaseUrl(): string {
  // In production, use the Railway URL or env variable
  return process.env.RAILWAY_PUBLIC_DOMAIN
    ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
    : (env.FRONTEND_ORIGIN?.replace('pages.dev', 'up.railway.app') || 'http://localhost:4000');
}

/**
 * Inject a 1x1 tracking pixel at the end of the HTML body
 */
function injectTrackingPixel(html: string, emailLogId: string): string {
  const baseUrl = getTrackingBaseUrl();
  const pixelUrl = `${baseUrl}/track/open/${emailLogId}`;
  const pixelTag = `<img src="${pixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;" />`;

  // Insert before closing </body> tag, or append at end
  if (html.includes('</body>')) {
    return html.replace('</body>', `${pixelTag}</body>`);
  }
  return html + pixelTag;
}

/**
 * Rewrite all links in HTML to go through our tracking endpoint
 */
function rewriteLinksForTracking(html: string, emailLogId: string): string {
  const baseUrl = getTrackingBaseUrl();

  // Match href="..." or href='...' (excluding mailto: and tel:)
  const linkRegex = /href=["'](?!mailto:|tel:|#)(https?:\/\/[^"']+)["']/gi;

  return html.replace(linkRegex, (match, url) => {
    const linkHash = Buffer.from(url, 'utf-8').toString('base64url');
    const trackedUrl = `${baseUrl}/track/click/${emailLogId}/${linkHash}`;
    return match.replace(url, trackedUrl);
  });
}

type EmailResult = { success: boolean; method: 'BREVO_API' | 'SMTP'; error?: string };

/**
 * Send email - tries Brevo HTTP API first, falls back to SMTP
 */
export async function sendEmail(payload: SendEmailPayload): Promise<EmailResult> {
  // Try Brevo HTTP API first (works on Railway, port 443)
  if (isBrevoApiAvailable()) {
    console.log(`[Email] Sending via Brevo HTTP API to ${payload.to}`);
    const result = await sendBrevoEmail({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text
    });

    if (result.success) {
      return result;
    }
    console.warn(`[Email] Brevo API failed, trying SMTP fallback: ${result.error}`);
  }

  // Fallback to SMTP
  try {
    console.log(`[Email] Sending via SMTP to ${payload.to}`);
    await transporter.sendMail({
      from: defaultFrom,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.html.replace(/<[^>]+>/g, '')
    });
    return { success: true, method: 'SMTP' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Email] SMTP failed:`, errorMsg);
    return { success: false, method: 'SMTP', error: errorMsg };
  }
}

/**
 * Send email with tracking (pixel + link tracking)
 * Requires emailLogId to be created first
 * Uses Brevo HTTP API first, falls back to SMTP
 */
export async function sendTrackedEmail(payload: SendTrackedEmailPayload): Promise<EmailResult> {
  // 1. Inject tracking pixel
  let trackedHtml = injectTrackingPixel(payload.html, payload.emailLogId);

  // 2. Rewrite links for click tracking  
  trackedHtml = rewriteLinksForTracking(trackedHtml, payload.emailLogId);

  // 3. Try Brevo HTTP API first
  if (isBrevoApiAvailable()) {
    console.log(`[Email] Sending tracked email via Brevo API to ${payload.to}, emailLogId: ${payload.emailLogId}`);
    const result = await sendBrevoEmail({
      to: payload.to,
      subject: payload.subject,
      html: trackedHtml,
      text: payload.text
    });

    if (result.success) {
      return result;
    }
    console.warn(`[Email] Brevo API failed for tracked email, trying SMTP: ${result.error}`);
  }

  // 4. Fallback to SMTP
  try {
    console.log(`[Email] Sending tracked email via SMTP to ${payload.to}, emailLogId: ${payload.emailLogId}`);
    await transporter.sendMail({
      from: defaultFrom,
      to: payload.to,
      subject: payload.subject,
      html: trackedHtml,
      text: payload.text ?? payload.html.replace(/<[^>]+>/g, '')
    });
    return { success: true, method: 'SMTP' };
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[Email] SMTP failed for tracked email:`, errorMsg);
    return { success: false, method: 'SMTP', error: errorMsg };
  }
}
