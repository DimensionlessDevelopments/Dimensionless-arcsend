import { z } from 'zod';
import { db } from '../db.js';
import { computeNextCronRunAt, validateCronExpression } from '../treasury/cronUtils.js';

const scheduleTypeEnum = z.enum(['MANUAL', 'WEEKLY', 'MONTHLY', 'CUSTOM_CRON']);
const usdcStringSchema = z.string().regex(/^\d+(\.\d{1,6})?$/);

function parseIsoDate(value) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function deriveDefaultNextRunAt(scheduleType, now = new Date()) {
  if (scheduleType === 'WEEKLY') {
    const next = new Date(now);
    next.setDate(next.getDate() + 7);
    return next;
  }

  if (scheduleType === 'MONTHLY') {
    const next = new Date(now);
    next.setMonth(next.getMonth() + 1);
    return next;
  }

  return null;
}

function deriveNextRunAt({ scheduleType, cronExpression, explicitNextRunAt, now = new Date() }) {
  if (explicitNextRunAt) {
    return explicitNextRunAt;
  }

  if (scheduleType === 'CUSTOM_CRON') {
    if (!cronExpression) {
      throw new Error('CUSTOM_CRON_REQUIRES_EXPRESSION');
    }
    validateCronExpression(cronExpression);
    return computeNextCronRunAt(cronExpression, now);
  }

  return deriveDefaultNextRunAt(scheduleType, now);
}

const createPolicySchema = z.object({
  name: z.string().trim().min(1).max(120),
  scheduleType: scheduleTypeEnum.default('MANUAL'),
  isActive: z.boolean().optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  nextRunAt: z.string().datetime().optional(),
  autoApproveLimitUsdc: usdcStringSchema.optional(),
  maxRunAmountUsdc: usdcStringSchema.optional(),
  minChainLiquidityUsdc: usdcStringSchema.optional(),
  cronExpression: z.string().trim().min(1).max(120).optional(),
  rules: z.record(z.string(), z.any()).optional()
});

const updatePolicySchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  scheduleType: scheduleTypeEnum.optional(),
  isActive: z.boolean().optional(),
  timezone: z.string().trim().min(1).max(100).optional(),
  nextRunAt: z.string().datetime().optional(),
  autoApproveLimitUsdc: usdcStringSchema.optional(),
  maxRunAmountUsdc: usdcStringSchema.optional(),
  minChainLiquidityUsdc: usdcStringSchema.optional(),
  cronExpression: z.string().trim().min(1).max(120).optional(),
  rules: z.record(z.string(), z.any()).optional()
});

const policyIdSchema = z.object({
  policyId: z.string().trim().min(1)
});

export async function createPayoutPolicy(req, res) {
  try {
    const input = createPolicySchema.parse(req.body);
    const userId = req.user.userId;
    const parsedNextRunAt = parseIsoDate(input.nextRunAt);
    const nextRunAt = deriveNextRunAt({
      scheduleType: input.scheduleType,
      cronExpression: input.cronExpression,
      explicitNextRunAt: parsedNextRunAt
    });

    const policy = await db.payoutPolicy.create({
      data: {
        userId,
        name: input.name,
        scheduleType: input.scheduleType,
        isActive: input.isActive ?? true,
        timezone: input.timezone || 'UTC',
        nextRunAt,
        autoApproveLimitUsdc: input.autoApproveLimitUsdc || '0',
        maxRunAmountUsdc: input.maxRunAmountUsdc || null,
        minChainLiquidityUsdc: input.minChainLiquidityUsdc || null,
        cronExpression: input.cronExpression || null,
        rules: input.rules || null
      }
    });

    return res.status(201).json({ policy });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    if (String(error.message || '').includes('PayoutPolicy_userId_name_key')) {
      return res.status(409).json({ error: 'A payout policy with this name already exists' });
    }

    return res.status(500).json({ error: error.message || 'Failed to create payout policy' });
  }
}

export async function listPayoutPolicies(req, res) {
  try {
    const userId = req.user.userId;
    const policies = await db.payoutPolicy.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    return res.json({ items: policies });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to list payout policies' });
  }
}

export async function updatePayoutPolicy(req, res) {
  try {
    const { policyId } = policyIdSchema.parse(req.params);
    const input = updatePolicySchema.parse(req.body || {});
    const userId = req.user.userId;

    const existing = await db.payoutPolicy.findFirst({
      where: { id: policyId, userId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Payout policy not found' });
    }

    const resolvedScheduleType = input.scheduleType || existing.scheduleType;
    const resolvedCronExpression = input.cronExpression !== undefined ? input.cronExpression : existing.cronExpression;
    const explicitNextRunAt = input.nextRunAt !== undefined ? parseIsoDate(input.nextRunAt) : undefined;

    let derivedNextRunAt;
    if (input.nextRunAt !== undefined || input.scheduleType !== undefined || input.cronExpression !== undefined) {
      derivedNextRunAt = deriveNextRunAt({
        scheduleType: resolvedScheduleType,
        cronExpression: resolvedCronExpression,
        explicitNextRunAt,
        now: new Date()
      });
    }

    const policy = await db.payoutPolicy.update({
      where: { id: existing.id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.scheduleType !== undefined ? { scheduleType: input.scheduleType } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(derivedNextRunAt !== undefined ? { nextRunAt: derivedNextRunAt } : {}),
        ...(input.autoApproveLimitUsdc !== undefined ? { autoApproveLimitUsdc: input.autoApproveLimitUsdc } : {}),
        ...(input.maxRunAmountUsdc !== undefined ? { maxRunAmountUsdc: input.maxRunAmountUsdc } : {}),
        ...(input.minChainLiquidityUsdc !== undefined ? { minChainLiquidityUsdc: input.minChainLiquidityUsdc } : {}),
        ...(input.cronExpression !== undefined ? { cronExpression: input.cronExpression } : {}),
        ...(input.rules !== undefined ? { rules: input.rules } : {})
      }
    });

    return res.json({ policy });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    if (
      error.message === 'CUSTOM_CRON_REQUIRES_EXPRESSION' ||
      String(error.message || '').startsWith('CRON_')
    ) {
      return res.status(400).json({ error: error.message });
    }

    if (
      error.message === 'CUSTOM_CRON_REQUIRES_EXPRESSION' ||
      String(error.message || '').startsWith('CRON_')
    ) {
      return res.status(400).json({ error: error.message });
    }

    if (String(error.message || '').includes('PayoutPolicy_userId_name_key')) {
      return res.status(409).json({ error: 'A payout policy with this name already exists' });
    }

    return res.status(500).json({ error: error.message || 'Failed to update payout policy' });
  }
}
