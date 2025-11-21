-- Migration to create Customer and related tables only (if they don't exist)
-- This is safe to run even if some tables already exist

-- Create Tenant table if it doesn't exist
CREATE TABLE IF NOT EXISTS "Tenant" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Cairo',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- Create Customer table if it doesn't exist
CREATE TABLE IF NOT EXISTS "Customer" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "externalUserId" BIGINT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "whatsapp" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- Create PointsBatch table if it doesn't exist
CREATE TABLE IF NOT EXISTS "PointsBatch" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" BIGINT NOT NULL,
    "source" TEXT NOT NULL,
    "externalOrderId" TEXT,
    "pointsTotal" INTEGER NOT NULL,
    "pointsRemaining" INTEGER NOT NULL,
    "purchasedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "PointsBatch_pkey" PRIMARY KEY ("id")
);

-- Create PointsTransaction table if it doesn't exist
CREATE TABLE IF NOT EXISTS "PointsTransaction" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" BIGINT NOT NULL,
    "batchId" BIGINT,
    "delta" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "externalEventId" BIGINT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PointsTransaction_pkey" PRIMARY KEY ("id")
);

-- Create WalletSnapshot table if it doesn't exist
CREATE TABLE IF NOT EXISTS "WalletSnapshot" (
    "tenantId" TEXT NOT NULL,
    "customerId" BIGINT NOT NULL,
    "pointsBalance" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletSnapshot_pkey" PRIMARY KEY ("tenantId","customerId")
);

-- Create ReminderRule table if it doesn't exist
CREATE TABLE IF NOT EXISTS "ReminderRule" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "offsetType" TEXT NOT NULL,
    "offsetValue" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReminderRule_pkey" PRIMARY KEY ("id")
);

-- Create ReminderJob table if it doesn't exist
CREATE TABLE IF NOT EXISTS "ReminderJob" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "ruleId" BIGINT NOT NULL,
    "customerId" BIGINT NOT NULL,
    "channel" TEXT NOT NULL,
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ReminderJob_pkey" PRIMARY KEY ("id")
);

-- Create Subscription table if it doesn't exist
CREATE TABLE IF NOT EXISTS "Subscription" (
    "id" BIGSERIAL NOT NULL,
    "tenantId" TEXT NOT NULL,
    "customerId" BIGINT,
    "externalSubscriptionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "planName" TEXT,
    "nextPaymentDate" TIMESTAMP(3),
    "currentPeriodEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS "Customer_tenantId_externalUserId_key" ON "Customer"("tenantId", "externalUserId");
CREATE UNIQUE INDEX IF NOT EXISTS "Customer_tenantId_externalUserId_unique" ON "Customer"("tenantId", "externalUserId");
CREATE INDEX IF NOT EXISTS "PointsBatch_customerId_idx" ON "PointsBatch"("customerId");
CREATE INDEX IF NOT EXISTS "PointsBatch_expiresAt_status_idx" ON "PointsBatch"("expiresAt", "status");
CREATE INDEX IF NOT EXISTS "PointsTransaction_customerId_createdAt_idx" ON "PointsTransaction"("customerId", "createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "PointsTransaction_tenantId_externalEventId_key" ON "PointsTransaction"("tenantId", "externalEventId");
CREATE UNIQUE INDEX IF NOT EXISTS "Subscription_tenantId_externalSubscriptionId_key" ON "Subscription"("tenantId", "externalSubscriptionId");

-- Add foreign keys if they don't exist (using DO blocks to handle errors gracefully)
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Customer_tenantId_fkey'
    ) THEN
        ALTER TABLE "Customer" ADD CONSTRAINT "Customer_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PointsBatch_tenantId_fkey'
    ) THEN
        ALTER TABLE "PointsBatch" ADD CONSTRAINT "PointsBatch_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PointsBatch_customerId_fkey'
    ) THEN
        ALTER TABLE "PointsBatch" ADD CONSTRAINT "PointsBatch_customerId_fkey" 
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PointsTransaction_tenantId_fkey'
    ) THEN
        ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PointsTransaction_customerId_fkey'
    ) THEN
        ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_customerId_fkey" 
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'PointsTransaction_batchId_fkey'
    ) THEN
        ALTER TABLE "PointsTransaction" ADD CONSTRAINT "PointsTransaction_batchId_fkey" 
        FOREIGN KEY ("batchId") REFERENCES "PointsBatch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WalletSnapshot_tenantId_fkey'
    ) THEN
        ALTER TABLE "WalletSnapshot" ADD CONSTRAINT "WalletSnapshot_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'WalletSnapshot_customerId_fkey'
    ) THEN
        ALTER TABLE "WalletSnapshot" ADD CONSTRAINT "WalletSnapshot_customerId_fkey" 
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ReminderRule_tenantId_fkey'
    ) THEN
        ALTER TABLE "ReminderRule" ADD CONSTRAINT "ReminderRule_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ReminderJob_tenantId_fkey'
    ) THEN
        ALTER TABLE "ReminderJob" ADD CONSTRAINT "ReminderJob_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ReminderJob_ruleId_fkey'
    ) THEN
        ALTER TABLE "ReminderJob" ADD CONSTRAINT "ReminderJob_ruleId_fkey" 
        FOREIGN KEY ("ruleId") REFERENCES "ReminderRule"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'ReminderJob_customerId_fkey'
    ) THEN
        ALTER TABLE "ReminderJob" ADD CONSTRAINT "ReminderJob_customerId_fkey" 
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_tenantId_fkey'
    ) THEN
        ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_tenantId_fkey" 
        FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Subscription_customerId_fkey'
    ) THEN
        ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_customerId_fkey" 
        FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Seed initial tenant if it doesn't exist
INSERT INTO "Tenant" ("id", "name", "timezone")
VALUES ('artly', 'Artly', 'Africa/Cairo')
ON CONFLICT ("id") DO NOTHING;

