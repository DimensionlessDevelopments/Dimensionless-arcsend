-- AlterTable
ALTER TABLE "PayoutRun"
ADD COLUMN "scheduleWindowKey" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "PayoutRun_policyId_scheduleWindowKey_key" ON "PayoutRun"("policyId", "scheduleWindowKey");