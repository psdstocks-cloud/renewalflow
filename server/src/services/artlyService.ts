import { addDays } from 'date-fns';
import { z } from 'zod';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/db';

const TENANT_ID = 'artly';

const pointsEventSchema = z.object({
  external_event_id: z.number().int().optional(),
  wp_user_id: z.number().int(),
  email: z.string().email(),
  points_delta: z.number().int(),
  event_type: z.string(),
  source: z.string(),
  order_id: z.string().optional(),
  created_at: z.string().datetime(),
});

const subscriptionSchema = z.object({
  external_subscription_id: z.union([z.string(), z.number()]),
  wp_user_id: z.number().int().optional(),
  email: z.string().email().optional(),
  status: z.string(),
  plan_name: z.string().optional(),
  next_payment_date: z.string().datetime().optional(),
  current_period_end: z.string().datetime().optional(),
});

export type PointsEventInput = z.infer<typeof pointsEventSchema>;
export type SubscriptionInput = z.infer<typeof subscriptionSchema>;

type Client = PrismaClient | Prisma.TransactionClient;

const recalculateWalletSnapshot = async (
  client: Client,
  customerId: bigint,
) => {
  const balance = await client.pointsBatch.aggregate({
    _sum: { pointsRemaining: true },
    where: {
      tenantId: TENANT_ID,
      customerId,
      status: 'active',
    },
  });

  const pointsBalance = balance._sum.pointsRemaining ?? 0;

  await client.walletSnapshot.upsert({
    where: { tenantId_customerId: { tenantId: TENANT_ID, customerId } },
    create: {
      tenantId: TENANT_ID,
      customerId,
      pointsBalance,
    },
    update: { pointsBalance, updatedAt: new Date() },
  });
};

export const processPointsEvents = async (rawEvents: unknown) => {
  const events = z.array(pointsEventSchema).parse(rawEvents);
  let imported = 0;
  let skippedExisting = 0;

  for (const event of events) {
    if (event.points_delta === 0) {
      continue;
    }

    const externalEventId = event.external_event_id !== undefined
      ? BigInt(event.external_event_id)
      : null;

    if (externalEventId) {
      const existing = await prisma.pointsTransaction.findUnique({
        where: {
          tenantId_externalEventId: {
            tenantId: TENANT_ID,
            externalEventId,
          },
        },
      });

      if (existing) {
        skippedExisting += 1;
        continue;
      }
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const customer = await tx.customer.upsert({
        where: {
          tenantId_externalUserId: {
            tenantId: TENANT_ID,
            externalUserId: BigInt(event.wp_user_id),
          },
        },
        update: { email: event.email },
        create: {
          tenantId: TENANT_ID,
          externalUserId: BigInt(event.wp_user_id),
          email: event.email,
        },
      });

      const createdAt = new Date(event.created_at);

      if (event.points_delta > 0) {
        const batch = await tx.pointsBatch.create({
          data: {
            tenantId: TENANT_ID,
            customerId: customer.id,
            source: event.source,
            externalOrderId: event.order_id,
            pointsTotal: event.points_delta,
            pointsRemaining: event.points_delta,
            purchasedAt: createdAt,
            expiresAt: addDays(createdAt, 30),
            status: 'active',
          },
        });

        await tx.pointsTransaction.create({
          data: {
            tenantId: TENANT_ID,
            customerId: customer.id,
            batchId: batch.id,
            delta: event.points_delta,
            type: 'purchase',
            referenceType: 'woo_order',
            referenceId: event.order_id,
            externalEventId: externalEventId ?? undefined,
            createdAt,
          },
        });
      } else {
        const deltaToSpend = Math.abs(event.points_delta);
        let remaining = deltaToSpend;

        const batches = await tx.pointsBatch.findMany({
          where: {
            tenantId: TENANT_ID,
            customerId: customer.id,
            status: 'active',
            pointsRemaining: { gt: 0 },
          },
          orderBy: { purchasedAt: 'asc' },
        });

        for (const batch of batches) {
          if (remaining <= 0) break;
          const consume = Math.min(batch.pointsRemaining, remaining);
          await tx.pointsBatch.update({
            where: { id: batch.id },
            data: { pointsRemaining: batch.pointsRemaining - consume },
          });
          remaining -= consume;
        }

        await tx.pointsTransaction.create({
          data: {
            tenantId: TENANT_ID,
            customerId: customer.id,
            delta: event.points_delta,
            type: 'spend_download',
            referenceType: 'woo_order',
            referenceId: event.order_id,
            externalEventId: externalEventId ?? undefined,
            createdAt,
          },
        });
      }

      await recalculateWalletSnapshot(tx, customer.id);
    });

    imported += 1;
  }

  return { imported, skipped_existing: skippedExisting };
};

