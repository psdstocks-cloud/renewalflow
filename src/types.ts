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

export interface WooSettings {
  url: string;
  consumerKey: string;
  consumerSecret: string;
  pointsPerCurrency: number;
  lastSync?: string;
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
  data: Subscriber[];
  meta: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
  // Legacy format for backward compatibility
  items?: Subscriber[];
  total?: number;
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

export interface WebsiteConnection {
  id: string;
  websiteUrl: string;
  apiKey: string;
  isActive: boolean;
  lastSyncAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueTransaction {
  id: string;
  workspaceId: string;
  subscriberId: string;
  amount: number;
  currency: string;
  transactionType: 'renewal' | 'new_purchase' | 'upgrade' | 'downgrade' | 'refund';
  paymentMethod: string | null;
  paymentStatus: string;
  emailLogId: string | null;
  externalOrderId: string | null;
  externalChargeId: string | null;
  planName: string | null;
  planAmount: number | null;
  transactionDate: string;
  createdAt: string;
  updatedAt: string;
}

export interface RevenueMetrics {
  totalRevenue: number;
  transactionCount: number;
  recoveredRevenue: number;
  mrr: number;
  arr: number;
  churnLost: number;
  forecast: number;
  byPlan: Array<{ planName: string; revenue: number; transactionCount: number }>;
  byPaymentMethod: Array<{ paymentMethod: string; revenue: number; transactionCount: number }>;
  period: { start: string; end: string };
}

export interface RevenueByPlan {
  planName: string;
  totalRevenue: number;
  transactionCount: number;
}

export interface RevenueByPaymentMethod {
  paymentMethod: string;
  totalRevenue: number;
  transactionCount: number;
}
