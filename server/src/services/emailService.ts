import { transporter, defaultFrom } from '../config/mailer';
import { env } from '../config/env';

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

/**
 * Original sendEmail function (no tracking)
 */
export async function sendEmail(payload: SendEmailPayload) {
  try {
    await transporter.sendMail({
      from: defaultFrom,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      text: payload.text ?? payload.html.replace(/<[^>]+>/g, '')
    });
    return { success: true as const, method: 'SMTP' as const };
  } catch (error) {
    return { success: false as const, method: 'SMTP' as const, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

/**
 * Send email with tracking (pixel + link tracking)
 * Requires emailLogId to be created first
 */
export async function sendTrackedEmail(payload: SendTrackedEmailPayload) {
  try {
    // 1. Inject tracking pixel
    let trackedHtml = injectTrackingPixel(payload.html, payload.emailLogId);

    // 2. Rewrite links for click tracking  
    trackedHtml = rewriteLinksForTracking(trackedHtml, payload.emailLogId);

    // 3. Send the email
    await transporter.sendMail({
      from: defaultFrom,
      to: payload.to,
      subject: payload.subject,
      html: trackedHtml,
      text: payload.text ?? payload.html.replace(/<[^>]+>/g, '')
    });

    console.log(`[Email] Sent tracked email to ${payload.to}, emailLogId: ${payload.emailLogId}`);
    return { success: true as const, method: 'SMTP' as const };
  } catch (error) {
    console.error(`[Email] Failed to send tracked email:`, error);
    return { success: false as const, method: 'SMTP' as const, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
