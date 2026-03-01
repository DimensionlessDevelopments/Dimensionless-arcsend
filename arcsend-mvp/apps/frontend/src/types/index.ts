export type Chain = 'ethereum' | 'base' | 'polygon' | 'solana';
export type BalanceChain = Chain | 'arc-testnet';
export type TransferChain = Chain | 'arc-testnet';

export const NETWORK_LABELS: Record<TransferChain, string> = {
  'arc-testnet': 'Arc Testnet',
  ethereum: 'Ethereum Sepolia',
  base: 'Base Sepolia',
  polygon: 'Polygon Amoy',
  solana: 'Solana Devnet'
};

export const NETWORK_CODES: Record<TransferChain, string> = {
  'arc-testnet': 'ARC-TESTNET',
  ethereum: 'ETH-SEPOLIA',
  base: 'BASE-SEPOLIA',
  polygon: 'MATIC-AMOY',
  solana: 'SOL-DEVNET'
};

export const NETWORK_CHAIN_IDS: Record<TransferChain, number | null> = {
  'arc-testnet': null,
  ethereum: 11155111,
  base: 84532,
  polygon: 80002,
  solana: null
};

export interface User {
  id: string;
  email: string;
  walletAddress?: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export interface WalletChallengeResponse {
  address: string;
  message: string;
  expiresAt: number;
}

export interface BalanceResponse {
  walletId?: string;
  address?: string;
  walletBlockchain?: string;
  chain: BalanceChain;
  token: 'USDC' | string;
  balance: string;
}

export interface TransferPayload {
  fromChain?: Chain;
  toChain: TransferChain;
  amount: string;
  recipient: string;
  routeStrategy?: 'auto' | 'manual';
}

export interface ArcRoute {
  provider: 'CircleArc' | string;
  routeId: string;
  fromChain: Chain;
  toChain: TransferChain;
  amount: string;
  estimatedFeeUsdc: string;
  estimatedReceiveUsdc: string;
  settlementPath: string;
  estimatedEtaSeconds: number;
}

export interface TransactionItem {
  id: string;
  fromChain: Chain;
  toChain: TransferChain;
  amount: string;
  recipient: string;
  status: string;
  bridgeType: string;
  txHash?: string | null;
  createdAt: string;
}

export interface TransactionHistoryResponse {
  items: TransactionItem[];
}

export interface LiquidityChainItem {
  chain: TransferChain;
  chainCode: string;
  walletAddress?: string | null;
  isRoutable: boolean;
  availableUsdc: string;
}

export interface LiquiditySurfaceResponse {
  totalUsdc: string;
  bestSourceChain: TransferChain;
  chains: LiquidityChainItem[];
}

export interface ChainMetadataItem {
  chain: TransferChain;
  label: string;
  chainCode: string;
  chainId: number | null;
  explorerTxBase: string;
  isRoutable: boolean;
}

export interface ChainMetadataResponse {
  chains: ChainMetadataItem[];
  generatedAt: string;
}

export interface TreasuryRebalancePlan {
  targetChain: TransferChain;
  targetWalletAddress?: string | null;
  minTargetUsdc: string;
  currentTargetUsdc: string;
  deficitUsdc: string;
  sourceChain?: TransferChain;
  sourceAvailableUsdc?: string;
  recommendedAmountUsdc?: string;
  canExecute: boolean;
  reason?: string | null;
  route?: ArcRoute;
}

export interface TreasuryRebalancePlanResponse {
  plan: TreasuryRebalancePlan;
}

export interface TreasuryRunStatusBreakdown {
  PLANNED: number;
  QUEUED: number;
  EXECUTING: number;
  CONFIRMED: number;
  FAILED: number;
  SKIPPED: number;
}

export interface TreasuryRunListItem {
  id: string;
  policyId?: string | null;
  scheduleWindowKey?: string | null;
  name?: string | null;
  status: 'DRAFT' | 'APPROVED' | 'EXECUTING' | 'PARTIAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | string;
  dryRun: boolean;
  totalAmountUsdc: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  policy?: {
    id: string;
    name: string;
    scheduleType: string;
    isActive: boolean;
  } | null;
  statusBreakdown: TreasuryRunStatusBreakdown;
  dueRetryItems: number;
}

export interface TreasuryRunsResponse {
  items: TreasuryRunListItem[];
}

export interface TreasuryRunDetailItem {
  id: string;
  runId: string;
  recipientLabel?: string | null;
  recipientAddress: string;
  recipientChain: TransferChain;
  amountUsdc: string;
  status: 'PLANNED' | 'QUEUED' | 'EXECUTING' | 'CONFIRMED' | 'FAILED' | 'SKIPPED' | string;
  reason?: string | null;
  retryCount: number;
  maxRetryAttempts: number;
  nextRetryAt?: string | null;
  lastErrorCode?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface TreasuryRunDetail {
  id: string;
  policyId?: string | null;
  scheduleWindowKey?: string | null;
  name?: string | null;
  status: 'DRAFT' | 'APPROVED' | 'EXECUTING' | 'PARTIAL' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | string;
  dryRun: boolean;
  totalAmountUsdc: string;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
  items: TreasuryRunDetailItem[];
  policy?: {
    id: string;
    name: string;
    scheduleType: string;
    isActive: boolean;
  } | null;
}

export interface TreasuryRunDetailResponse {
  run: TreasuryRunDetail;
  summary: {
    statusBreakdown: TreasuryRunStatusBreakdown;
    dueRetryItems: number;
  };
}

export interface TreasuryDueRetryItem {
  id: string;
  runId: string;
  recipientLabel?: string | null;
  recipientAddress: string;
  recipientChain: TransferChain;
  amountUsdc: string;
  status: string;
  retryCount: number;
  maxRetryAttempts: number;
  nextRetryAt?: string | null;
  lastErrorCode?: string | null;
  reason?: string | null;
  run: {
    id: string;
    status: string;
    policyId?: string | null;
    scheduleWindowKey?: string | null;
    updatedAt: string;
  };
}

export interface TreasuryDueRetriesResponse {
  generatedAt: string;
  count: number;
  items: TreasuryDueRetryItem[];
}

export const CHAINS: Chain[] = ['ethereum', 'base', 'polygon', 'solana'];
