import { z } from 'zod';

export const ChainSchema = z.enum(['arc-testnet', 'ethereum', 'base', 'polygon', 'solana']);
export type Chain = z.infer<typeof ChainSchema>;

export const LegacyChainSchema = z.enum([
  'Arc_Testnet',
  'Ethereum_Sepolia',
  'Base_Sepolia',
  'Polygon_Amoy',
  'Solana_Devnet'
]);

export type ChainInput = Chain | z.infer<typeof LegacyChainSchema>;

export const CHAIN_ALIASES: Record<ChainInput, Chain> = {
  'arc-testnet': 'arc-testnet',
  ethereum: 'ethereum',
  base: 'base',
  polygon: 'polygon',
  solana: 'solana',
  Arc_Testnet: 'arc-testnet',
  Ethereum_Sepolia: 'ethereum',
  Base_Sepolia: 'base',
  Polygon_Amoy: 'polygon',
  Solana_Devnet: 'solana'
};

export function normalizeChain(chain: ChainInput): Chain {
  const resolved = CHAIN_ALIASES[chain];
  if (!resolved) {
    throw new Error(`Unsupported chain: ${String(chain)}`);
  }
  return resolved;
}

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  walletAddress: z.string().optional()
});

export const AuthResponseSchema = z.object({
  token: z.string(),
  user: UserSchema
});
export type AuthResponse = z.infer<typeof AuthResponseSchema>;

export const WalletBalanceSchema = z.object({
  walletId: z.string().optional(),
  address: z.string().optional(),
  walletBlockchain: z.string().optional(),
  chain: ChainSchema,
  token: z.string(),
  balance: z.string()
});
export type WalletBalance = z.infer<typeof WalletBalanceSchema>;

export const WalletListItemSchema = z.object({
  id: z.string(),
  circleWalletId: z.string().nullable().optional(),
  chain: z.string(),
  label: z.string(),
  chainCode: z.string().nullable().optional(),
  isRoutable: z.boolean(),
  createdAt: z.string(),
  balance: WalletBalanceSchema.optional()
});
export type WalletListItem = z.infer<typeof WalletListItemSchema>;

export const WalletListResponseSchema = z.object({
  items: z.array(WalletListItemSchema)
});

export const ChainMetadataItemSchema = z.object({
  chain: ChainSchema,
  label: z.string(),
  chainCode: z.string(),
  chainId: z.number().nullable(),
  explorerTxBase: z.string(),
  isRoutable: z.boolean()
});
export type ChainMetadataItem = z.infer<typeof ChainMetadataItemSchema>;

export const ChainMetadataSchema = z.object({
  chains: z.array(ChainMetadataItemSchema),
  generatedAt: z.string()
});
export type ChainMetadata = z.infer<typeof ChainMetadataSchema>;

export const LiquidityChainItemSchema = z.object({
  chain: ChainSchema,
  chainCode: z.string(),
  walletAddress: z.string().nullable().optional(),
  isRoutable: z.boolean(),
  availableUsdc: z.string()
});

export const LiquiditySurfaceSchema = z.object({
  totalUsdc: z.string(),
  bestSourceChain: ChainSchema,
  chains: z.array(LiquidityChainItemSchema)
});
export type LiquiditySurface = z.infer<typeof LiquiditySurfaceSchema>;

export const RouteSchema = z.object({
  provider: z.string(),
  routeId: z.string(),
  fromChain: ChainSchema,
  toChain: ChainSchema,
  amount: z.string(),
  estimatedFeeUsdc: z.string(),
  estimatedReceiveUsdc: z.string(),
  settlementPath: z.string(),
  estimatedEtaSeconds: z.number(),
  executionWallet: z.string().optional(),
  executionNetwork: z.string().optional()
});
export type Route = z.infer<typeof RouteSchema>;

export const EstimateRequestSchema = z.object({
  destinationChain: z.union([ChainSchema, LegacyChainSchema]),
  amount: z.string().regex(/^\d+(\.\d{1,6})?$/),
  sourceChain: z.union([ChainSchema, LegacyChainSchema]).optional(),
  routeStrategy: z.enum(['auto', 'manual']).optional()
});
export type EstimateRequest = z.infer<typeof EstimateRequestSchema>;

export const SendRequestSchema = EstimateRequestSchema.extend({
  destinationAddress: z.string().min(10)
});
export type SendRequest = z.infer<typeof SendRequestSchema>;

export const EstimateResponseSchema = z.object({
  route: RouteSchema
});
export type EstimateResponse = z.infer<typeof EstimateResponseSchema>;

export const TransactionItemSchema = z.object({
  id: z.string(),
  userId: z.string(),
  fromChain: z.string(),
  toChain: z.string(),
  amount: z.string(),
  recipient: z.string(),
  status: z.enum(['submitted', 'confirmed', 'completed', 'failed', 'pending', 'processing']),
  bridgeType: z.string(),
  txHash: z.string().nullable().optional(),
  createdAt: z.string()
});
export type TransactionItem = z.infer<typeof TransactionItemSchema>;

export const TransferStatusRawSchema = z.enum([
  'submitted',
  'confirmed',
  'completed',
  'failed',
  'pending',
  'processing'
]);
export type TransferStatusRaw = z.infer<typeof TransferStatusRawSchema>;

export const CanonicalTransferStatusSchema = z.enum(['pending', 'processing', 'completed', 'failed']);
export type CanonicalTransferStatus = z.infer<typeof CanonicalTransferStatusSchema>;

export type NormalizedTransactionItem = Omit<TransactionItem, 'status'> & {
  rawStatus: TransferStatusRaw;
  status: CanonicalTransferStatus;
};

export const SendResponseSchema = TransactionItemSchema.extend({
  route: RouteSchema
});
export type SendResponse = z.infer<typeof SendResponseSchema>;

export const TransactionsListSchema = z.object({
  items: z.array(TransactionItemSchema)
});
export type TransactionsList = z.infer<typeof TransactionsListSchema>;

export const TransactionGetSchema = z.object({
  item: TransactionItemSchema
});

export const TransferStatusSchema = z.object({
  id: z.string(),
  status: TransferStatusRawSchema,
  txHash: z.string().nullable().optional(),
  fromChain: z.string(),
  toChain: z.string(),
  amount: z.string(),
  recipient: z.string(),
  updatedAt: z.string()
});
export type TransferStatus = z.infer<typeof TransferStatusSchema>;

export type NormalizedTransferStatus = Omit<TransferStatus, 'status'> & {
  rawStatus: TransferStatusRaw;
  status: CanonicalTransferStatus;
};

export const WebhookTransactionSchema = z.object({
  id: z.string().optional(),
  txHash: z.string().optional(),
  state: z.string().optional(),
  status: z.string().optional()
});

export const WebhookPayloadSchema = z.object({
  eventType: z.string().optional(),
  data: z
    .object({
      transaction: WebhookTransactionSchema.optional(),
      id: z.string().optional(),
      txHash: z.string().optional(),
      state: z.string().optional(),
      status: z.string().optional()
    })
    .optional(),
  transaction: WebhookTransactionSchema.optional()
});
export type WebhookPayload = z.infer<typeof WebhookPayloadSchema>;

export type ApiResponse<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