export const expirePoints = async () => {
  const expiring = await prisma.pointsBatch.findMany({
    where: {
      tenantId: TENANT_ID,
      status: 'active',
      expiresAt: { lte: new Date() },
      pointsRemaining: { gt: 0 },
    },
  });

  if (!expiring.length) return { expiredBatches: 0 };

  const affectedCustomers = new Set<bigint>();

  await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    for (const batch of expiring) {
      await tx.pointsTransaction.create({
        data: {
          tenantId: TENANT_ID,
          customerId: batch.customerId,
          batchId: batch.id,
          delta: -batch.pointsRemaining,
          type: 'expiry',
          description: 'Monthly points expiry',
        },
      });

      await tx.pointsBatch.update({
        where: { id: batch.id },
        data: { pointsRemaining: 0, status: 'expired' },
      });

      affectedCustomers.add(batch.customerId);
    }
  });

  for (const customerId of affectedCustomers) {
    await recalculateWalletSnapshot(prisma, customerId);
  }

  return { expiredBatches: expiring.length };
};

export const processSubscriptions = async (rawSubscriptions: unknown) => {
  const subscriptions = z.array(subscriptionSchema).parse(rawSubscriptions);
  let upserted = 0;

  for (const sub of subscriptions) {
    const customer = sub.wp_user_id && sub.email
      ? await prisma.customer.upsert({
          where: {
            tenantId_externalUserId: {
              tenantId: TENANT_ID,
              externalUserId: BigInt(sub.wp_user_id),
            },
          },
          update: { email: sub.email },
          create: {
            tenantId: TENANT_ID,
            externalUserId: BigInt(sub.wp_user_id),
            email: sub.email,
          },
        })
      : null;

    await prisma.subscription.upsert({
      where: {
        tenantId_externalSubscriptionId: {
          tenantId: TENANT_ID,
          externalSubscriptionId: String(sub.external_subscription_id),
        },
      },
      update: {
        status: sub.status,
        planName: sub.plan_name,
        nextPaymentDate: sub.next_payment_date ? new Date(sub.next_payment_date) : null,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : null,
        customerId: customer?.id,
      },
      create: {
        tenantId: TENANT_ID,
        externalSubscriptionId: String(sub.external_subscription_id),
        status: sub.status,
        planName: sub.plan_name,
        nextPaymentDate: sub.next_payment_date ? new Date(sub.next_payment_date) : null,
        currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end) : null,
        customerId: customer?.id,
      },
    });

    upserted += 1;
  }

  return { upserted };
};

const userSchema = z.object({
  wp_user_id: z.number().int(),
  email: z.string().email(),
  phone: z.string().optional(),
  whatsapp: z.string().optional(),
  locale: z.string().optional(),
  timezone: z.string().optional(),
});

export const processUsers = async (rawUsers: unknown) => {
  const users = z.array(userSchema).parse(rawUsers);
  let upserted = 0;

  for (const user of users) {
    await prisma.customer.upsert({
      where: {
        tenantId_externalUserId: {
          tenantId: TENANT_ID,
          externalUserId: BigInt(user.wp_user_id),
        },
      },
      update: {
        email: user.email,
        phone: user.phone ?? undefined,
        whatsapp: user.whatsapp ?? undefined,
        locale: user.locale ?? 'en',
        timezone: user.timezone ?? undefined,
      },
      create: {
        tenantId: TENANT_ID,
        externalUserId: BigInt(user.wp_user_id),
        email: user.email,
        phone: user.phone ?? undefined,
        whatsapp: user.whatsapp ?? undefined,
        locale: user.locale ?? 'en',
        timezone: user.timezone ?? undefined,
      },
    });

    upserted += 1;
  }

  return { upserted };
};

const chargeSchema = z.object({
  external_charge_id: z.union([z.string(), z.number()]),
  wp_user_id: z.number().int().optional(),
  email: z.string().email().optional(),
  order_id: z.string().optional(),
  amount: z.number(),
  currency: z.string().default('EGP'),
  status: z.string(),
  payment_method: z.string().optional(),
  created_at: z.string().datetime(),
});

export const processCharges = async (rawCharges: unknown) => {
  const charges = z.array(chargeSchema).parse(rawCharges);
  let upserted = 0;

  for (const charge of charges) {
    // Create or update customer if we have user info
    const customer = charge.wp_user_id && charge.email
      ? await prisma.customer.upsert({
          where: {
            tenantId_externalUserId: {
              tenantId: TENANT_ID,
              externalUserId: BigInt(charge.wp_user_id),
            },
          },
          update: { email: charge.email },
          create: {
            tenantId: TENANT_ID,
            externalUserId: BigInt(charge.wp_user_id),
            email: charge.email,
          },
        })
      : null;

    // Store charge information in points transaction with reference
    if (customer && charge.amount > 0) {
      const createdAt = new Date(charge.created_at);
      
      await prisma.pointsTransaction.create({
        data: {
          tenantId: TENANT_ID,
          customerId: customer.id,
          delta: 0, // Charge itself doesn't add points, but we track it
          type: 'charge',
          description: `Charge: ${charge.amount} ${charge.currency}`,
          referenceType: 'woo_order',
          referenceId: charge.order_id ?? String(charge.external_charge_id),
          createdAt,
        },
      });
    }

    upserted += 1;
  }

  return { upserted };
};
