import { z } from 'zod';
import { db } from '../db.js';
import { payoutPreviewSchema, createPayoutPreview } from '../treasury/payrollEngine.js';
import { executeArcTransfer, quoteArcRoute } from '../services/circleService.js';
import { config } from '../config.js';

const approvePayoutRunSchema = z.object({
  note: z.string().trim().max(500).optional()
});

const executePayoutRunSchema = z.object({
  retryFailed: z.boolean().optional(),
  maxItems: z.number().int().min(1).max(500).optional()
});

function resolveFinalRunStatus(items) {
  const counts = items.reduce(
    (acc, item) => {
      acc[item.status] = (acc[item.status] || 0) + 1;
      return acc;
    },
    {}
  );

  const confirmed = counts.CONFIRMED || 0;
  const failed = counts.FAILED || 0;
  const queued = counts.QUEUED || 0;
  const planned = counts.PLANNED || 0;
  const executing = counts.EXECUTING || 0;

  if (failed === 0 && queued === 0 && planned === 0 && executing === 0 && confirmed > 0) {
    return 'COMPLETED';
  }

  if (confirmed > 0 || queued > 0) {
    return 'PARTIAL';
  }

  return 'FAILED';
}

function computeRetryDelayMs(retryCount) {
  const base = Math.max(config.payoutRetryBaseDelayMs, 1000);
  const max = Math.max(config.payoutRetryMaxDelayMs, base);
  const exponent = Math.max(retryCount - 1, 0);
  return Math.min(base * (2 ** exponent), max);
}

function getErrorCodeFromMessage(message) {
  const normalized = String(message || '').toLowerCase();
  if (normalized.includes('insufficient')) {
    return 'INSUFFICIENT_FUNDS';
  }
  if (normalized.includes('token')) {
    return 'TOKEN_UNAVAILABLE';
  }
  if (normalized.includes('timeout')) {
    return 'TIMEOUT';
  }
  return 'EXECUTION_ERROR';
}

export async function payoutPreview(req, res) {
  try {
    const input = payoutPreviewSchema.parse(req.body);
    const userId = req.user.userId;

    const preview = await createPayoutPreview({ userId, input });
    return res.status(201).json(preview);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    return res.status(500).json({ error: error.message || 'Failed to preview payout run' });
  }
}

