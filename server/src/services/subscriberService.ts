import { prisma } from '../config/db';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { addDays } from 'date-fns';

type Subscriber = Prisma.SubscriberGetPayload<{}>;

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
  paymentLink: z.string().optional()
});

export type SubscriberInput = z.infer<typeof subscriberSchema>;

export async function listSubscribers(params: { status?: string; search?: string; skip?: number; take?: number }) {
  const { status, search, skip = 0, take = 50 } = params;
  const where: any = {};
  if (status) {
    where.status = status;
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } }
    ];
  }
  const [items, total] = await Promise.all([
    prisma.subscriber.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
    prisma.subscriber.count({ where })
  ]);
  return { items, total };
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
export async function syncCustomersToSubscribers(workspaceId: string) {
  const tenantId = workspaceId; // tenantId = workspaceId for Artly integration
  
  // Get all customers for this workspace/tenant
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

  let created = 0;
  let updated = 0;
  const wsId = workspaceId || await getDefaultWorkspaceId();

  for (const customer of customers) {
    // Get the most recent active subscription or use defaults
    const subscription = customer.subscriptions[0];
    
    // Get points balance
    const walletSnapshot = customer.walletSnapshots[0];
    const pointsRemaining = walletSnapshot?.pointsBalance ?? 0;

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

    // Create name from email (or use email as name)
    const name = customer.email.split('@')[0] || customer.email;

    // Check if subscriber already exists by email
    const existing = await prisma.subscriber.findUnique({ 
      where: { email: customer.email } 
    });

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
      paymentLink: undefined
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
  }

  return { created, updated, total: customers.length };
}
