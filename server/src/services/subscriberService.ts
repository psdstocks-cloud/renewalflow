import { prisma } from '../config/db';
import { Subscriber } from '@prisma/client';
import { z } from 'zod';
import { addDays } from 'date-fns';

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
