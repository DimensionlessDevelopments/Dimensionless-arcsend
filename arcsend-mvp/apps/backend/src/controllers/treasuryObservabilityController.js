import { z } from 'zod';
import { db } from '../db.js';

const runStatusEnum = z.enum(['DRAFT', 'APPROVED', 'EXECUTING', 'PARTIAL', 'COMPLETED', 'FAILED', 'CANCELLED']);
const itemStatusEnum = z.enum(['PLANNED', 'QUEUED', 'EXECUTING', 'CONFIRMED', 'FAILED', 'SKIPPED']);

const listRunsQuerySchema = z.object({
  status: runStatusEnum.optional(),
  policyId: z.string().trim().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

const dueRetriesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(500).optional(),
  runId: z.string().trim().min(1).optional(),
  status: itemStatusEnum.optional()
});

const runIdSchema = z.object({
  runId: z.string().trim().min(1)
});

function summarizeItems(items) {
  return items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {
      PLANNED: 0,
      QUEUED: 0,
      EXECUTING: 0,
      CONFIRMED: 0,
      FAILED: 0,
      SKIPPED: 0
    }
  );
}

export async function listPayoutRuns(req, res) {
  try {
    const userId = req.user.userId;
    const query = listRunsQuerySchema.parse(req.query || {});

    const runs = await db.payoutRun.findMany({
      where: {
        userId,
        ...(query.status ? { status: query.status } : {}),
        ...(query.policyId ? { policyId: query.policyId } : {})
      },
      include: {
        policy: {
          select: {
            id: true,
            name: true,
            scheduleType: true,
            isActive: true
          }
        },
        items: {
          select: {
            id: true,
            status: true,
            retryCount: true,
            maxRetryAttempts: true,
            nextRetryAt: true,
            lastErrorCode: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: query.limit || 50
    });

    const items = runs.map((run) => {
      const statusBreakdown = summarizeItems(run.items);
      const dueRetryItems = run.items.filter(
        (item) => item.status === 'FAILED' && item.nextRetryAt && item.nextRetryAt <= new Date()
      ).length;

      return {
        id: run.id,
        policyId: run.policyId,
        scheduleWindowKey: run.scheduleWindowKey,
        name: run.name,
        status: run.status,
        dryRun: run.dryRun,
        totalAmountUsdc: run.totalAmountUsdc,
        itemCount: run.itemCount,
        createdAt: run.createdAt,
        updatedAt: run.updatedAt,
        policy: run.policy,
        statusBreakdown,
        dueRetryItems
      };
    });

    return res.json({ items });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    return res.status(500).json({ error: error.message || 'Failed to list payout runs' });
  }
}

export async function getPayoutRun(req, res) {
  try {
    const userId = req.user.userId;
    const { runId } = runIdSchema.parse(req.params);

    const run = await db.payoutRun.findFirst({
      where: { id: runId, userId },
      include: {
        policy: true,
        items: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!run) {
      return res.status(404).json({ error: 'Payout run not found' });
    }

    const statusBreakdown = summarizeItems(run.items);
    const dueRetryItems = run.items.filter(
      (item) => item.status === 'FAILED' && item.nextRetryAt && item.nextRetryAt <= new Date()
    ).length;

    return res.json({
      run,
      summary: {
        statusBreakdown,
        dueRetryItems
      }
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    return res.status(500).json({ error: error.message || 'Failed to fetch payout run' });
  }
}

export async function listDueRetryItems(req, res) {
  try {
    const userId = req.user.userId;
    const query = dueRetriesQuerySchema.parse(req.query || {});
    const now = new Date();

    const items = await db.payoutItem.findMany({
      where: {
        run: { userId },
        ...(query.runId ? { runId: query.runId } : {}),
        ...(query.status ? { status: query.status } : { status: 'FAILED' }),
        nextRetryAt: { lte: now }
      },
      include: {
        run: {
          select: {
            id: true,
            status: true,
            policyId: true,
            scheduleWindowKey: true,
            updatedAt: true
          }
        }
      },
      orderBy: { nextRetryAt: 'asc' },
      take: query.limit || 100
    });

    return res.json({
      generatedAt: now.toISOString(),
      count: items.length,
      items
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    return res.status(500).json({ error: error.message || 'Failed to list due retry items' });
  }
}
