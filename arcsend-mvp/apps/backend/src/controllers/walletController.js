import { z } from 'zod';
import { db } from '../db.js';
import {
  getChainMetadataSurface,
  createUserWallet,
  getLiquiditySurface,
  getWalletBalance,
  listSupportedChains
} from '../services/circleService.js';

const walletSchema = z.object({
  chain: z.enum(['ethereum', 'base', 'polygon', 'solana'])
});

export async function createWallet(req, res) {
  try {
    const { chain } = walletSchema.parse(req.body);
    const userId = req.user.userId;

    const existing = await db.wallet.findFirst({ where: { userId, defaultChain: chain } });
    if (existing) {
      return res.json(existing);
    }

    const wallet = await createUserWallet({ userId, chain });

    const saved = await db.wallet.create({
      data: {
        userId,
        defaultChain: chain,
        circleWalletId: wallet.circleWalletId
      }
    });

    return res.status(201).json({ ...saved, address: wallet.address });
  } catch (error) {
    if (error.name === 'ZodError') {
      return res.status(400).json({ error: error.errors });
    }
    return res.status(500).json({ error: error.message || 'Failed to create wallet' });
  }
}

export async function getBalance(req, res) {
  try {
    const chain = req.query.chain || 'base';
    const userId = req.user.userId;

    const wallet =
      chain === 'arc-testnet'
        ? await db.wallet.findFirst({ where: { userId }, orderBy: { createdAt: 'asc' } })
        : await db.wallet.findFirst({ where: { userId, defaultChain: chain } });
    if (!wallet) {
      return res.status(404).json({ error: `No wallet for ${chain}. Create one first.` });
    }

    const balance = await getWalletBalance({ walletId: wallet.circleWalletId, chain: wallet.defaultChain });
    return res.json({
      walletId: wallet.id,
      ...balance,
      chain: chain === 'arc-testnet' ? 'arc-testnet' : balance.chain
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to fetch balance' });
  }
}

export async function listWallets(req, res) {
  try {
    const userId = req.user.userId;
    const includeBalance = String(req.query.includeBalance || 'false').toLowerCase() === 'true';
    const metadataByChain = new Map(
      getChainMetadataSurface().chains.map((item) => [item.chain, item])
    );

    const wallets = await db.wallet.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' }
    });

    const items = await Promise.all(
      wallets.map(async (wallet) => {
        const metadata = metadataByChain.get(wallet.defaultChain);

        if (!includeBalance) {
          return {
            id: wallet.id,
            circleWalletId: wallet.circleWalletId,
            chain: wallet.defaultChain,
            label: metadata?.label || wallet.defaultChain,
            chainCode: metadata?.chainCode || null,
            isRoutable: metadata?.isRoutable || false,
            createdAt: wallet.createdAt
          };
        }

        const balance = await getWalletBalance({ walletId: wallet.circleWalletId, chain: wallet.defaultChain });
        return {
          id: wallet.id,
          circleWalletId: wallet.circleWalletId,
          chain: wallet.defaultChain,
          label: metadata?.label || wallet.defaultChain,
          chainCode: metadata?.chainCode || null,
          isRoutable: metadata?.isRoutable || false,
          createdAt: wallet.createdAt,
          balance
        };
      })
    );

    return res.json({ items });
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to list wallets' });
  }
}

export function supportedChains(_req, res) {
  return res.json({ chains: listSupportedChains() });
}

export async function getLiquidity(_req, res) {
  try {
    const liquidity = await getLiquiditySurface();
    return res.json(liquidity);
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load liquidity surface' });
  }
}

export function getMetadata(_req, res) {
  try {
    return res.json(getChainMetadataSurface());
  } catch (error) {
    return res.status(500).json({ error: error.message || 'Failed to load chain metadata' });
  }
}
