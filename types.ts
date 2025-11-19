export enum SubscriptionStatus {
  ACTIVE = 'Active',
  EXPIRED = 'Expired',
  CANCELLED = 'Cancelled'
}

export interface Subscriber {
  id: string;
  name: string;
  email: string;
  phone: string; // For WhatsApp reference
  planName: string;
  amount: number;
  startDate: string; // ISO Date string
  endDate: string; // ISO Date string
  pointsRemaining: number;
  paymentLink?: string; // URL for direct payment
  status: SubscriptionStatus;
  lastNotified?: string; // Date string
}

export interface NotificationTask {
  subscriber: Subscriber;
  type: 'FIRST_REMINDER' | 'FINAL_REMINDER' | 'EXPIRED';
  daysUntilExpiry: number;
  generatedContent?: string;
}

export interface DashboardStats {
  totalRevenue: number;
  activeSubs: number;
  expiringSoon: number;
}

export interface EmailLog {
  id: string;
  subscriberName: string;
  subscriberEmail: string;
  type: 'FIRST_REMINDER' | 'FINAL_REMINDER' | 'MANUAL' | 'EXPIRED';
  sentAt: string;
  status: 'Sent' | 'Failed'; // Client-side tracking
  contentSnippet: string;
}

export interface WooSettings {
  url: string;
  consumerKey: string;
  consumerSecret: string;
  pointsPerDollar: number; // Conversion rate for auto-adding points
}

export interface EmailSettings {
  serviceId: string;
  templateId: string;
  publicKey: string;
  isEnabled: boolean;
}

export interface AppSettings {
  firstReminderDays: number;
  finalReminderDays: number;
  emailTemplate: string;
  emailSettings: EmailSettings;
  wooSettings: WooSettings;
}