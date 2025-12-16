export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED';

export interface Subscriber {
  id: string;
  name: string;
  email: string;
  phone?: string;
  planName: string;
  amount: number;
  currency: string;
  pointsRemaining: number;
  status: SubscriptionStatus;
  startDate: string;
  endDate: string;
  paymentLink?: string;
  lastNotifiedAt?: string | null;
  lastPurchaseDate?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReminderConfig {
  firstReminderDays: number;
  finalReminderDays: number;
}

export interface EmailTemplateConfig {
  subjectTemplate: string;
  bodyTemplate: string;
  context: string;
}

export interface AdminWhatsAppConfig {
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
  lastSync?: string; // ISO date
  syncStatus?: WooSyncStatus;
}

export interface AppSettings {
  reminderConfig: ReminderConfig;
  emailTemplate: EmailTemplateConfig;
  adminWhatsApp?: AdminWhatsAppConfig;
  wooSettings?: WooSettings;
}

export type ReminderType = 'FIRST_REMINDER' | 'FINAL_REMINDER' | 'EXPIRED';

export interface ReminderTask {
  id: string;
  subscriberId: string;
  type: ReminderType;
  daysUntilExpiry: number;
  reason: string;
  subscriber?: Subscriber;
}

export interface EmailLog {
  id: string;
  subscriberId: string;
  type: ReminderType | string;
  subject: string;
  body: string;
  method: string;
  success: boolean;
  error?: string | null;
  sentAt: string;
  subscriber?: Subscriber;
}

export interface SubscriberStats {
  totalActive: number;
  totalExpired: number;
  totalCancelled: number;
  totalPointsRemaining: number;
  expiringSoonCount: number;
}

export interface SubscribersResponse {
  items: Subscriber[];
  total: number;
}

export interface ReminderSendResponse {
  success: boolean;
  task: ReminderTask;
  emailLog: EmailLog;
}

export interface WooSyncResult {
  updated: number;
  created: number;
  totalOrdersProcessed: number;
}

export interface ImportResult {
  created: number;
  updated: number;
}