import { EmailSettings, NotificationTask } from "../types";

// Define the structure for EmailJS response
interface EmailJSResponse {
  status: number;
  text: string;
}

export const sendEmail = async (
  task: NotificationTask, 
  content: string, 
  settings: EmailSettings
): Promise<{ success: boolean; method: 'API' | 'CLIENT'; error?: string }> => {
  
  // 1. Try EmailJS if enabled and configured
  if (settings.isEnabled && settings.serviceId && settings.templateId && settings.publicKey) {
    try {
      const templateParams = {
        to_name: task.subscriber.name,
        to_email: task.subscriber.email,
        message: content,
        subject: `Action Required: Subscription Renewal & ${task.subscriber.pointsRemaining} Points Rollover`,
        points_remaining: task.subscriber.pointsRemaining,
        days_left: task.daysUntilExpiry,
        payment_link: task.subscriber.paymentLink || ''
      };

      const data = {
        service_id: settings.serviceId,
        template_id: settings.templateId,
        user_id: settings.publicKey,
        template_params: templateParams
      };

      const response = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (response.ok) {
        return { success: true, method: 'API' };
      } else {
        const errorText = await response.text();
        console.warn('EmailJS failed, falling back to mailto:', errorText);
        // Don't return error yet, fall through to mailto
      }
    } catch (error) {
      console.error('EmailJS network error:', error);
      // Fall through to mailto
    }
  }

  // 2. Fallback to mailto (Client-side)
  try {
    const subject = `Action Required: Subscription Renewal & ${task.subscriber.pointsRemaining} Points Rollover`;
    const body = encodeURIComponent(content);
    const mailtoLink = `mailto:${task.subscriber.email}?subject=${encodeURIComponent(subject)}&body=${body}`;
    
    // Open in new tab/window to avoid disrupting the app
    window.open(mailtoLink, '_blank');
    return { success: true, method: 'CLIENT' };
  } catch (e) {
    return { success: false, method: 'CLIENT', error: 'Could not open email client.' };
  }
};