-- AlterTable
ALTER TABLE "PayoutPolicy"
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'UTC',
ADD COLUMN "nextRunAt" TIMESTAMP(3),
ADD COLUMN "lastRunAt" TIMESTAMP(3),
ADD COLUMN "autoApproveLimitUsdc" TEXT NOT NULL DEFAULT '0',
ADD COLUMN "maxRunAmountUsdc" TEXT,
ADD COLUMN "minChainLiquidityUsdc" TEXT,
ADD COLUMN "cronExpression" TEXT;