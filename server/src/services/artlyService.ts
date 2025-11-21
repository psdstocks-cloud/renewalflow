import { addDays } from 'date-fns';
import { z } from 'zod';
import { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../config/db';

const TENANT_ID = 'artly'; // Legacy default, will be overridden by workspaceId

/**
 * Get tenant ID from workspaceId or use default
 */
function getTenantId(workspaceId?: string | null): string {
  return workspaceId || TENANT_ID;
}

const pointsEventSchema = z.object({
  external_event_id: z.number().int().optional(),
  wp_user_id: z.number().int(),
  email: z.string().email(),
  points_delta: z.number().int(),
  event_type: z.string(),
  source: z.string(),
  order_id: z.string().optional().nullable().transform(val => val === null ? undefined : val),
  created_at: z.string().datetime().or(z.string().transform((val) => {
    // Try to parse and reformat if not already in ISO format
    try {
      const date = new Date(val);
      if (isNaN(date.getTime())) {
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  })),
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

export const processPointsEvents = async (rawEvents: unknown, workspaceId?: string | null) => {
  // Preprocess events to handle null values and invalid datetime formats
  const rawEventsArray = Array.isArray(rawEvents) ? rawEvents : [];
  const preprocessedEvents = rawEventsArray.map((event: any) => {
    const preprocessed = { ...event };
    
    // Convert null order_id to undefined
    if (preprocessed.order_id === null) {
      preprocessed.order_id = undefined;
    }
    
    // Ensure created_at is in ISO 8601 format
    if (preprocessed.created_at) {
      try {
        const date = new Date(preprocessed.created_at);
        if (!isNaN(date.getTime())) {
          preprocessed.created_at = date.toISOString();
        } else {
          // Invalid date, use current time as fallback
          preprocessed.created_at = new Date().toISOString();
        }
      } catch (e) {
        preprocessed.created_at = new Date().toISOString();
      }
    } else {
      // If created_at is missing, use current time
      preprocessed.created_at = new Date().toISOString();
    }
    
    return preprocessed;
  });
  
  // Use safeParse to handle validation errors gracefully
  const parseResult = z.array(pointsEventSchema).safeParse(preprocessedEvents);
  
  if (!parseResult.success) {
    console.error('[processPointsEvents] Validation errors:', JSON.stringify(parseResult.error.errors, null, 2));
    // Return detailed error information
    throw new Error(`Validation failed: ${JSON.stringify(parseResult.error.errors)}`);
  }
  
  const events = parseResult.data;
  const tenantId = getTenantId(workspaceId);
  
  // Ensure tenant exists before processing events
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: workspaceId ? `Workspace ${workspaceId.substring(0, 8)}` : 'Artly',
      timezone: 'Africa/Cairo',
    },
  });
  
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
            tenantId,
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
            tenantId,
            externalUserId: BigInt(event.wp_user_id),
          },
        },
        update: { email: event.email },
        create: {
          tenantId,
          externalUserId: BigInt(event.wp_user_id),
          email: event.email,
        },
      });

      const createdAt = new Date(event.created_at);

      if (event.points_delta > 0) {
        const batch = await tx.pointsBatch.create({
          data: {
            tenantId,
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
            tenantId,
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
            tenantId,
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
            tenantId,
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

export const processSubscriptions = async (rawSubscriptions: unknown, workspaceId?: string | null) => {
  const subscriptions = z.array(subscriptionSchema).parse(rawSubscriptions);
  const tenantId = getTenantId(workspaceId);
  
  // Ensure tenant exists before processing subscriptions
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: workspaceId ? `Workspace ${workspaceId.substring(0, 8)}` : 'Artly',
      timezone: 'Africa/Cairo',
    },
  });
  
  let upserted = 0;

  for (const sub of subscriptions) {
    const customer = sub.wp_user_id && sub.email
      ? await prisma.customer.upsert({
          where: {
            tenantId_externalUserId: {
              tenantId,
              externalUserId: BigInt(sub.wp_user_id),
            },
          },
          update: { email: sub.email },
          create: {
            tenantId,
            externalUserId: BigInt(sub.wp_user_id),
            email: sub.email,
          },
        })
      : null;

    await prisma.subscription.upsert({
      where: {
        tenantId_externalSubscriptionId: {
          tenantId,
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
        tenantId,
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
  email: z.string().min(1), // Accept any non-empty string, validate email format later
  first_name: z.string().nullable().optional(),
  last_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  whatsapp: z.string().nullable().optional(),
  locale: z.string().nullable().optional(),
  timezone: z.string().nullable().optional(),
});

export const processUsers = async (rawUsers: unknown, workspaceId?: string | null) => {
  // Use safeParse to handle validation errors gracefully
  const parseResult = z.array(userSchema).safeParse(rawUsers);
  
  if (!parseResult.success) {
    console.error('[processUsers] Validation errors:', parseResult.error.errors);
    // Filter out invalid users and continue with valid ones
    const validUsers: any[] = [];
    const rawUsersArray = Array.isArray(rawUsers) ? rawUsers : [];
    
    for (let i = 0; i < rawUsersArray.length; i++) {
      const userResult = userSchema.safeParse(rawUsersArray[i]);
      if (userResult.success) {
        validUsers.push(userResult.data);
      } else {
        console.warn(`[processUsers] Skipping invalid user at index ${i}:`, userResult.error.errors);
      }
    }
    
    if (validUsers.length === 0) {
      throw new Error('No valid users found in the payload');
    }
    
    return await processUsersInternal(validUsers, workspaceId);
  }
  
  return await processUsersInternal(parseResult.data, workspaceId);
};

const processUsersInternal = async (users: z.infer<typeof userSchema>[], workspaceId?: string | null) => {
  const tenantId = getTenantId(workspaceId);
  
  // Ensure tenant exists before creating customers
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {}, // Don't update if exists
    create: {
      id: tenantId,
      name: workspaceId ? `Workspace ${workspaceId.substring(0, 8)}` : 'Artly',
      timezone: 'Africa/Cairo',
    },
  });
  
  // Filter out invalid users first
  const validUsers = users.filter(user => {
    if (!user.email || !user.email.includes('@')) {
      console.warn(`[processUsers] Skipping user ${user.wp_user_id} with invalid email: ${user.email}`);
      return false;
    }
    return true;
  });

  if (validUsers.length === 0) {
    return { upserted: 0 };
  }

  // Use a transaction to batch all upserts for better performance
  let upserted = 0;
  await prisma.$transaction(
    async (tx) => {
      for (const user of validUsers) {
        await tx.customer.upsert({
          where: {
            tenantId_externalUserId: {
              tenantId,
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
            tenantId,
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
    },
    {
      timeout: 30000, // 30 second timeout for transaction
    }
  );

  return { upserted };
};

const chargeSchema = z.object({
  external_charge_id: z.union([z.string(), z.number()]),
  wp_user_id: z.number().int().optional().nullable().transform(val => val === null ? undefined : val),
  email: z.string().email().optional(),
  order_id: z.string().optional(),
  amount: z.number(),
  currency: z.string().default('EGP'),
  status: z.string(),
  payment_method: z.string().optional(),
  created_at: z.string().datetime().or(z.string().transform((val) => {
    // Try to parse and reformat if not already in ISO format
    try {
      const date = new Date(val);
      if (isNaN(date.getTime())) {
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  })),
});

export const processCharges = async (rawCharges: unknown, workspaceId?: string | null) => {
  // Preprocess charges to handle invalid datetime formats
  const preprocessedCharges = (Array.isArray(rawCharges) ? rawCharges : []).map((data: any) => {
    // Ensure created_at is in ISO 8601 format
    if (data.created_at) {
      try {
        const date = new Date(data.created_at);
        if (isNaN(date.getTime())) {
          data.created_at = new Date().toISOString();
        } else {
          data.created_at = date.toISOString();
        }
      } catch (e) {
        data.created_at = new Date().toISOString();
      }
    } else {
      data.created_at = new Date().toISOString();
    }
    
    // Handle null wp_user_id
    if (data.wp_user_id === null) {
      data.wp_user_id = undefined;
    }
    
    return data;
  });

  const charges = z.array(chargeSchema).parse(preprocessedCharges);
  const tenantId = getTenantId(workspaceId);
  
  console.log('[processCharges] Starting charges sync...');
  console.log('[processCharges] Parsed', charges.length, 'charges for tenant:', tenantId);
  
  // Ensure tenant exists before processing charges
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: workspaceId ? `Workspace ${workspaceId.substring(0, 8)}` : 'Artly',
      timezone: 'Africa/Cairo',
    },
  });
  
  let upserted = 0;
  let errors: string[] = [];

  for (let i = 0; i < charges.length; i++) {
    const charge = charges[i];
    try {
    // Create or update customer if we have user info
    const customer = charge.wp_user_id && charge.email
      ? await prisma.customer.upsert({
          where: {
            tenantId_externalUserId: {
              tenantId,
              externalUserId: BigInt(charge.wp_user_id),
            },
          },
          update: { email: charge.email },
          create: {
            tenantId,
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
          tenantId,
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
    
    // Log progress every 50 records
    if (upserted % 50 === 0) {
      console.log(`[processCharges] Processed ${upserted}/${charges.length} charges...`);
    }
    } catch (error: any) {
      const errorMsg = `Error processing charge ${charge.external_charge_id}: ${error.message}`;
      console.error('[processCharges]', errorMsg);
      errors.push(errorMsg);
    }
  }

  console.log(`[processCharges] Completed: ${upserted} charges processed, ${errors.length} errors`);
  
  if (errors.length > 0) {
    console.error('[processCharges] Errors:', errors.slice(0, 10)); // Log first 10 errors
  }

  return { upserted, errors: errors.length > 0 ? errors.slice(0, 10) : undefined };
};


// Schema for points balance sync (current balances only)
const pointsBalanceSchema = z.object({
  wp_user_id: z.number().int(),
  email: z.string().email(),
  points_balance: z.number().int(),
});

export const processPointsBalances = async (rawBalances: unknown, workspaceId?: string | null) => {
  console.log('[processPointsBalances] Starting balance sync...');
  const balances = z.array(pointsBalanceSchema).parse(rawBalances);
  const tenantId = getTenantId(workspaceId);
  
  console.log('[processPointsBalances] Parsed', balances.length, 'balances for tenant:', tenantId);
  
  // Ensure tenant exists
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: workspaceId ? `Workspace ${workspaceId.substring(0, 8)}` : 'Artly',
      timezone: 'Africa/Cairo',
    },
  });
  
  let updated = 0;
  let errors: string[] = [];

  for (let i = 0; i < balances.length; i++) {
    const balance = balances[i];
    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        // Upsert customer
        const customer = await tx.customer.upsert({
          where: {
            tenantId_externalUserId: {
              tenantId,
              externalUserId: BigInt(balance.wp_user_id),
            },
          },
          update: { email: balance.email },
          create: {
            tenantId,
            externalUserId: BigInt(balance.wp_user_id),
            email: balance.email,
          },
        });

        // Update wallet snapshot with current balance
        await tx.walletSnapshot.upsert({
          where: {
            tenantId_customerId: {
              tenantId,
              customerId: customer.id,
            },
          },
          create: {
            tenantId,
            customerId: customer.id,
            pointsBalance: balance.points_balance,
          },
          update: {
            pointsBalance: balance.points_balance,
            updatedAt: new Date(),
          },
        });
      });

      updated += 1;
      
      // Log progress every 50 records
      if (updated % 50 === 0) {
        console.log(`[processPointsBalances] Processed ${updated}/${balances.length} balances...`);
      }
    } catch (error: any) {
      const errorMsg = `Error processing balance for wp_user_id ${balance.wp_user_id} (${balance.email}): ${error.message}`;
      console.error('[processPointsBalances]', errorMsg);
      errors.push(errorMsg);
    }
  }

  console.log(`[processPointsBalances] Completed: ${updated} balances updated, ${errors.length} errors`);
  
  if (errors.length > 0) {
    console.error('[processPointsBalances] Errors:', errors.slice(0, 10)); // Log first 10 errors
  }

  return { updated, errors: errors.length > 0 ? errors.slice(0, 10) : undefined };
};

// Schema for incremental points changes (new logs since last sync)
const pointsChangeSchema = z.object({
  external_event_id: z.number().int(),
  wp_user_id: z.number().int(),
  email: z.string().email(),
  points_delta: z.number().int(),
  event_type: z.string(),
  source: z.string(),
  order_id: z.string().optional().nullable().transform(val => val === null ? undefined : val),
  created_at: z.string().datetime().or(z.string().transform((val) => {
    try {
      const date = new Date(val);
      if (isNaN(date.getTime())) {
        return new Date().toISOString();
      }
      return date.toISOString();
    } catch {
      return new Date().toISOString();
    }
  })),
});

export const processPointsChanges = async (rawChanges: unknown, workspaceId?: string | null) => {
  // Preprocess changes to handle null values and invalid datetime formats
  const rawChangesArray = Array.isArray(rawChanges) ? rawChanges : [];
  const preprocessedChanges = rawChangesArray.map((change: any) => {
    const preprocessed = { ...change };
    
    if (preprocessed.order_id === null) {
      preprocessed.order_id = undefined;
    }
    
    if (preprocessed.created_at) {
      try {
        const date = new Date(preprocessed.created_at);
        if (!isNaN(date.getTime())) {
          preprocessed.created_at = date.toISOString();
        } else {
          preprocessed.created_at = new Date().toISOString();
        }
      } catch (e) {
        preprocessed.created_at = new Date().toISOString();
      }
    } else {
      preprocessed.created_at = new Date().toISOString();
    }
    
    return preprocessed;
  });
  
  const parseResult = z.array(pointsChangeSchema).safeParse(preprocessedChanges);
  
  if (!parseResult.success) {
    console.error('[processPointsChanges] Validation errors:', JSON.stringify(parseResult.error.errors, null, 2));
    throw new Error(`Validation failed: ${JSON.stringify(parseResult.error.errors)}`);
  }
  
  const changes = parseResult.data;
  const tenantId = getTenantId(workspaceId);
  
  // Ensure tenant exists
  await prisma.tenant.upsert({
    where: { id: tenantId },
    update: {},
    create: {
      id: tenantId,
      name: workspaceId ? `Workspace ${workspaceId.substring(0, 8)}` : 'Artly',
      timezone: 'Africa/Cairo',
    },
  });
  
  let imported = 0;
  let skippedExisting = 0;

  for (const change of changes) {
    if (change.points_delta === 0) {
      continue;
    }

    const externalEventId = BigInt(change.external_event_id);

    // Check if already processed
    const existing = await prisma.pointsTransaction.findUnique({
      where: {
        tenantId_externalEventId: {
          tenantId,
          externalEventId,
        },
      },
    });

    if (existing) {
      skippedExisting += 1;
      continue;
    }

    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const customer = await tx.customer.upsert({
        where: {
          tenantId_externalUserId: {
            tenantId,
            externalUserId: BigInt(change.wp_user_id),
          },
        },
        update: { email: change.email },
        create: {
          tenantId,
          externalUserId: BigInt(change.wp_user_id),
          email: change.email,
        },
      });

      const createdAt = new Date(change.created_at);

      if (change.points_delta > 0) {
        // Points added - create batch
        const batch = await tx.pointsBatch.create({
          data: {
            tenantId,
            customerId: customer.id,
            source: change.source,
            externalOrderId: change.order_id,
            pointsTotal: change.points_delta,
            pointsRemaining: change.points_delta,
            purchasedAt: createdAt,
            expiresAt: addDays(createdAt, 30),
            status: 'active',
          },
        });

        await tx.pointsTransaction.create({
          data: {
            tenantId,
            customerId: customer.id,
            batchId: batch.id,
            delta: change.points_delta,
            type: 'purchase',
            referenceType: 'woo_order',
            referenceId: change.order_id,
            externalEventId: externalEventId,
            createdAt,
          },
        });
      } else {
        // Points deducted - consume from batches
        const deltaToSpend = Math.abs(change.points_delta);
        let remaining = deltaToSpend;

        const batches = await tx.pointsBatch.findMany({
          where: {
            tenantId,
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
            tenantId,
            customerId: customer.id,
            delta: change.points_delta,
            type: 'spend_download',
            referenceType: 'woo_order',
            referenceId: change.order_id,
            externalEventId: externalEventId,
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
