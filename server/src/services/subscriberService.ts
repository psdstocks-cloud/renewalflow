import { prisma } from '../config/db';
import { z } from 'zod';
import { addDays } from 'date-fns';

// Get Subscriber type from Prisma query return type
type Subscriber = Awaited<ReturnType<typeof prisma.subscriber.findUnique>>;

const subscriberSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
  planName: z.string(),
  amount: z.number(),
  currency: z.string().default('EGP'),
  pointsRemaining: z.number().int().nonnegative().default(0),
  status: z.string(),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  paymentLink: z.string().optional(),
  lastPurchaseDate: z.coerce.date().optional()
});

export type SubscriberInput = z.infer<typeof subscriberSchema>;

export interface ListSubscribersParams {
  workspaceId: string;
  q?: string; // Free-text search
  status?: string;
  source?: string; // Not in schema yet, but prepare for it
  tag?: string; // Not in schema yet, but prepare for it
  nextRenewalFrom?: Date | string;
  nextRenewalTo?: Date | string;
  expiringInDays?: number;
  hasPhone?: boolean;
  skip?: number;
  take?: number;
  sortBy?: string;
  sortDir?: 'asc' | 'desc';
}

export async function listSubscribers(params: ListSubscribersParams) {
  const {
    workspaceId,
    q,
    status,
    source, // Reserved for future use
    tag, // Reserved for future use
    nextRenewalFrom,
    nextRenewalTo,
    expiringInDays,
    hasPhone,
    skip = 0,
    take = 25,
    sortBy = 'endDate',
    sortDir = 'asc',
  } = params;

  const where: any = { workspaceId };

  // Free-text search across multiple fields
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { planName: { contains: q, mode: 'insensitive' } },
    ];
  }

  // Status filter
  if (status) {
    where.status = status;
  }

  // Source filter (reserved for future schema addition)
  // if (source) {
  //   where.source = source;
  // }

  // Tag filter (reserved for future schema addition)
  // if (tag) {
  //   where.tags = { has: tag };
  // }

  // Date range filter for next renewal (using endDate as proxy)
  if (nextRenewalFrom || nextRenewalTo) {
    where.endDate = {};
    if (nextRenewalFrom) {
      where.endDate.gte = typeof nextRenewalFrom === 'string' ? new Date(nextRenewalFrom) : nextRenewalFrom;
    }
    if (nextRenewalTo) {
      where.endDate.lte = typeof nextRenewalTo === 'string' ? new Date(nextRenewalTo) : nextRenewalTo;
    }
  }

  // Convenience filter: expiring in N days
  if (expiringInDays !== undefined) {
    const now = new Date();
    const futureDate = new Date();
    futureDate.setDate(now.getDate() + expiringInDays);
    where.endDate = {
      gte: now,
      lte: futureDate,
    };
    // Also filter to active status for expiring soon
    if (!status) {
      where.status = 'ACTIVE';
    }
  }

  // Phone filter
  if (hasPhone !== undefined) {
    if (hasPhone) {
      where.phone = { not: null };
    } else {
      where.phone = null;
    }
  }

  // Sorting - whitelist allowed fields
  const allowedSortFields = ['endDate', 'createdAt', 'lastPurchaseDate', 'lastNotifiedAt', 'pointsRemaining', 'amount'];
  const sortBySafe = allowedSortFields.includes(sortBy) ? sortBy : 'endDate';
  const orderBy: any = { [sortBySafe]: sortDir === 'desc' ? 'desc' : 'asc' };

  // Pagination
  const page = Math.max(1, Math.floor(skip / take) + 1);
  const pageSize = Math.min(100, Math.max(1, take));

  const [items, total] = await Promise.all([
    prisma.subscriber.findMany({
      where,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy,
    }),
    prisma.subscriber.count({ where }),
  ]);

  const totalPages = Math.ceil(total / pageSize);

  return {
    data: items,
    meta: {
      page,
      pageSize,
      totalItems: total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
}

export function getSubscriber(id: string) {
  return prisma.subscriber.findUnique({ where: { id } });
}

// Get default workspace ID (for now, use the first workspace)
// TODO: Get workspaceId from authenticated user context
async function getDefaultWorkspaceId(): Promise<string> {
  const workspace = await prisma.workspace.findFirst();
  if (!workspace) {
    throw new Error('No workspace found. Please bootstrap a workspace first.');
  }
  return workspace.id;
}

export async function createSubscriber(data: SubscriberInput, workspaceId?: string): Promise<Subscriber> {
  const parsed = subscriberSchema.parse(data);
  const wsId = workspaceId || await getDefaultWorkspaceId();
  return prisma.subscriber.create({ data: { ...parsed, workspaceId: wsId } });
}

export async function updateSubscriber(id: string, data: Partial<SubscriberInput>): Promise<Subscriber> {
  const parsed = subscriberSchema.partial().parse(data);
  return prisma.subscriber.update({ where: { id }, data: parsed });
}

export function cancelSubscriber(id: string) {
  return prisma.subscriber.update({ where: { id }, data: { status: 'CANCELLED' } });
}

export async function importSubscribers(subscribers: SubscriberInput[], workspaceId?: string) {
  let created = 0;
  let updated = 0;
  const wsId = workspaceId || await getDefaultWorkspaceId();
  for (const sub of subscribers) {
    const parsed = subscriberSchema.parse(sub);
    const existing = await prisma.subscriber.findUnique({ where: { email: parsed.email } });
    if (existing) {
      await prisma.subscriber.update({ where: { id: existing.id }, data: parsed });
      updated += 1;
    } else {
      await prisma.subscriber.create({ data: { ...parsed, workspaceId: wsId } });
      created += 1;
    }
  }
  return { created, updated };
}

export async function subscriberStats(referenceDate: Date, expiringThresholdDays: number) {
  const [totalActive, totalExpired, totalCancelled, totalPointsRemaining, expiringSoon] = await Promise.all([
    prisma.subscriber.count({ where: { status: 'ACTIVE' } }),
    prisma.subscriber.count({ where: { status: 'EXPIRED' } }),
    prisma.subscriber.count({ where: { status: 'CANCELLED' } }),
    prisma.subscriber.aggregate({ _sum: { pointsRemaining: true } }),
    prisma.subscriber.count({
      where: {
        status: 'ACTIVE',
        endDate: {
          gte: referenceDate,
          lte: addDays(referenceDate, expiringThresholdDays)
        }
      }
    })
  ]);

  return {
    totalActive,
    totalExpired,
    totalCancelled,
    totalPointsRemaining: totalPointsRemaining._sum.pointsRemaining ?? 0,
    expiringSoon
  };
}

/**
 * Sync Customers from Artly integration to Subscriber records
 * This converts Customer records (from WordPress sync) into Subscriber records (for frontend display)
 */
// In-memory progress tracking for sync operations
const syncProgressMap = new Map<string, {
  status: 'running' | 'completed' | 'error';
  processed: number;
  total: number;
  created: number;
  updated: number;
  message: string;
  startTime: Date;
  endTime?: Date;
}>();

export function getSyncProgress(workspaceId: string) {
  return syncProgressMap.get(workspaceId) || null;
}

export function clearSyncProgress(workspaceId: string) {
  syncProgressMap.delete(workspaceId);
}

export async function syncCustomersToSubscribers(workspaceId: string, updateProgress?: (progress: { processed: number; total: number; created: number; updated: number }) => void) {
  const tenantId = workspaceId; // tenantId = workspaceId for Artly integration
  
  // Initialize progress
  const startTime = new Date();
  syncProgressMap.set(workspaceId, {
    status: 'running',
    processed: 0,
    total: 0,
    created: 0,
    updated: 0,
    message: 'Starting sync...',
    startTime,
  });
  
  // Get all customers for this workspace/tenant
  // Note: Customer.email should be WordPress user email (from users sync or charges sync)
  // If it's a billing email, that means the customer was created from a guest order (no wp_user_id)
  const customers = await prisma.customer.findMany({
    where: { tenantId },
    include: {
      subscriptions: {
        where: {
          status: {
            in: ['active', 'trialing', 'pending']
          }
        },
        orderBy: { createdAt: 'desc' },
        take: 1 // Get the most recent active subscription
      },
      walletSnapshots: {
        take: 1
      }
    }
  });

  const total = customers.length;
  syncProgressMap.set(workspaceId, {
    status: 'running',
    processed: 0,
    total,
    created: 0,
    updated: 0,
    message: `Processing ${total} customers...`,
    startTime,
  });

  let created = 0;
  let updated = 0;
  const wsId = workspaceId || await getDefaultWorkspaceId();

  // Batch fetch all last purchase dates at once for better performance
  const customerIds = customers.map(c => c.id);
  const lastPurchaseTransactions = await prisma.pointsTransaction.findMany({
    where: {
      tenantId,
      customerId: { in: customerIds },
      type: {
        in: ['purchase', 'charge']
      }
    },
    orderBy: {
      createdAt: 'desc'
    },
    // Fetch transactions, we'll dedupe to get most recent per customer in memory
    take: customerIds.length * 5, // Reasonable limit
  });

  // Create a map for quick lookup
  const lastPurchaseMap = new Map<bigint, Date>();
  for (const transaction of lastPurchaseTransactions) {
    const existing = lastPurchaseMap.get(transaction.customerId);
    if (!existing || transaction.createdAt > existing) {
      lastPurchaseMap.set(transaction.customerId, transaction.createdAt);
    }
  }

  // Batch fetch all existing subscribers to avoid N+1 queries
  const customerEmails = customers.map(c => c.email);
  const existingSubscribers = await prisma.subscriber.findMany({
    where: {
      email: { in: customerEmails },
      workspaceId: wsId,
    }
  });
  const existingSubscribersMap = new Map<string, typeof existingSubscribers[0]>();
  for (const sub of existingSubscribers) {
    existingSubscribersMap.set(sub.email, sub);
  }

  for (let i = 0; i < customers.length; i++) {
    const customer = customers[i];
    try {
      // Get the most recent active subscription or use defaults
      const subscription = customer.subscriptions[0];
      
      // Get points balance
      const walletSnapshot = customer.walletSnapshots[0];
      const pointsRemaining = walletSnapshot?.pointsBalance ?? 0;

      // Get last purchase date from map (much faster than individual queries)
      const lastPurchaseDate = lastPurchaseMap.get(customer.id) || null;

    // Determine subscriber status from subscription
    let status = 'ACTIVE';
    let startDate = new Date();
    let endDate = addDays(new Date(), 30); // Default 30 days
    let planName = 'Default Plan';
    let amount = 0;
    let currency = 'EGP';

    if (subscription) {
      // Map subscription status to subscriber status
      if (subscription.status === 'active' || subscription.status === 'trialing') {
        status = 'ACTIVE';
      } else if (subscription.status === 'cancelled' || subscription.status === 'expired') {
        status = 'EXPIRED';
      } else {
        status = 'ACTIVE';
      }

      planName = subscription.planName || 'Subscription Plan';
      
      // Use subscription dates if available
      if (subscription.currentPeriodEnd) {
        endDate = subscription.currentPeriodEnd;
      }
      if (subscription.nextPaymentDate) {
        startDate = subscription.nextPaymentDate;
      }
    }

    // If we have a last purchase date, calculate endDate as 30 days from last purchase
    if (lastPurchaseDate) {
      endDate = addDays(lastPurchaseDate, 30);
      startDate = lastPurchaseDate;
    }

      // Create name from email (or use email as name)
      const name = customer.email.split('@')[0] || customer.email;

      // Note: customer.email should be WordPress user email (from users sync or charges sync)
      // If it's a billing email, that means:
      // 1. Customer was created from a guest order (no wp_user_id) - this is expected
      // 2. Customer record wasn't updated by users sync yet - run "Sync Users" in WordPress plugin
      // 3. Customer record was created before charges sync fix - re-sync charges

      // Check if subscriber already exists by email (from batch lookup)
      const existing = existingSubscribersMap.get(customer.email);

      const subscriberData = {
        name,
        email: customer.email,
        phone: customer.phone || undefined,
        planName,
        amount,
        currency,
        pointsRemaining,
        status,
        startDate,
        endDate,
        paymentLink: undefined,
        lastPurchaseDate: lastPurchaseDate || undefined
      };

      if (existing) {
        // Update existing subscriber
        await prisma.subscriber.update({
          where: { id: existing.id },
          data: { ...subscriberData, workspaceId: wsId }
        });
        updated += 1;
      } else {
        // Create new subscriber
        await prisma.subscriber.create({
          data: { ...subscriberData, workspaceId: wsId }
        });
        created += 1;
      }
    } catch (error: any) {
      // Log error but continue processing other customers
      console.error(`[syncCustomersToSubscribers] Error processing customer ${customer.email}:`, error.message);
      // Continue to next customer
    }

    // Update progress every 10 customers or on last customer
    const processed = i + 1;
    if (processed % 10 === 0 || processed === customers.length) {
      const progress = {
        status: 'running' as const,
        processed,
        total,
        created,
        updated,
        message: `Processed ${processed} of ${total} customers...`,
        startTime,
      };
      syncProgressMap.set(workspaceId, progress);
      if (updateProgress) {
        updateProgress({ processed, total, created, updated });
      }
    }
  }

  const endTime = new Date();
  const finalProgress = {
    status: 'completed' as const,
    processed: total,
    total,
    created,
    updated,
    message: `Successfully synced ${created} new and ${updated} existing subscribers.`,
    startTime,
    endTime,
  };
  syncProgressMap.set(workspaceId, finalProgress);

  // Clear progress after 5 minutes
  setTimeout(() => {
    syncProgressMap.delete(workspaceId);
  }, 5 * 60 * 1000);

  return { created, updated, total: customers.length };
}