export async function approvePayoutRun(req, res) {
  try {
    const { runId } = z.object({ runId: z.string().trim().min(1) }).parse(req.params);
    const { note } = approvePayoutRunSchema.parse(req.body || {});
    const userId = req.user.userId;

    const run = await db.payoutRun.findFirst({
      where: { id: runId, userId },
      include: { items: true }
    });

    if (!run) {
      return res.status(404).json({ error: 'Payout run not found' });
    }

    if (run.status !== 'DRAFT') {
      return res.status(400).json({ error: `Only DRAFT runs can be approved. Current status: ${run.status}` });
    }

    if (run.dryRun !== true) {
      return res.status(400).json({ error: 'Run is not marked as dry-run and cannot be approved via this endpoint' });
    }

    const executableCount = run.items.filter((item) => item.status === 'PLANNED').length;
    if (executableCount === 0) {
      return res.status(400).json({ error: 'Run has no executable payout items to approve' });
    }

    const updated = await db.payoutRun.update({
      where: { id: run.id },
      data: {
        status: 'APPROVED',
        dryRun: false,
        name: note ? `${run.name || 'Payout Run'} (approved)` : run.name
      }
    });

    return res.json({
      run: updated,
      approval: {
        approvedAt: new Date().toISOString(),
        executableItems: executableCount,
        note: note || null
      }
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    return res.status(500).json({ error: error.message || 'Failed to approve payout run' });
  }
}

export async function executePayoutRun(req, res) {
  try {
    const { runId } = z.object({ runId: z.string().trim().min(1) }).parse(req.params);
    const { retryFailed = false, maxItems } = executePayoutRunSchema.parse(req.body || {});
    const userId = req.user.userId;

    const result = await executePayoutRunCore({
      runId,
      userId,
      retryFailed,
      maxItems
    });

    return res.json(result);
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    if (error.message === 'PAYOUT_RUN_NOT_FOUND') {
      return res.status(404).json({ error: 'Payout run not found' });
    }

    if (error.message.startsWith('PAYOUT_RUN_INVALID_STATUS:')) {
      const status = error.message.replace('PAYOUT_RUN_INVALID_STATUS:', '');
      return res.status(400).json({ error: `Run is not executable from status ${status}` });
    }

    if (error.message === 'PAYOUT_RUN_NO_ELIGIBLE_ITEMS') {
      return res.status(400).json({ error: 'No payout items are eligible for execution' });
    }

    return res.status(500).json({ error: error.message || 'Failed to execute payout run' });
  }
}

export async function executePayoutRunCore({ runId, userId, retryFailed = false, maxItems }) {
  try {
    const run = await db.payoutRun.findFirst({
      where: { id: runId, userId },
      include: {
        items: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!run) {
      throw new Error('PAYOUT_RUN_NOT_FOUND');
    }

    if (!['APPROVED', 'PARTIAL', 'FAILED'].includes(run.status)) {
      throw new Error(`PAYOUT_RUN_INVALID_STATUS:${run.status}`);
    }

    const now = new Date();
    const executableStatuses = retryFailed ? new Set(['PLANNED', 'FAILED']) : new Set(['PLANNED']);
    const baseItems = run.items.filter((item) => {
      if (!executableStatuses.has(item.status)) {
        return false;
      }

      if (item.status === 'FAILED') {
        const maxRetryAttempts = item.maxRetryAttempts || config.payoutRetryDefaultMaxAttempts;
        if ((item.retryCount || 0) >= maxRetryAttempts) {
          return false;
        }

        if (item.nextRetryAt && item.nextRetryAt > now) {
          return false;
        }
      }

      return true;
    });
    const itemsToExecute = typeof maxItems === 'number' ? baseItems.slice(0, maxItems) : baseItems;

    if (!itemsToExecute.length) {
      throw new Error('PAYOUT_RUN_NO_ELIGIBLE_ITEMS');
    }

    await db.payoutRun.update({
      where: { id: run.id },
      data: { status: 'EXECUTING' }
    });

    const processed = [];

    for (const item of itemsToExecute) {
      await db.payoutItem.update({
        where: { id: item.id },
        data: { status: 'EXECUTING', reason: null, lastAttemptAt: new Date() }
      });

      try {
        const fromChain = item.plannedSourceChain || item.recipientChain;
        const route = await quoteArcRoute({
          fromChain,
          toChain: item.recipientChain,
          amount: item.amountUsdc,
          userWalletChains: [fromChain]
        });

        const execution = await executeArcTransfer({
          route,
          recipient: item.recipientAddress,
          amount: item.amountUsdc
        });

        const nextStatus = execution.status === 'failed'
          ? 'FAILED'
          : execution.status === 'completed' || execution.status === 'confirmed'
            ? 'CONFIRMED'
            : 'QUEUED';

        await db.$transaction([
          db.payoutItem.update({
            where: { id: item.id },
            data: {
              status: nextStatus,
              plannedSourceChain: route.fromChain,
              plannedRouteId: route.routeId,
              reason: execution.status === 'failed' ? 'Transfer provider returned failed status' : null,
              nextRetryAt: null,
              lastErrorCode: execution.status === 'failed' ? 'PROVIDER_FAILED' : null
            }
          }),
          db.transaction.create({
            data: {
              userId,
              fromChain: route.fromChain,
              toChain: route.toChain,
              amount: item.amountUsdc,
              recipient: item.recipientAddress,
              status: execution.status,
              bridgeType: `TreasuryPayout:${execution.bridgeType} (${route.routeId})`,
              txHash: execution.txHash || null
            }
          })
        ]);

        processed.push({
          itemId: item.id,
          status: nextStatus,
          txHash: execution.txHash || null,
          routeId: route.routeId
        });
      } catch (error) {
        const currentRetryCount = item.retryCount || 0;
        const nextRetryCount = currentRetryCount + 1;
        const maxRetryAttempts = item.maxRetryAttempts || config.payoutRetryDefaultMaxAttempts;
        const canRetryAgain = nextRetryCount < maxRetryAttempts;
        const delayMs = computeRetryDelayMs(nextRetryCount);
        const nextRetryAt = canRetryAgain ? new Date(Date.now() + delayMs) : null;
        const errorMessage = error.message || 'Execution failed';

        await db.payoutItem.update({
          where: { id: item.id },
          data: {
            status: 'FAILED',
            reason: errorMessage,
            retryCount: nextRetryCount,
            nextRetryAt,
            lastErrorCode: getErrorCodeFromMessage(errorMessage),
            maxRetryAttempts
          }
        });

        processed.push({
          itemId: item.id,
          status: 'FAILED',
          error: errorMessage,
          retryCount: nextRetryCount,
          maxRetryAttempts,
          nextRetryAt: nextRetryAt ? nextRetryAt.toISOString() : null
        });
      }
    }

    const refreshed = await db.payoutRun.findUnique({
      where: { id: run.id },
      include: { items: true }
    });

    const finalStatus = resolveFinalRunStatus(refreshed.items);
    const updatedRun = await db.payoutRun.update({
      where: { id: run.id },
      data: { status: finalStatus }
    });

    const counts = refreshed.items.reduce(
      (acc, item) => {
        acc[item.status] = (acc[item.status] || 0) + 1;
        return acc;
      },
      {}
    );

    return {
      run: updatedRun,
      summary: {
        processedItems: itemsToExecute.length,
        confirmedItems: counts.CONFIRMED || 0,
        failedItems: counts.FAILED || 0,
        queuedItems: counts.QUEUED || 0,
        skippedItems: counts.SKIPPED || 0,
        remainingPlannedItems: counts.PLANNED || 0
      },
      processed
    };
  } catch (error) {
    throw error;
  }
}
