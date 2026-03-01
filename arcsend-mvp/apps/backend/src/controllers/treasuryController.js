import { z } from 'zod';
import { db } from '../db.js';
import {
  executeArcTransfer,
  getLiquiditySurface,
  quoteArcRoute
} from '../services/circleService.js';

const chainEnum = z.enum(['ethereum', 'base', 'polygon', 'solana', 'arc-testnet']);

const rebalancePlanSchema = z.object({
  targetChain: chainEnum,
  minUsdc: z.string().regex(/^\d+(\.\d{1,6})?$/)
});

function parseUsdc(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }

  return num;
}

async function buildRebalancePlan({ targetChain, minUsdc }) {
  const minTargetUsdc = parseUsdc(minUsdc);
  const surface = await getLiquiditySurface();
  const target = surface.chains.find((item) => item.chain === targetChain);

  if (!target) {
    throw new Error(`Unsupported target chain: ${targetChain}`);
  }

  const currentTargetUsdc = parseUsdc(target.availableUsdc);
  const deficitUsdc = Math.max(minTargetUsdc - currentTargetUsdc, 0);

  if (deficitUsdc <= 0) {
    return {
      targetChain,
      targetWalletAddress: target.walletAddress,
      minTargetUsdc: minTargetUsdc.toFixed(6),
      currentTargetUsdc: currentTargetUsdc.toFixed(6),
      deficitUsdc: '0.000000',
      canExecute: false,
      reason: 'Target chain already has sufficient liquidity.'
    };
  }

  const sourceCandidates = surface.chains
    .filter((item) => item.chain !== targetChain && item.isRoutable)
    .map((item) => ({ ...item, availableUsdcNum: parseUsdc(item.availableUsdc) }))
    .sort((left, right) => right.availableUsdcNum - left.availableUsdcNum);

  const source = sourceCandidates[0];
  if (!source || source.availableUsdcNum <= 0) {
    return {
      targetChain,
      targetWalletAddress: target.walletAddress,
      minTargetUsdc: minTargetUsdc.toFixed(6),
      currentTargetUsdc: currentTargetUsdc.toFixed(6),
      deficitUsdc: deficitUsdc.toFixed(6),
      canExecute: false,
      reason: 'No source chain has available USDC for rebalance.'
    };
  }

  const recommendedAmount = Math.min(deficitUsdc, source.availableUsdcNum);
  if (!target.walletAddress) {
    return {
      targetChain,
      targetWalletAddress: null,
      minTargetUsdc: minTargetUsdc.toFixed(6),
      currentTargetUsdc: currentTargetUsdc.toFixed(6),
      deficitUsdc: deficitUsdc.toFixed(6),
      sourceChain: source.chain,
      sourceAvailableUsdc: source.availableUsdc,
      recommendedAmountUsdc: recommendedAmount.toFixed(6),
      canExecute: false,
      reason: 'Target chain execution wallet is not configured.'
    };
  }

  const route = await quoteArcRoute({
    fromChain: source.chain,
    toChain: targetChain,
    amount: recommendedAmount.toFixed(6),
    userWalletChains: [source.chain]
  });

  return {
    targetChain,
    targetWalletAddress: target.walletAddress,
    minTargetUsdc: minTargetUsdc.toFixed(6),
    currentTargetUsdc: currentTargetUsdc.toFixed(6),
    deficitUsdc: deficitUsdc.toFixed(6),
    sourceChain: source.chain,
    sourceAvailableUsdc: source.availableUsdc,
    recommendedAmountUsdc: recommendedAmount.toFixed(6),
    canExecute: true,
    reason: null,
    route
  };
}

export async function rebalancePlan(req, res) {
  try {
    const input = rebalancePlanSchema.parse(req.body);
    const plan = await buildRebalancePlan(input);
    return res.json({ plan });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    return res.status(500).json({ error: error.message || 'Failed to build rebalance plan' });
  }
}

export async function rebalanceExecute(req, res) {
  try {
    const input = rebalancePlanSchema.parse(req.body);
    const plan = await buildRebalancePlan(input);
    const userId = req.user.userId;

    if (!plan.canExecute || !plan.route || !plan.targetWalletAddress) {
      return res.status(400).json({ error: plan.reason || 'Rebalance plan cannot be executed' });
    }

    const result = await executeArcTransfer({
      route: plan.route,
      recipient: plan.targetWalletAddress,
      amount: plan.recommendedAmountUsdc
    });

    const tx = await db.transaction.create({
      data: {
        userId,
        fromChain: plan.route.fromChain,
        toChain: plan.route.toChain,
        amount: plan.recommendedAmountUsdc,
        recipient: plan.targetWalletAddress,
        status: result.status,
        bridgeType: `TreasuryRebalance:${result.bridgeType} (${result.routeId})`,
        txHash: result.txHash
      }
    });

    return res.status(201).json({ tx, route: plan.route, plan });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    return res.status(500).json({ error: error.message || 'Failed to execute rebalance' });
  }
}