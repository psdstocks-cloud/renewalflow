/**
 * Brevo HTTP API Email Service
 * Uses Brevo's Transactional Email API over HTTPS (port 443)
 * This bypasses SMTP port blocking on cloud platforms like Railway
 */

import { env } from '../config/env';

interface BrevoSender {
    name: string;
    email: string;
}

interface BrevoRecipient {
    email: string;
    name?: string;
}

interface BreveSendRequest {
    sender: BrevoSender;
    to: BrevoRecipient[];
    subject: string;
    htmlContent: string;
    textContent?: string;
}

interface BrevoResponse {
    messageId?: string;
    code?: string;
    message?: string;
}

const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';

/**
 * Get the Brevo API key from environment
 * Falls back to SMTP_PASS if BREVO_API_KEY not set (for users who put API key there)
 */
function getBrevoApiKey(): string | null {
    // Check for dedicated BREVO_API_KEY first
    if (process.env.BREVO_API_KEY) {
        return process.env.BREVO_API_KEY;
    }

    // Fall back to SMTP_PASS if it looks like an API key (starts with xkeysib-)
    if (env.SMTP_PASS?.startsWith('xkeysib-')) {
        return env.SMTP_PASS;
    }

    return null;
}

/**
 * Check if Brevo HTTP API is available
 */
export function isBrevoApiAvailable(): boolean {
    return !!getBrevoApiKey();
}

/**
 * Verify Brevo API connection by making a simple API call
 */
export async function verifyBrevoConnection(): Promise<{ success: boolean; message: string }> {
    const apiKey = getBrevoApiKey();

    if (!apiKey) {
        return { success: false, message: 'Brevo API key not configured' };
    }

    try {
        // Make a simple API call to /account to verify credentials
        const response = await fetch('https://api.brevo.com/v3/account', {
            method: 'GET',
            headers: {
                'api-key': apiKey,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            return { success: true, message: `Connected to Brevo (${data.email || 'account verified'})` };
        } else {
            const error = await response.json();
            return { success: false, message: `Brevo API error: ${error.message || response.statusText}` };
        }
    } catch (error: any) {
        return { success: false, message: `Connection failed: ${error.message}` };
    }
}

interface SendBrevoEmailOptions {
    to: string;
    toName?: string;
    subject: string;
    html: string;
    text?: string;
}

/**
 * Send email using Brevo HTTP API
 */
export async function sendBrevoEmail(options: SendBrevoEmailOptions): Promise<{
    success: boolean;
    method: 'BREVO_API';
    error?: string;
    messageId?: string;
}> {
    const apiKey = getBrevoApiKey();

    if (!apiKey) {
        return { success: false, method: 'BREVO_API', error: 'Brevo API key not configured' };
    }

    const payload: BreveSendRequest = {
        sender: {
            name: env.SMTP_FROM_NAME || 'RenewalFlow',
            email: env.SMTP_FROM_EMAIL || 'noreply@renewalflow.app'
        },
        to: [{
            email: options.to,
            name: options.toName
        }],
        subject: options.subject,
        htmlContent: options.html,
        textContent: options.text || options.html.replace(/<[^>]+>/g, '')
    };

    try {
        const response = await fetch(BREVO_API_URL, {
            method: 'POST',
            headers: {
                'api-key': apiKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        const data: BrevoResponse = await response.json();

        if (response.ok && data.messageId) {
            console.log(`[Brevo API] Email sent successfully, messageId: ${data.messageId}`);
            return { success: true, method: 'BREVO_API', messageId: data.messageId };
        } else {
            console.error(`[Brevo API] Failed to send email:`, data);
            return {
                success: false,
                method: 'BREVO_API',
                error: data.message || `HTTP ${response.status}: ${response.statusText}`
            };
        }
    } catch (error: any) {
        console.error(`[Brevo API] Network error:`, error);
        return { success: false, method: 'BREVO_API', error: error.message };
    }
}
