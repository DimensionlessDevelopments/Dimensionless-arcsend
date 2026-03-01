import { config } from '../config.js';
import { runPolicyScheduler } from './schedulerService.js';
import { db } from '../db.js';
import { executePayoutRunCore } from '../controllers/payoutController.js';

let schedulerTimer = null;

export function startSchedulerWorker() {
  if (!config.schedulerEnabled) {
    return () => {};
  }

  const intervalMs = config.schedulerIntervalMs;
  const maxPolicies = config.schedulerMaxPolicies;

  const runRetrySweep = async () => {
    if (!config.schedulerRetryEnabled) {
      return;
    }

    const now = new Date();
    const candidateRuns = await db.payoutRun.findMany({
      where: {
        dryRun: false,
        status: { in: ['APPROVED', 'PARTIAL', 'FAILED'] },
        items: {
          some: {
            status: 'FAILED',
            nextRetryAt: { lte: now }
          }
        }
      },
      select: {
        id: true,
        userId: true
      },
      orderBy: { updatedAt: 'asc' },
      take: config.schedulerRetryMaxRuns
    });

    let retriedRuns = 0;
    for (const run of candidateRuns) {
      try {
        await executePayoutRunCore({
          runId: run.id,
          userId: run.userId,
          retryFailed: true,
          maxItems: config.schedulerRetryMaxItems
        });
        retriedRuns += 1;
      } catch (error) {
        if (error.message !== 'PAYOUT_RUN_NO_ELIGIBLE_ITEMS') {
          console.error(`[Scheduler] retry sweep run ${run.id} failed:`, error.message || error);
        }
      }
    }

    if (retriedRuns > 0) {
      console.log(`[Scheduler] retry sweep processed runs=${retriedRuns}`);
    }
  };

  const runOnce = async () => {
    try {
      const result = await runPolicyScheduler({
        input: { maxPolicies }
      });

      const created = result.results.filter((item) => item.action === 'auto_approved' || item.action === 'drafted_manual_approval').length;
      if (created > 0) {
        console.log(`[Scheduler] scanned=${result.scannedPolicies} created=${created}`);
      }

      await runRetrySweep();
    } catch (error) {
      console.error('[Scheduler] run failed:', error.message || error);
    }
  };

  runOnce();
  schedulerTimer = setInterval(() => {
    void runOnce();
  }, intervalMs);

  console.log(`[Scheduler] enabled intervalMs=${intervalMs} maxPolicies=${maxPolicies}`);

  return () => {
    if (schedulerTimer) {
      clearInterval(schedulerTimer);
      schedulerTimer = null;
      console.log('[Scheduler] stopped');
    }
  };
}
