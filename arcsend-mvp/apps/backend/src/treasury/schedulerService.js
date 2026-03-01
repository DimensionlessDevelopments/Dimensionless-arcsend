import { z } from 'zod';
import { db } from '../db.js';
import { createPayoutPreview, payoutRecipientSchema } from './payrollEngine.js';
import { computeNextCronRunAt, validateCronExpression } from './cronUtils.js';

const schedulerRunSchema = z.object({
  maxPolicies: z.number().int().min(1).max(200).optional(),
  nowIso: z.string().datetime().optional()
});

const recipientsSchema = z.array(payoutRecipientSchema).min(1).max(500);

function parseUsdc(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }
  return numeric;
}

function formatUsdc(value) {
  return Math.max(value, 0).toFixed(6);
}

function computeNextRunAt(policy, now) {
  const base = policy.nextRunAt && policy.nextRunAt > now ? policy.nextRunAt : now;

  if (policy.scheduleType === 'WEEKLY') {
    const next = new Date(base);
    next.setDate(next.getDate() + 7);
    return next;
  }

  if (policy.scheduleType === 'MONTHLY') {
    const next = new Date(base);
    next.setMonth(next.getMonth() + 1);
    return next;
  }

  if (policy.scheduleType === 'CUSTOM_CRON') {
    if (!policy.cronExpression) {
      return null;
    }
    validateCronExpression(policy.cronExpression);
    return computeNextCronRunAt(policy.cronExpression, base);
  }

  return null;
}

function computeScheduleWindowKey(policy, now) {
  if (policy.scheduleType === 'WEEKLY') {
    const windowDate = policy.nextRunAt || now;
    return `WEEKLY:${windowDate.toISOString().slice(0, 10)}`;
  }

  if (policy.scheduleType === 'MONTHLY') {
    const windowDate = policy.nextRunAt || now;
    const month = String(windowDate.getUTCMonth() + 1).padStart(2, '0');
    return `MONTHLY:${windowDate.getUTCFullYear()}-${month}`;
  }

  if (policy.scheduleType === 'CUSTOM_CRON') {
    return `CUSTOM:${(policy.nextRunAt || now).toISOString().slice(0, 16)}`;
  }

  return `MANUAL:${now.toISOString().slice(0, 16)}`;
}

export async function runPolicyScheduler({ input }) {
  const parsed = schedulerRunSchema.parse(input || {});
  const now = parsed.nowIso ? new Date(parsed.nowIso) : new Date();
  const maxPolicies = parsed.maxPolicies || 20;

  const duePolicies = await db.payoutPolicy.findMany({
    where: {
      isActive: true,
      scheduleType: { in: ['WEEKLY', 'MONTHLY', 'CUSTOM_CRON'] },
      nextRunAt: { lte: now }
    },
    orderBy: { nextRunAt: 'asc' },
    take: maxPolicies
  });

  const results = [];

  for (const policy of duePolicies) {
    try {
      const scheduleWindowKey = computeScheduleWindowKey(policy, now);
      const existingRun = await db.payoutRun.findFirst({
        where: {
          policyId: policy.id,
          scheduleWindowKey
        },
        orderBy: { createdAt: 'desc' }
      });

      if (existingRun) {
        results.push({
          policyId: policy.id,
          policyName: policy.name,
          runId: existingRun.id,
          action: 'skipped_duplicate_window',
          scheduleWindowKey,
          existingRunStatus: existingRun.status
        });

        await db.payoutPolicy.update({
          where: { id: policy.id },
          data: {
            lastRunAt: now,
            nextRunAt: computeNextRunAt(policy, now)
          }
        });

        continue;
      }

      const recipientsRaw = policy.rules && typeof policy.rules === 'object' ? policy.rules.recipients : undefined;
      const recipients = recipientsSchema.parse(recipientsRaw || []);

      const preview = await createPayoutPreview({
        userId: policy.userId,
        input: {
          name: `[AUTO] ${policy.name} ${now.toISOString()}`,
          policyId: policy.id,
          recipients
        },
        runOptions: {
          scheduleWindowKey
        }
      });

      const plannedTotal = parseUsdc(preview.summary.plannedTotalUsdc);
      const maxRunAmount = parseUsdc(policy.maxRunAmountUsdc || '0');

      if (maxRunAmount > 0 && plannedTotal > maxRunAmount) {
        results.push({
          policyId: policy.id,
          policyName: policy.name,
          runId: preview.run.id,
          action: 'drafted_over_limit',
          scheduleWindowKey,
          reason: `Planned total ${formatUsdc(plannedTotal)} exceeds maxRunAmountUsdc ${formatUsdc(maxRunAmount)}`
        });

        await db.payoutPolicy.update({
          where: { id: policy.id },
          data: {
            lastRunAt: now,
            nextRunAt: computeNextRunAt(policy, now)
          }
        });

        continue;
      }

      const autoApproveLimit = parseUsdc(policy.autoApproveLimitUsdc || '0');
      const shouldAutoApprove = autoApproveLimit > 0 && plannedTotal <= autoApproveLimit && preview.summary.executableItems > 0;

      let runStatus = preview.run.status;
      if (shouldAutoApprove) {
        const approved = await db.payoutRun.update({
          where: { id: preview.run.id },
          data: {
            status: 'APPROVED',
            dryRun: false
          }
        });
        runStatus = approved.status;
      }

      await db.payoutPolicy.update({
        where: { id: policy.id },
        data: {
          lastRunAt: now,
          nextRunAt: computeNextRunAt(policy, now)
        }
      });

      results.push({
        policyId: policy.id,
        policyName: policy.name,
        runId: preview.run.id,
        scheduleWindowKey,
        action: shouldAutoApprove ? 'auto_approved' : 'drafted_manual_approval',
        runStatus,
        plannedTotalUsdc: preview.summary.plannedTotalUsdc,
        executableItems: preview.summary.executableItems
      });
    } catch (error) {
      results.push({
        policyId: policy.id,
        policyName: policy.name,
        action: 'error',
        error: error.message || 'Scheduler processing failed'
      });
    }
  }

  return {
    schedulerRunAt: now.toISOString(),
    scannedPolicies: duePolicies.length,
    results
  };
}
