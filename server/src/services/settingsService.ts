import { prisma } from '../config/db';
import { EmailTemplateConfig, ReminderConfig, SettingsResponse, WhatsAppConfig, WooSettings } from '../types/index';
import { z } from 'zod';
import { encrypt, decrypt } from '../utils/crypto';

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
  url: z.string().transform(val => {
    if (!val) return '';
    let url = val.trim();
    if (!url.startsWith('http')) {
      url = 'https://' + url;
    }
    return url;
  }).pipe(z.string().url()),
  consumerKey: z.string(),
  consumerSecret: z.string(),
  pointsPerCurrency: z.number().positive(),
  lastSync: z.string().optional()
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

export async function getSettings(workspaceId?: string): Promise<SettingsResponse> {
  const [reminderConfig, emailTemplate, adminWhatsApp, wooSettings] = await Promise.all([
    getSetting<ReminderConfig>(REMINDER_KEY, workspaceId),
    getSetting<EmailTemplateConfig>(EMAIL_TEMPLATE_KEY, workspaceId),
    getSetting<WhatsAppConfig>(WHATSAPP_KEY, workspaceId),
    getSetting<WooSettings>(WOO_KEY, workspaceId)
  ]);

  let processedWooSettings = null;
  if (wooSettings) {
    try {
      // Decrypt if necessary (stored encrypted)
      const keyParams = decrypt(wooSettings.consumerKey);
      const secretParams = decrypt(wooSettings.consumerSecret);

      processedWooSettings = {
        ...wooSettings,
        // Mask the keys directly here
        consumerKey: keyParams ? `****************${keyParams.slice(-4)}` : '',
        consumerSecret: secretParams ? `****************${secretParams.slice(-4)}` : '',
      };
    } catch (e) {
      console.error("Error decrypting settings", e);
      processedWooSettings = wooSettings;
    }
  }

  return {
    reminderConfig: reminderSchema.parse(reminderConfig ?? {}),
    emailTemplate: emailTemplateSchema.parse(emailTemplate ?? {}),
    adminWhatsApp: whatsappSchema.parse(adminWhatsApp ?? { phoneNumber: '' }),
    wooSettings: processedWooSettings ? wooSchema.parse(processedWooSettings) : null
  };
}

export async function updateSettings(payload: Partial<SettingsResponse>, workspaceId?: string) {
  if (payload.reminderConfig) {
    await upsertSetting(REMINDER_KEY, reminderSchema.parse(payload.reminderConfig), workspaceId);
  }
  if (payload.emailTemplate) {
    await upsertSetting(EMAIL_TEMPLATE_KEY, emailTemplateSchema.parse(payload.emailTemplate), workspaceId);
  }
  if (payload.adminWhatsApp) {
    await upsertSetting(WHATSAPP_KEY, whatsappSchema.parse(payload.adminWhatsApp), workspaceId);
  }
  if (payload.wooSettings) {
    // Handling encryption logic
    const currentSettings = await getSetting<WooSettings>(WOO_KEY, workspaceId);
    const newSettings = wooSchema.parse(payload.wooSettings);

    // Check if key is masked
    const isKeyMasked = newSettings.consumerKey.startsWith('****');
    const isSecretMasked = newSettings.consumerSecret.startsWith('****');

    const finalSettings = { ...newSettings };

    if (isKeyMasked && currentSettings) {
      // Prepare to keep the existing one (but it's encrypted in DB)
      // Actually, we should just not change it if it matches the mask pattern?
      // But invalid update might overwrite.
      // We assume currentSettings.consumerKey IS encrypted.
      finalSettings.consumerKey = currentSettings.consumerKey;
    } else {
      // New value, encrypt it
      finalSettings.consumerKey = encrypt(newSettings.consumerKey);
    }

    if (isSecretMasked && currentSettings) {
      finalSettings.consumerSecret = currentSettings.consumerSecret;
    } else {
      finalSettings.consumerSecret = encrypt(newSettings.consumerSecret);
    }

    await upsertSetting(WOO_KEY, finalSettings, workspaceId);
  }
  return getSettings(workspaceId);
}

/**
 * INTERNAL USE ONLY: Get settings with full unmasked credentials.
 * NEVER expose this result to the frontend API.
 */
export async function getUnmaskedSettings(workspaceId?: string): Promise<SettingsResponse> {
  const [reminderConfig, emailTemplate, adminWhatsApp, wooSettings] = await Promise.all([
    getSetting<ReminderConfig>(REMINDER_KEY, workspaceId),
    getSetting<EmailTemplateConfig>(EMAIL_TEMPLATE_KEY, workspaceId),
    getSetting<WhatsAppConfig>(WHATSAPP_KEY, workspaceId),
    getSetting<WooSettings>(WOO_KEY, workspaceId)
  ]);

  let processedWooSettings = null;
  if (wooSettings) {
    try {
      // Decrypt for internal use (no masking)
      const keyParams = decrypt(wooSettings.consumerKey);
      const secretParams = decrypt(wooSettings.consumerSecret);

      processedWooSettings = {
        ...wooSettings,
        consumerKey: keyParams || wooSettings.consumerKey,
        consumerSecret: secretParams || wooSettings.consumerSecret,
      };
    } catch (e) {
      console.error("Error decrypting settings", e);
      processedWooSettings = wooSettings;
    }
  }

  return {
    reminderConfig: reminderSchema.parse(reminderConfig ?? {}),
    emailTemplate: emailTemplateSchema.parse(emailTemplate ?? {}),
    adminWhatsApp: whatsappSchema.parse(adminWhatsApp ?? { phoneNumber: '' }),
    wooSettings: processedWooSettings ? wooSchema.parse(processedWooSettings) : null
  };
}

export async function updateWooSyncTimestamp(dateIsoString: string, workspaceId?: string) {
  const wsId = workspaceId || await getDefaultWorkspaceId();
  const currentSettings = await getSetting<WooSettings>(WOO_KEY, wsId);

  if (!currentSettings) return;

  // We write directly to DB to avoid triggering the encryption logic in updateSettings
  // because currentSettings are already encrypted in the DB.
  await prisma.appSettings.update({
    where: { workspaceId_key: { workspaceId: wsId, key: WOO_KEY } },
    data: {
      value: {
        ...currentSettings,
        lastSync: dateIsoString
      } as any
    }
  });
}
