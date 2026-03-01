import { z } from 'zod';
import { db } from '../db.js';
import { executeArcTransfer, getTransferStatusById, quoteArcRoute } from '../services/circleService.js';

const chainEnum = z.enum(['ethereum', 'base', 'polygon', 'solana', 'arc-testnet']);

const quoteSchema = z.object({
  fromChain: chainEnum.optional(),
  toChain: chainEnum,
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/)
});

const transferSchema = z.object({
  fromChain: chainEnum.optional(),
  toChain: chainEnum,
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
  recipient: z.string().min(10),
  routeStrategy: z.enum(['auto', 'manual']).default('auto')
});

const webhookSchema = z.object({
  eventType: z.string().optional(),
  data: z
    .object({
      transaction: z
        .object({
          id: z.string().optional(),
          txHash: z.string().optional(),
          state: z.string().optional(),
          status: z.string().optional()
        })
        .optional(),
      id: z.string().optional(),
      txHash: z.string().optional(),
      state: z.string().optional(),
      status: z.string().optional()
    })
    .optional(),
  transaction: z
    .object({
      id: z.string().optional(),
      txHash: z.string().optional(),
      state: z.string().optional(),
      status: z.string().optional()
    })
    .optional()
});

function mapExternalStatus(value) {
  if (!value) {
    return 'submitted';
  }

  const normalized = String(value).toUpperCase();
  const completed = new Set(['COMPLETE', 'COMPLETED']);
  const confirmed = new Set(['CONFIRMED', 'CLEARED', 'SENT']);
  const failed = new Set(['FAILED', 'CANCELLED', 'DENIED', 'STUCK']);

  if (completed.has(normalized)) {
    return 'completed';
  }

  if (confirmed.has(normalized)) {
    return 'confirmed';
  }

  if (failed.has(normalized)) {
    return 'failed';
  }

  return 'submitted';
}

async function refreshTransactionStatus(transaction) {
  if (!transaction?.txHash || !['submitted', 'confirmed'].includes(transaction.status)) {
    return transaction;
  }

  try {
    const latest = await getTransferStatusById({ transactionId: transaction.txHash });
    if (!latest) {
      return transaction;
    }

    if (latest.status === transaction.status && latest.txHash === transaction.txHash) {
      return transaction;
    }

    return db.transaction.update({
      where: { id: transaction.id },
      data: {
        status: latest.status,
        txHash: latest.txHash
      }
    });
  } catch {
    return transaction;
  }
}

export async function quoteTransfer(req, res) {
  try {
    const input = quoteSchema.parse(req.body);
    const userId = req.user.userId;

    const wallets = await db.wallet.findMany({
      where: { userId },
      select: { defaultChain: true }
    });

    const route = await quoteArcRoute({
      fromChain: input.fromChain,
      toChain: input.toChain,
      amount: input.amount,
      userWalletChains: wallets.map((wallet) => wallet.defaultChain)
    });

    return res.json({ route });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    return res.status(500).json({ error: error.message || 'Quote failed' });
  }
}

export async function sendTransfer(req, res) {
  try {
    const input = transferSchema.parse(req.body);
    const userId = req.user.userId;

    const wallets = await db.wallet.findMany({
      where: { userId },
      select: { defaultChain: true }
    });

    const route = await quoteArcRoute({
      fromChain: input.routeStrategy === 'manual' ? input.fromChain : undefined,
      toChain: input.toChain,
      amount: input.amount,
      userWalletChains: wallets.map((wallet) => wallet.defaultChain)
    });

    const result = await executeArcTransfer({
      route,
      recipient: input.recipient,
      amount: input.amount
    });

    const tx = await db.transaction.create({
      data: {
        userId,
        fromChain: route.fromChain,
        toChain: input.toChain,
        amount: input.amount,
        recipient: input.recipient,
        status: result.status,
        bridgeType: `${result.bridgeType} (${result.routeId})`,
        txHash: result.txHash
      }
    });

    return res.status(201).json({ ...tx, route });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }

    const rawMessage = String(error.message || 'Transfer failed');
    const normalized = rawMessage.toLowerCase();

    if (normalized.includes('asset amount owned by the wallet is insufficient')) {
      return res.status(500).json({
        error:
          'Source wallet lacks required balance for transfer execution. Ensure both USDC and native gas token are funded on the selected source chain (Base Sepolia: ETH, Polygon Amoy: MATIC, Solana Devnet: SOL, Ethereum Sepolia: ETH).'
      });
    }

    return res.status(500).json({ error: rawMessage });
  }
}

export async function history(req, res) {
  try {
    const userId = req.user.userId;
    const items = await db.transaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' }
    });

    const refreshedItems = await Promise.all(items.map((item) => refreshTransactionStatus(item)));

    return res.json({ items: refreshedItems });
  } catch {
    return res.status(500).json({ error: 'Failed to load history' });
  }
}

export async function transferStatus(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const transaction = await db.transaction.findFirst({
      where: {
        userId,
        OR: [{ id }, { txHash: id }]
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const refreshed = await refreshTransactionStatus(transaction);
    return res.json({
      id: refreshed.id,
      status: refreshed.status,
      txHash: refreshed.txHash,
      fromChain: refreshed.fromChain,
      toChain: refreshed.toChain,
      amount: refreshed.amount,
      recipient: refreshed.recipient,
      updatedAt: refreshed.createdAt
    });
  } catch {
    return res.status(500).json({ error: 'Failed to load transfer status' });
  }
}

export async function listTransactions(req, res) {
  return history(req, res);
}

export async function getTransaction(req, res) {
  try {
    const userId = req.user.userId;
    const { id } = req.params;

    const transaction = await db.transaction.findFirst({
      where: {
        userId,
        OR: [{ id }, { txHash: id }]
      }
    });

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    const refreshed = await refreshTransactionStatus(transaction);
    return res.json({ item: refreshed });
  } catch {
    return res.status(500).json({ error: 'Failed to load transaction' });
  }
}

export async function transactionWebhook(req, res) {
  try {
    const payload = webhookSchema.parse(req.body);
    const source = payload.transaction || payload.data?.transaction || payload.data || {};

    const externalId = source.id;
    const externalTxHash = source.txHash;
    const mappedStatus = mapExternalStatus(source.state || source.status);

    if (!externalId && !externalTxHash) {
      return res.status(202).json({ received: true, updated: false, reason: 'No transaction identifier' });
    }

    let existing = null;
    if (externalTxHash) {
      existing = await db.transaction.findFirst({ where: { txHash: externalTxHash } });
    }

    if (!existing && externalId) {
      existing = await db.transaction.findFirst({ where: { txHash: externalId } });
    }

    if (!existing) {
      return res.status(202).json({ received: true, updated: false, reason: 'Transaction not found locally' });
    }

    const updated = await db.transaction.update({
      where: { id: existing.id },
      data: {
        status: mappedStatus,
        txHash: externalTxHash || externalId || existing.txHash
      }
    });

    return res.status(202).json({
      received: true,
      updated: true,
      item: {
        id: updated.id,
        status: updated.status,
        txHash: updated.txHash
      }
    });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    return res.status(500).json({ error: 'Failed to process transaction webhook' });
  }
}
