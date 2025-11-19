import { GoogleGenAI } from "@google/genai";
import { Subscriber, NotificationTask } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
const modelId = 'gemini-2.5-flash';

export const generateEmailContent = async (task: NotificationTask, customInstructions?: string): Promise<string> => {
  const daysLeft = task.daysUntilExpiry;
  const paymentLink = task.subscriber.paymentLink;
  
  const prompt = `
    You are an automated subscription manager for a WordPress membership site.
    Write a friendly, professional renewal reminder email for a client.
    
    Client Details:
    - Name: ${task.subscriber.name}
    - Plan: ${task.subscriber.planName}
    - Price: $${task.subscriber.amount}
    - Expires in: ${daysLeft} days
    - Current Points Remaining: ${task.subscriber.pointsRemaining}
    ${paymentLink ? `- Payment Link: ${paymentLink}` : ''}
    
    ${customInstructions ? `
    USER PROVIDED TEMPLATE / INSTRUCTIONS:
    "${customInstructions}"
    
    INSTRUCTION: 
    If the user provided a template with placeholders like {name}, {points}, {endDate}, {paymentLink}, please use the template structure strictly and fill in the data. 
    Retain any Markdown formatting (bold **, italics *, lists) used in the template.
    If it's just general instructions, follow the tone and style requested.
    ` : ''}

    Key Message Requirements (if not covered by template):
    1. Remind them their subscription ends in ${daysLeft} days.
    2. Explicitly mention their ${task.subscriber.pointsRemaining} remaining points.
    3. Explain that if they renew before expiration, these points will ROLLOVER to the next month. If not, they are lost.
    ${paymentLink ? `4. INSTRUCTION: Provide the payment link (${paymentLink}) clearly with a call to action like "Click here to renew and save your points".` : '4. Ask them to reply to this email to arrange payment.'}
    5. Keep it concise and direct.
    6. Return ONLY the body of the email.
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || "Could not generate email content.";
  } catch (error) {
    console.error("Error generating email:", error);
    return "Error generating email. Please write manually.";
  }
};

export const generateWhatsAppReport = async (tasks: NotificationTask[]): Promise<string> => {
  if (tasks.length === 0) return "No pending tasks for today.";

  const taskSummary = tasks.map(t => 
    `- ${t.subscriber.name}: ${t.daysUntilExpiry} days left ($${t.subscriber.amount})`
  ).join('\n');

  const prompt = `
    You are a personal assistant bot. 
    Summarize the daily subscription tasks into a short WhatsApp message for the admin.
    
    Tasks pending today:
    ${taskSummary}
    
    Format:
    "📅 *RenewalFlow Daily Report*"
    
    *Action Required:*
    [List of subscribers]
    
    *Quick Stat:*
    Total Value at Risk: $${tasks.reduce((acc, t) => acc + t.subscriber.amount, 0)}
    
    [A short, punchy motivational sentence about closing these renewals today]
    
    Keep it formatted for WhatsApp (use asterisks for bold).
  `;

  try {
    const response = await ai.models.generateContent({
      model: modelId,
      contents: prompt,
    });
    return response.text || "Report generation failed.";
  } catch (error) {
    console.error("Error generating report:", error);
    return "Error generating report.";
  }
};

export const parseCSVData = async (csvText: string): Promise<any[]> => {
    const prompt = `
    I have a raw CSV/text export of subscribers. Convert this into a JSON array of objects with these exact keys: 
    name, email, planName, amount (number), startDate (YYYY-MM-DD), endDate (YYYY-MM-DD), pointsRemaining (number), paymentLink (string/null).
    
    If phone number exists, map it to 'phone'.
    If status is missing, infer it based on endDate vs today (${new Date().toISOString().split('T')[0]}).
    If a URL looks like a payment link (stripe, paypal, woocommerce), map it to 'paymentLink'.
    
    Raw Data:
    ${csvText.substring(0, 8000)} 
    
    Return ONLY valid JSON array. No markdown formatting.
    `;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json'
            }
        });
        return JSON.parse(response.text || "[]");
    } catch (e) {
        console.error("AI Parse failed", e);
        return [];
    }
}