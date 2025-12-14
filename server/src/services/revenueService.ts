import { prisma } from '../config/db';
import { subDays } from 'date-fns';

/**
 * Normalize payment method names from WooCommerce to standard format
 */
export function normalizePaymentMethod(wooPaymentMethod?: string): string | null {
  if (!wooPaymentMethod) {
    return null;
  }

  const method = wooPaymentMethod.toLowerCase().trim();

  // Map common WooCommerce payment methods to standard names
  const paymentMethodMap: Record<string, string> = {
    'bacs': 'bank_transfer',
    'cheque': 'check',
    'cod': 'cash_on_delivery',
    'paypal': 'paypal',
    'stripe': 'credit_card',
    'stripe_cc': 'credit_card',
    'credit_card': 'credit_card',
    'debit_card': 'debit_card',
    'card': 'credit_card',
    'bank_transfer': 'bank_transfer',
    'bank': 'bank_transfer',
    'wire_transfer': 'bank_transfer',
    'check': 'check',
    'cash': 'cash',
    'mollie': 'credit_card',
    'razorpay': 'credit_card',
    'square': 'credit_card',
  };

  // Check for exact match
  if (paymentMethodMap[method]) {
    return paymentMethodMap[method];
  }

  // Check for partial matches
  for (const [key, value] of Object.entries(paymentMethodMap)) {
    if (method.includes(key) || key.includes(method)) {
      return value;
    }
  }

  // Return normalized version of original if no match
  return method.replace(/[^a-z0-9]/g, '_');
}

/**
 * Determine transaction type based on subscriber and order data
 */
export function determineTransactionType(
  subscriber: { status: string; lastPurchaseDate: Date | null; endDate: Date },
  orderDate: Date
): 'renewal' | 'new_purchase' | 'upgrade' | 'downgrade' {
  // If subscriber was active and order is within 7 days of expiry, likely renewal
  if (subscriber.status === 'ACTIVE') {
    const daysUntilExpiry = Math.floor(
      (subscriber.endDate.getTime() - orderDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysUntilExpiry >= -7 && daysUntilExpiry <= 7) {
      return 'renewal';
    }
  }

  // If there's a last purchase date and order is close to it, likely renewal
  if (subscriber.lastPurchaseDate) {
    const daysSinceLastPurchase = Math.floor(
      (orderDate.getTime() - subscriber.lastPurchaseDate.getTime()) / (1000 * 60 * 60 * 24)
    );
    
    if (daysSinceLastPurchase >= 25 && daysSinceLastPurchase <= 35) {
      return 'renewal';
    }
  }

  // Default to new purchase if we can't determine
  return 'new_purchase';
}

/**
 * Find the most recent reminder email that could have triggered this renewal
 * Looks for reminders sent within the attribution window (default 30 days)
 */
export async function findAttributedEmailLog(
  subscriberId: string,
  transactionDate: Date,
  attributionWindowDays: number = 30
): Promise<string | null> {
  const windowStart = subDays(transactionDate, attributionWindowDays);

  const recentReminder = await prisma.emailLog.findFirst({
    where: {
      subscriberId,
      sentAt: {
        gte: windowStart,
        lte: transactionDate,
      },
      type: {
        in: ['FIRST_REMINDER', 'FINAL_REMINDER', 'EXPIRED'],
      },
    },
    orderBy: {
      sentAt: 'desc',
    },
    select: {
      id: true,
    },
  });

  return recentReminder?.id || null;
}

/**
 * Create a revenue transaction from a charge/order
 */
export async function createRevenueTransaction(params: {
  workspaceId: string;
  subscriberId: string;
  amount: number;
  currency: string;
  transactionType: 'renewal' | 'new_purchase' | 'upgrade' | 'downgrade' | 'refund';
  paymentMethod: string | null;
  paymentStatus: string;
  externalOrderId?: string;
  externalChargeId?: string;
  planName?: string;
  planAmount?: number;
  transactionDate: Date;
  emailLogId?: string | null;
}): Promise<string> {
  // Check if transaction already exists (prevent duplicates)
  if (params.externalOrderId) {
    const existing = await prisma.revenueTransaction.findFirst({
      where: {
        workspaceId: params.workspaceId,
        externalOrderId: params.externalOrderId,
      },
      select: { id: true },
    });

    if (existing) {
      console.log(`[createRevenueTransaction] Transaction already exists for order ${params.externalOrderId}`);
      return existing.id;
    }
  }

  const transaction = await prisma.revenueTransaction.create({
    data: {
      workspaceId: params.workspaceId,
      subscriberId: params.subscriberId,
      amount: params.amount,
      currency: params.currency,
      transactionType: params.transactionType,
      paymentMethod: params.paymentMethod,
      paymentStatus: params.paymentStatus,
      externalOrderId: params.externalOrderId,
      externalChargeId: params.externalChargeId,
      planName: params.planName,
      planAmount: params.planAmount,
      transactionDate: params.transactionDate,
      emailLogId: params.emailLogId,
    },
  });

  // Update email log with conversion if linked
  if (params.emailLogId) {
    await prisma.emailLog.update({
      where: { id: params.emailLogId },
      data: { convertedAt: params.transactionDate },
    });
  }

  return transaction.id;
}

