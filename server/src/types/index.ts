import { Subscriber } from '@prisma/client';

export type ReminderType = 'FIRST_REMINDER' | 'FINAL_REMINDER' | 'EXPIRED';

export interface ReminderTask {
  id: string;
  subscriberId: string;
  type: ReminderType;
  daysUntilExpiry: number;
  reason: string;
  subscriber: Subscriber;
}

export interface ReminderConfig {
  firstReminderDays: number;
  finalReminderDays: number;
}

export interface EmailTemplateConfig {
  subjectTemplate: string;
  bodyTemplate: string;
  context?: string;
}

export interface WhatsAppConfig {
  phoneNumber: string;
}

export interface WooSyncStatus {
  state: 'idle' | 'syncing' | 'completed' | 'error';
  message: string;
  progress: number; // 0-100
  details?: {
    current: number;
    total: number;
    stage: string;
  };
  lastUpdated: string;
}

export interface WooSettings {
  url: string;
  consumerKey: string;
  consumerSecret: string;
  pointsPerCurrency: number;
  lastSync?: string;
  syncStatus?: WooSyncStatus;
}

export interface SettingsResponse {
  reminderConfig: ReminderConfig;
  emailTemplate: EmailTemplateConfig;
  adminWhatsApp: WhatsAppConfig;
  wooSettings: WooSettings | null;
}
