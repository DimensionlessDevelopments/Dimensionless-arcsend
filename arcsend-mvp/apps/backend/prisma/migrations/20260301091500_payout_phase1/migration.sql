-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('MANUAL', 'WEEKLY', 'MONTHLY', 'CUSTOM_CRON');

-- CreateEnum
CREATE TYPE "PayoutRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'EXECUTING', 'PARTIAL', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PayoutItemStatus" AS ENUM ('PLANNED', 'QUEUED', 'EXECUTING', 'CONFIRMED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "PayoutRecipient" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "label" TEXT,
    "address" TEXT NOT NULL,
    "chain" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutPolicy" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scheduleType" "ScheduleType" NOT NULL DEFAULT 'MANUAL',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "rules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutRun" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "policyId" TEXT,
    "name" TEXT,
    "status" "PayoutRunStatus" NOT NULL DEFAULT 'DRAFT',
    "dryRun" BOOLEAN NOT NULL DEFAULT true,
    "totalAmountUsdc" TEXT NOT NULL DEFAULT '0',
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutItem" (
    "id" TEXT NOT NULL,
    "runId" TEXT NOT NULL,
    "recipientId" TEXT,
    "recipientLabel" TEXT,
    "recipientAddress" TEXT NOT NULL,
    "recipientChain" TEXT NOT NULL,
    "amountUsdc" TEXT NOT NULL,
    "plannedSourceChain" TEXT,
    "plannedRouteId" TEXT,
    "status" "PayoutItemStatus" NOT NULL DEFAULT 'PLANNED',
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayoutRecipient_userId_idx" ON "PayoutRecipient"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRecipient_userId_address_chain_key" ON "PayoutRecipient"("userId", "address", "chain");

-- CreateIndex
CREATE INDEX "PayoutPolicy_userId_idx" ON "PayoutPolicy"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutPolicy_userId_name_key" ON "PayoutPolicy"("userId", "name");

-- CreateIndex
CREATE INDEX "PayoutRun_userId_createdAt_idx" ON "PayoutRun"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "PayoutRun_policyId_idx" ON "PayoutRun"("policyId");

-- CreateIndex
CREATE INDEX "PayoutItem_runId_idx" ON "PayoutItem"("runId");

-- CreateIndex
CREATE INDEX "PayoutItem_recipientId_idx" ON "PayoutItem"("recipientId");

-- AddForeignKey
ALTER TABLE "PayoutRecipient" ADD CONSTRAINT "PayoutRecipient_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutPolicy" ADD CONSTRAINT "PayoutPolicy_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRun" ADD CONSTRAINT "PayoutRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutRun" ADD CONSTRAINT "PayoutRun_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "PayoutPolicy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_runId_fkey" FOREIGN KEY ("runId") REFERENCES "PayoutRun"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutItem" ADD CONSTRAINT "PayoutItem_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "PayoutRecipient"("id") ON DELETE SET NULL ON UPDATE CASCADE;
