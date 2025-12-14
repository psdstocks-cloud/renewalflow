-- AlterTable: Add conversion tracking fields to EmailLog
ALTER TABLE "EmailLog" ADD COLUMN IF NOT EXISTS "openedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "clickedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "convertedAt" TIMESTAMP(3);

-- CreateTable: RevenueTransaction
CREATE TABLE IF NOT EXISTS "RevenueTransaction" (
    "id" TEXT NOT NULL,
    "workspaceId" TEXT NOT NULL,
    "subscriberId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EGP',
    "transactionType" TEXT NOT NULL,
    "paymentMethod" TEXT,
    "paymentStatus" TEXT NOT NULL DEFAULT 'completed',
    "emailLogId" TEXT,
    "externalOrderId" TEXT,
    "externalChargeId" TEXT,
    "planName" TEXT,
    "planAmount" DOUBLE PRECISION,
    "transactionDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevenueTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RevenueTransaction_subscriberId_idx" ON "RevenueTransaction"("subscriberId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RevenueTransaction_workspaceId_transactionDate_idx" ON "RevenueTransaction"("workspaceId", "transactionDate");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RevenueTransaction_transactionType_idx" ON "RevenueTransaction"("transactionType");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RevenueTransaction_paymentStatus_idx" ON "RevenueTransaction"("paymentStatus");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RevenueTransaction_emailLogId_idx" ON "RevenueTransaction"("emailLogId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "RevenueTransaction_externalOrderId_idx" ON "RevenueTransaction"("externalOrderId");

-- AddForeignKey
ALTER TABLE "RevenueTransaction" ADD CONSTRAINT "RevenueTransaction_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueTransaction" ADD CONSTRAINT "RevenueTransaction_subscriberId_fkey" FOREIGN KEY ("subscriberId") REFERENCES "Subscriber"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevenueTransaction" ADD CONSTRAINT "RevenueTransaction_emailLogId_fkey" FOREIGN KEY ("emailLogId") REFERENCES "EmailLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

