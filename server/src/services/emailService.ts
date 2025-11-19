import { transporter, defaultFrom } from '../config/mailer';

export interface SendEmailPayload {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

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
