import { geminiClient } from '../config/gemini';
import { EmailTemplateConfig, ReminderTask } from '../types';
import { env } from '../config/env';

interface ReminderEmailPayload {
  subject: string;
  body: string;
}

async function callGemini(prompt: string): Promise<string> {
  if (!geminiClient || !env.GEMINI_API_KEY) {
    throw new Error('Gemini API key not configured');
  }
  const model = geminiClient.getGenerativeModel({ model: 'gemini-1.5-flash' });
  const response = await model.generateContent(prompt);
  return response.response.text() ?? '';
}

export async function generateReminderEmail(task: ReminderTask, template: EmailTemplateConfig, customInstructions?: string): Promise<ReminderEmailPayload> {
  const prompt = `You are RenewalFlow, a friendly membership concierge. Create a JSON response with keys subject and body.
Subscriber: ${task.subscriber.name} (${task.subscriber.email})
Plan: ${task.subscriber.planName}
Amount: ${task.subscriber.amount} ${task.subscriber.currency}
Points remaining: ${task.subscriber.pointsRemaining}
Days until expiry: ${task.daysUntilExpiry}
Task type: ${task.type}
Payment link: ${task.subscriber.paymentLink ?? 'N/A'}
Template subject: ${template.subjectTemplate}
Template body: ${template.bodyTemplate}
Tone/context: ${template.context ?? 'Friendly and professional'}
Additional instructions: ${customInstructions ?? 'None'}
Return JSON.`;

  try {
    const text = await callGemini(prompt);
    const parsed = JSON.parse(text);
    return {
      subject: parsed.subject ?? template.subjectTemplate,
      body: parsed.body ?? template.bodyTemplate
    };
  } catch (error) {
    console.warn('Gemini fallback used', error);
    return {
      subject: template.subjectTemplate.replace('{{name}}', task.subscriber.name),
      body: template.bodyTemplate
        .replace('{{name}}', task.subscriber.name)
        .replace('{{plan}}', task.subscriber.planName)
    };
  }
}

export async function generateWhatsAppSummary(tasks: ReminderTask[]): Promise<string> {
  if (!tasks.length) {
    return 'No reminders today.';
  }
  const taskLines = tasks
    .map((task) => `${task.subscriber.name} (${task.type}) - expires in ${task.daysUntilExpiry} days`)
    .join('\n');
  if (!geminiClient || !env.GEMINI_API_KEY) {
    return `Reminder tasks for today:\n${taskLines}`;
  }
  const prompt = `Summarize these reminder tasks for WhatsApp:\n${taskLines}\nReturn concise WhatsApp-friendly text.`;
  try {
    const text = await callGemini(prompt);
    return text.trim();
  } catch (error) {
    console.warn('Gemini WhatsApp fallback used', error);
    return `Reminder tasks for today:\n${taskLines}`;
  }
}
