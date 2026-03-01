-- AlterTable
ALTER TABLE "PayoutItem"
ADD COLUMN "retryCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "maxRetryAttempts" INTEGER NOT NULL DEFAULT 3,
ADD COLUMN "nextRetryAt" TIMESTAMP(3),
ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
ADD COLUMN "lastErrorCode" TEXT;

-- CreateIndex
CREATE INDEX "PayoutItem_status_nextRetryAt_idx" ON "PayoutItem"("status", "nextRetryAt");