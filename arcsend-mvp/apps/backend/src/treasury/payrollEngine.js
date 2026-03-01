import { z } from 'zod';
import { db } from '../db.js';
import { getLiquiditySurface, quoteArcRoute } from '../services/circleService.js';
import { config } from '../config.js';

const chainEnum = z.enum(['ethereum', 'base', 'polygon', 'solana', 'arc-testnet']);

export const payoutRecipientSchema = z.object({
  label: z.string().trim().min(1).max(120).optional(),
  address: z.string().trim().min(3).max(200),
  chain: chainEnum,
  amountUsdc: z.string().regex(/^\d+(\.\d{1,6})?$/)
});

export const payoutPreviewSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  policyId: z.string().trim().min(1).optional(),
  recipients: z.array(payoutRecipientSchema).min(1).max(500)
});

function parseUsdc(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }

  return parsed;
}

function formatUsdc(value) {
  return Math.max(value, 0).toFixed(6);
}

function pickBestSourceChain({ targetChain, amount, availability }) {
  const candidates = Object.entries(availability)
    .filter(([, available]) => available > 0)
    .sort((left, right) => right[1] - left[1]);

  if (!candidates.length) {
    return null;
  }

  const sameChain = candidates.find(([chain, available]) => chain === targetChain && available >= amount);
  if (sameChain) {
    return sameChain[0];
  }

  const exact = candidates.find(([, available]) => available >= amount);
  if (exact) {
    return exact[0];
  }

  return candidates[0][0];
}

export async function createPayoutPreview({ userId, input, runOptions = {} }) {
  const surface = await getLiquiditySurface();
  const availability = Object.fromEntries(
    surface.chains
      .filter((item) => item.isRoutable)
      .map((item) => [item.chain, parseUsdc(item.availableUsdc)])
  );

  const plannedItems = [];

  for (const recipient of input.recipients) {
    const amountNum = parseUsdc(recipient.amountUsdc);
    const sourceChain = pickBestSourceChain({
      targetChain: recipient.chain,
      amount: amountNum,
      availability
    });

    if (!sourceChain) {
      plannedItems.push({
        recipient,
        sourceChain: null,
        routeId: null,
        canSettle: false,
        status: 'SKIPPED',
        reason: 'No routable chain has available USDC for this payout item.'
      });
      continue;
    }

    const availableFromSource = availability[sourceChain] || 0;
    const plannedAmount = Math.min(amountNum, availableFromSource);

    if (plannedAmount <= 0) {
      plannedItems.push({
        recipient,
        sourceChain,
        routeId: null,
        canSettle: false,
        status: 'SKIPPED',
        reason: `Selected source chain ${sourceChain} has insufficient balance.`
      });
      continue;
    }

    availability[sourceChain] = Math.max(0, availableFromSource - plannedAmount);

    if (sourceChain === recipient.chain) {
      plannedItems.push({
        recipient,
        sourceChain,
        routeId: null,
        canSettle: true,
        status: 'PLANNED',
        amountUsdc: formatUsdc(plannedAmount),
        estimatedFeeUsdc: '0.000000',
        estimatedReceiveUsdc: formatUsdc(plannedAmount),
        settlementPath: 'same-chain',
        reason: plannedAmount < amountNum ? 'Partially funded in preview.' : null
      });
      continue;
    }

    try {
      const route = await quoteArcRoute({
        fromChain: sourceChain,
        toChain: recipient.chain,
        amount: formatUsdc(plannedAmount),
        userWalletChains: [sourceChain]
      });

      plannedItems.push({
        recipient,
        sourceChain,
        routeId: route.routeId,
        canSettle: true,
        status: 'PLANNED',
        amountUsdc: formatUsdc(plannedAmount),
        estimatedFeeUsdc: route.estimatedFeeUsdc,
        estimatedReceiveUsdc: route.estimatedReceiveUsdc,
        settlementPath: route.settlementPath,
        reason: plannedAmount < amountNum ? 'Partially funded in preview.' : null
      });
    } catch (error) {
      plannedItems.push({
        recipient,
        sourceChain,
        routeId: null,
        canSettle: false,
        status: 'SKIPPED',
        amountUsdc: formatUsdc(plannedAmount),
        reason: error.message || 'Unable to quote route for this payout item.'
      });
    }
  }

  const requestedTotal = input.recipients.reduce((sum, item) => sum + parseUsdc(item.amountUsdc), 0);
  const plannedTotal = plannedItems.reduce((sum, item) => sum + parseUsdc(item.amountUsdc || '0'), 0);
  const executableItems = plannedItems.filter((item) => item.canSettle).length;

  const run = await db.$transaction(async (tx) => {
    const createdRun = await tx.payoutRun.create({
      data: {
        userId,
        policyId: input.policyId || null,
        scheduleWindowKey: runOptions.scheduleWindowKey || null,
        name: input.name || null,
        status: 'DRAFT',
        dryRun: true,
        totalAmountUsdc: formatUsdc(plannedTotal),
        itemCount: plannedItems.length
      }
    });

    for (const item of plannedItems) {
      const recipientRecord = await tx.payoutRecipient.upsert({
        where: {
          userId_address_chain: {
            userId,
            address: item.recipient.address,
            chain: item.recipient.chain
          }
        },
        create: {
          userId,
          label: item.recipient.label || null,
          address: item.recipient.address,
          chain: item.recipient.chain
        },
        update: {
          label: item.recipient.label || null
        }
      });

      await tx.payoutItem.create({
        data: {
          runId: createdRun.id,
          recipientId: recipientRecord.id,
          recipientLabel: item.recipient.label || null,
          recipientAddress: item.recipient.address,
          recipientChain: item.recipient.chain,
          amountUsdc: item.amountUsdc || formatUsdc(parseUsdc(item.recipient.amountUsdc)),
          plannedSourceChain: item.sourceChain,
          plannedRouteId: item.routeId,
          status: item.status,
          retryCount: 0,
          maxRetryAttempts: config.payoutRetryDefaultMaxAttempts,
          nextRetryAt: null,
          lastAttemptAt: null,
          lastErrorCode: null,
          reason: item.reason || null
        }
      });
    }

    return createdRun;
  });

  return {
    run,
    summary: {
      requestedTotalUsdc: formatUsdc(requestedTotal),
      plannedTotalUsdc: formatUsdc(plannedTotal),
      totalItems: plannedItems.length,
      executableItems,
      skippedItems: plannedItems.length - executableItems
    },
    items: plannedItems
  };
}
