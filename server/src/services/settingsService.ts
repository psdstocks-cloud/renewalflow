import { prisma } from '../config/db';
import { EmailTemplateConfig, ReminderConfig, SettingsResponse, WhatsAppConfig, WooSettings } from '../types/index';
import { z } from 'zod';

const REMINDER_KEY = 'reminderConfig';
const EMAIL_TEMPLATE_KEY = 'emailTemplate';
const WHATSAPP_KEY = 'adminWhatsApp';
const WOO_KEY = 'wooSettings';

const reminderSchema = z.object({
  firstReminderDays: z.number().int().nonnegative().default(7),
  finalReminderDays: z.number().int().nonnegative().default(2)
});

const emailTemplateSchema = z.object({
  subjectTemplate: z.string().default('Your subscription is about to expire'),
  bodyTemplate: z.string().default('Hi {{name}}, your plan is expiring soon.'),
  context: z.string().optional()
});

const whatsappSchema = z.object({
  phoneNumber: z.string()
});

const wooSchema = z.object({
  url: z.string().url(),
  consumerKey: z.string(),
  consumerSecret: z.string(),
  pointsPerCurrency: z.number().positive()
});

// Get default workspace ID (for now, use the first workspace)
// TODO: Get workspaceId from authenticated user context
async function getDefaultWorkspaceId(): Promise<string> {
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    throw new Error('No workspace found. Please bootstrap a workspace first.');
  }
  return workspace.id;
}

async function upsertSetting<T>(key: string, value: T, workspaceId?: string) {
  const wsId = workspaceId || await getDefaultWorkspaceId();
  await prisma.appSettings.upsert({
    where: { workspaceId_key: { workspaceId: wsId, key } },
    create: { workspaceId: wsId, key, value: value as any },
    update: { value: value as any }
  });
}

async function getSetting<T>(key: string, workspaceId?: string) {
  const wsId = workspaceId || await getDefaultWorkspaceId();
  const entry = await prisma.appSettings.findUnique({ 
    where: { workspaceId_key: { workspaceId: wsId, key } } 
  });
  return (entry?.value as T | undefined) ?? null;
}

export async function getSettings(): Promise<SettingsResponse> {
  const [reminderConfig, emailTemplate, adminWhatsApp, wooSettings] = await Promise.all([
    getSetting<ReminderConfig>(REMINDER_KEY),
    getSetting<EmailTemplateConfig>(EMAIL_TEMPLATE_KEY),
    getSetting<WhatsAppConfig>(WHATSAPP_KEY),
    getSetting<WooSettings>(WOO_KEY)
  ]);

  return {
    reminderConfig: reminderSchema.parse(reminderConfig ?? {}),
    emailTemplate: emailTemplateSchema.parse(emailTemplate ?? {}),
    adminWhatsApp: whatsappSchema.parse(adminWhatsApp ?? { phoneNumber: '' }),
    wooSettings: wooSettings ? wooSchema.parse(wooSettings) : null
  };
}

export async function updateSettings(payload: Partial<SettingsResponse>) {
  if (payload.reminderConfig) {
    await upsertSetting(REMINDER_KEY, reminderSchema.parse(payload.reminderConfig));
  }
  if (payload.emailTemplate) {
    await upsertSetting(EMAIL_TEMPLATE_KEY, emailTemplateSchema.parse(payload.emailTemplate));
  }
  if (payload.adminWhatsApp) {
    await upsertSetting(WHATSAPP_KEY, whatsappSchema.parse(payload.adminWhatsApp));
  }
  if (payload.wooSettings) {
    await upsertSetting(WOO_KEY, wooSchema.parse(payload.wooSettings));
  }
  return getSettings();
}
