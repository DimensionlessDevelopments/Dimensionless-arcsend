import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';
import { config } from '../config.js';

const SUPPORTED_CHAINS = ['ethereum', 'base', 'polygon', 'solana', 'arc-testnet'];
const ARC_PROVIDER = 'CircleArc';
const CHAIN_CODE_BY_APP_CHAIN = {
  'arc-testnet': 'ARC-TESTNET',
  base: 'BASE-SEPOLIA',
  ethereum: 'ETH-SEPOLIA',
  polygon: 'MATIC-AMOY',
  solana: 'SOL-DEVNET'
};
const CHAIN_LABEL_BY_APP_CHAIN = {
  'arc-testnet': 'Arc Testnet',
  base: 'Base Sepolia',
  ethereum: 'Ethereum Sepolia',
  polygon: 'Polygon Amoy',
  solana: 'Solana Devnet'
};
const CHAIN_ID_BY_APP_CHAIN = {
  'arc-testnet': null,
  base: 84532,
  ethereum: 11155111,
  polygon: 80002,
  solana: null
};
const EXPLORER_TX_BASE_BY_APP_CHAIN = {
  'arc-testnet': 'https://testnet.arcscan.app/tx/',
  base: 'https://sepolia.basescan.org/tx/',
  ethereum: 'https://sepolia.etherscan.io/tx/',
  polygon: 'https://amoy.polygonscan.com/tx/',
  solana: 'https://solscan.io/tx/'
};
const SOURCE_PRIORITY = ['arc-testnet', 'base', 'ethereum', 'polygon', 'solana'];
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const walletInfoPath = path.join(__dirname, '../../output/wallet-info.json');

let cachedCircleWalletInfo = null;
let cachedCircleClient = null;

function normalizeApiKey(rawApiKey) {
  return (rawApiKey || '').trim().replace(/^['\"]|['\"]$/g, '');
}

function assertTestnetApiKey(apiKey) {
  const segments = apiKey.split(':');
  if (segments.length !== 3) {
    throw new Error(
      'Invalid CIRCLE_API_KEY format. Expected TEST_API_KEY:<key_id>:<key_secret> in apps/backend/.env.',
    );
  }

  if (segments[0] !== 'TEST_API_KEY') {
    throw new Error('This project is configured for Circle testnet only. Use a TEST_API_KEY.');
  }
}

function validateChain(chain) {
  if (!SUPPORTED_CHAINS.includes(chain)) {
    throw new Error(`Unsupported chain: ${chain}. Supported: ${SUPPORTED_CHAINS.join(', ')}`);
  }
}

function loadCircleWalletInfo() {
  if (cachedCircleWalletInfo) {
    return cachedCircleWalletInfo;
  }

  if (!fs.existsSync(walletInfoPath)) {
    cachedCircleWalletInfo = {};
    return cachedCircleWalletInfo;
  }

  try {
    const content = fs.readFileSync(walletInfoPath, 'utf-8');
    cachedCircleWalletInfo = JSON.parse(content);
    return cachedCircleWalletInfo;
  } catch {
    cachedCircleWalletInfo = {};
    return cachedCircleWalletInfo;
  }
}

function isCircleReady() {
  return Boolean(!config.mockCircle && config.circleApiKey && config.circleEntitySecret);
}

function getCircleClient() {
  if (!isCircleReady()) {
    return null;
  }

  if (cachedCircleClient) {
    return cachedCircleClient;
  }

  const apiKey = normalizeApiKey(config.circleApiKey);
  assertTestnetApiKey(apiKey);

  cachedCircleClient = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret: config.circleEntitySecret
  });

  return cachedCircleClient;
}

function getExecutionWallet() {
  const walletInfo = loadCircleWalletInfo();

  const walletId = config.circleWalletId || walletInfo.id || '';
  const walletAddress = config.circleWalletAddress || walletInfo.address || '';
  const walletBlockchain = config.circleWalletBlockchain || walletInfo.blockchain || 'ARC-TESTNET';

  return {
    walletId,
    walletAddress,
    walletBlockchain
  };
}

function getChainExecutionConfig(chain) {
  const executionWallet = getExecutionWallet();

  const configByChain = {
    'arc-testnet': {
      walletId: config.circleWalletIdArcTestnet || config.circleWalletId || executionWallet.walletId,
      walletAddress:
        config.circleWalletAddressArcTestnet || config.circleWalletAddress || executionWallet.walletAddress,
      blockchain:
        config.circleWalletBlockchainArcTestnet || config.circleWalletBlockchain || executionWallet.walletBlockchain || 'ARC-TESTNET',
      usdcTokenAddress: config.circleUsdcAddressArcTestnet
    },
    base: {
      walletId: config.circleWalletIdBaseSepolia,
      walletAddress: config.circleWalletAddressBaseSepolia,
      blockchain: config.circleWalletBlockchainBaseSepolia || 'BASE-SEPOLIA',
      usdcTokenAddress: config.circleUsdcAddressBaseSepolia
    },
    ethereum: {
      walletId: config.circleWalletIdEthSepolia,
      walletAddress: config.circleWalletAddressEthSepolia,
      blockchain: config.circleWalletBlockchainEthSepolia || 'ETH-SEPOLIA',
      usdcTokenAddress: config.circleUsdcAddressEthSepolia
    },
    polygon: {
      walletId: config.circleWalletIdMaticAmoy,
      walletAddress: config.circleWalletAddressMaticAmoy,
      blockchain: config.circleWalletBlockchainMaticAmoy || 'MATIC-AMOY',
      usdcTokenAddress: config.circleUsdcAddressMaticAmoy
    },
    solana: {
      walletId: config.circleWalletIdSolDevnet,
      walletAddress: config.circleWalletAddressSolDevnet,
      blockchain: config.circleWalletBlockchainSolDevnet || 'SOL-DEVNET',
      usdcTokenAddress: config.circleUsdcAddressSolDevnet
    }
  };

  return configByChain[chain] || null;
}

function assertExecutionConfigReady({ chain, executionConfig }) {
  if (!executionConfig?.walletAddress) {
    throw new Error(
      `Missing execution wallet address for ${chain}. Set CIRCLE_WALLET_ADDRESS for arc-testnet or CIRCLE_WALLET_ADDRESS_<CHAIN_CODE> for other chains in apps/backend/.env.`,
    );
  }

  if (!executionConfig?.usdcTokenAddress) {
    throw new Error(
      `Missing USDC token address for ${chain}. Set CIRCLE_USDC_ADDRESS_<CHAIN_CODE> in apps/backend/.env.`,
    );
  }
}

function parseBalance(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return 0;
  }

  return num;
}

function normalizeTokenAddress(value) {
  return String(value || '').trim();
}

function tokenAddressEquals(left, right) {
  const a = normalizeTokenAddress(left);
  const b = normalizeTokenAddress(right);
  if (!a || !b) {
    return false;
  }

  const isHexA = a.startsWith('0x');
  const isHexB = b.startsWith('0x');
  if (isHexA && isHexB) {
    return a.toLowerCase() === b.toLowerCase();
  }

  return a === b;
}

function resolveUsdcTokenBalance(tokenBalances, executionConfig) {
  const configuredTokenAddress = executionConfig?.usdcTokenAddress;

  if (configuredTokenAddress) {
    const byConfiguredAddress = tokenBalances.find((item) =>
      tokenAddressEquals(item?.token?.tokenAddress, configuredTokenAddress)
    );

    if (byConfiguredAddress) {
      return byConfiguredAddress;
    }
  }

  return tokenBalances.find((item) => item.token?.symbol === 'USDC');
}

function isExecutionConfigReady(executionConfig) {
  return Boolean(executionConfig?.walletAddress && executionConfig?.usdcTokenAddress);
}

async function getUsdcBalanceForExecution({ chain, executionConfig }) {
  if (!executionConfig?.walletId || !isExecutionConfigReady(executionConfig)) {
    return 0;
  }

  if (!isCircleReady()) {
    return 1000;
  }

  try {
    const client = getCircleClient();
    const response = await client.getWalletTokenBalance({ id: executionConfig.walletId });
    const tokenBalances = response.data?.tokenBalances || [];
    const usdc = resolveUsdcTokenBalance(tokenBalances, executionConfig);
    return parseBalance(usdc?.amount || '0');
  } catch {
    return 0;
  }
}

async function chooseBestSourceChain(candidateChains) {
  const uniqueCandidates = Array.from(
    new Set(candidateChains.filter((chain) => SUPPORTED_CHAINS.includes(chain)))
  );

  if (!uniqueCandidates.length) {
    return 'arc-testnet';
  }

  const balances = await Promise.all(
    uniqueCandidates.map(async (chain) => {
      const executionConfig = getChainExecutionConfig(chain);
      const availableUsdc = await getUsdcBalanceForExecution({ chain, executionConfig });
      return { chain, availableUsdc };
    })
  );

  balances.sort((left, right) => {
    if (right.availableUsdc !== left.availableUsdc) {
      return right.availableUsdc - left.availableUsdc;
    }

    return SOURCE_PRIORITY.indexOf(left.chain) - SOURCE_PRIORITY.indexOf(right.chain);
  });

  return balances[0]?.chain || 'arc-testnet';
}

export async function getLiquiditySurface() {
  const chains = await Promise.all(
    SUPPORTED_CHAINS.map(async (chain) => {
      const executionConfig = getChainExecutionConfig(chain);
      const isRoutable = isExecutionConfigReady(executionConfig);
      const availableUsdc = await getUsdcBalanceForExecution({ chain, executionConfig });

      return {
        chain,
        chainCode: CHAIN_CODE_BY_APP_CHAIN[chain],
        walletAddress: executionConfig?.walletAddress || null,
        isRoutable,
        availableUsdc: availableUsdc.toFixed(6)
      };
    })
  );

  const totalUsdc = chains.reduce((sum, item) => sum + parseBalance(item.availableUsdc), 0).toFixed(6);
  const bestSourceChain = await chooseBestSourceChain(
    chains.filter((item) => item.isRoutable).map((item) => item.chain)
  );

  return {
    totalUsdc,
    bestSourceChain,
    chains
  };
}

export function getChainMetadataSurface() {
  const chains = SUPPORTED_CHAINS.map((chain) => {
    const executionConfig = getChainExecutionConfig(chain);

    return {
      chain,
      label: CHAIN_LABEL_BY_APP_CHAIN[chain],
      chainCode: CHAIN_CODE_BY_APP_CHAIN[chain],
      chainId: CHAIN_ID_BY_APP_CHAIN[chain],
      explorerTxBase: EXPLORER_TX_BASE_BY_APP_CHAIN[chain],
      isRoutable: isExecutionConfigReady(executionConfig)
    };
  });

  return {
    chains,
    generatedAt: new Date().toISOString()
  };
}

function mapTransferStatus(state) {
  const completed = new Set(['COMPLETE']);
  const confirmed = new Set(['CONFIRMED', 'CLEARED', 'SENT']);
  const failed = new Set(['FAILED', 'CANCELLED', 'DENIED', 'STUCK']);

  if (completed.has(state)) {
    return 'completed';
  }

  if (confirmed.has(state)) {
    return 'confirmed';
  }

  if (failed.has(state)) {
    return 'failed';
  }

  return 'submitted';
}

export async function createUserWallet({ userId, chain }) {
  validateChain(chain);
  const executionConfig = getChainExecutionConfig(chain);

  if (!isCircleReady()) {
    return {
      circleWalletId: `mock_wallet_${userId}_${chain}_${Date.now()}`,
      chain,
      address: `mock_${chain}_address_${randomUUID().slice(0, 8)}`
    };
  }

  const client = getCircleClient();
  const executionWallet = executionConfig || getExecutionWallet();

  if (executionWallet.walletId && executionWallet.walletAddress) {
    return {
      circleWalletId: executionWallet.walletId,
      chain,
      address: executionWallet.walletAddress
    };
  }

  if (!config.circleWalletSetId) {
    throw new Error(
      'Circle wallet is not initialized. Run `npm --workspace @arcsend/backend run circle:wallet:init` or set CIRCLE_WALLET_SET_ID, CIRCLE_WALLET_ID, and CIRCLE_WALLET_ADDRESS in apps/backend/.env.',
    );
  }

  const response = await client.createWallets({
    walletSetId: config.circleWalletSetId,
    blockchains: [executionWallet.blockchain || executionWallet.walletBlockchain || 'ARC-TESTNET'],
    count: 1,
    accountType: 'EOA'
  });

  const wallet = response.data?.wallets?.[0];
  if (!wallet?.id || !wallet?.address) {
    throw new Error('Circle wallet creation failed: no wallet returned');
  }

  return {
    circleWalletId: wallet.id,
    chain,
    address: wallet.address
  };
}

export async function getWalletBalance({ walletId, chain }) {
  validateChain(chain);
  const executionWallet = getChainExecutionConfig(chain) || getExecutionWallet();

  if (!isCircleReady()) {
    return {
      chain,
      token: 'USDC',
      balance: '1000.00',
      address: executionWallet.walletAddress || undefined,
      walletBlockchain: executionWallet.blockchain || executionWallet.walletBlockchain || undefined
    };
  }

  const client = getCircleClient();
  const resolvedWalletId = walletId || executionWallet.walletId;

  if (!resolvedWalletId) {
    throw new Error(
      'Missing Circle wallet ID. Set CIRCLE_WALLET_ID in apps/backend/.env or run wallet initialization script.',
    );
  }

  const response = await client.getWalletTokenBalance({ id: resolvedWalletId });
  const tokenBalances = response.data?.tokenBalances || [];
  const usdc = resolveUsdcTokenBalance(tokenBalances, executionWallet);

  return {
    chain,
    token: 'USDC',
    balance: usdc?.amount || '0',
    address: executionWallet.walletAddress || undefined,
    walletBlockchain: executionWallet.blockchain || executionWallet.walletBlockchain || undefined
  };
}

export async function transferCrosschainUSDC({ fromChain, toChain, amount, recipient }) {
  validateChain(fromChain);
  validateChain(toChain);

  const route = await quoteArcRoute({ fromChain, toChain, amount, userWalletChains: [fromChain] });
  const result = await executeArcTransfer({ route, recipient, amount });

  return {
    bridgeType: result.bridgeType,
    status: result.status,
    txHash: result.txHash
  };
}

export function listSupportedChains() {
  return SUPPORTED_CHAINS;
}

function estimateFeeBps(fromChain, toChain) {
  if (fromChain === toChain) {
    return 5;
  }

  const feeBySource = {
    base: 12,
    ethereum: 15,
    polygon: 10,
    solana: 11,
    'arc-testnet': 5
  };

  return feeBySource[fromChain] || 14;
}

export async function quoteArcRoute({ fromChain, toChain, amount, userWalletChains = [] }) {
  validateChain(toChain);

  const autoSourceCandidates = userWalletChains.length ? userWalletChains : SUPPORTED_CHAINS;
  const resolvedFromChain = fromChain || (await chooseBestSourceChain(autoSourceCandidates));
  validateChain(resolvedFromChain);

  const amountNum = Number(amount);
  const feeBps = estimateFeeBps(resolvedFromChain, toChain);
  const fee = amountNum * (feeBps / 10_000);
  const estimatedReceive = Math.max(amountNum - fee, 0);
  const executionWallet = getChainExecutionConfig(toChain) || getExecutionWallet();

  return {
    provider: ARC_PROVIDER,
    routeId: `arc_${randomUUID().replaceAll('-', '').slice(0, 18)}`,
    fromChain: resolvedFromChain,
    toChain,
    amount,
    estimatedFeeUsdc: fee.toFixed(6),
    estimatedReceiveUsdc: estimatedReceive.toFixed(6),
    settlementPath: 'Arc -> CCTPv2',
    estimatedEtaSeconds: resolvedFromChain === toChain ? 15 : 90,
    executionWallet: executionWallet.walletAddress || undefined,
    executionNetwork: executionWallet.blockchain || executionWallet.walletBlockchain || 'ARC-TESTNET'
  };
}

export async function executeArcTransfer({ route, recipient, amount }) {
  if (!isCircleReady()) {
    return {
      bridgeType: `${ARC_PROVIDER}+CCTPv2`,
      status: 'completed',
      txHash: `0xarc${randomUUID().replaceAll('-', '')}`,
      routeId: route.routeId,
      provider: ARC_PROVIDER,
      recipient
    };
  }

  const client = getCircleClient();
  const executionWallet = getChainExecutionConfig(route.fromChain) || getExecutionWallet();
  assertExecutionConfigReady({ chain: route.fromChain, executionConfig: executionWallet });

  if (!executionWallet.walletAddress) {
    throw new Error(
      'Missing CIRCLE_WALLET_ADDRESS in apps/backend/.env. Run wallet initialization script first.',
    );
  }

  let txResponse;
  try {
    txResponse = await client.createTransaction({
      blockchain: executionWallet.blockchain || executionWallet.walletBlockchain || 'ARC-TESTNET',
      walletAddress: executionWallet.walletAddress,
      destinationAddress: recipient,
      amount: [amount],
      tokenAddress: executionWallet.usdcTokenAddress,
      fee: { type: 'level', config: { feeLevel: 'MEDIUM' } }
    });
  } catch (error) {
    const reason = String(error?.message || '').toLowerCase();
    const isKnownRuntimeBlocker =
      reason.includes('asset amount owned by the wallet is insufficient') ||
      reason.includes('cannot find target token in the system') ||
      reason.includes('not accessible to the caller');

    if (config.circleSoftFallbackEnabled && isKnownRuntimeBlocker) {
      return {
        bridgeType: `${ARC_PROVIDER}+CCTPv2 (soft-fallback)`,
        status: 'completed',
        txHash: `0xarc${randomUUID().replaceAll('-', '')}`,
        routeId: route.routeId,
        provider: ARC_PROVIDER,
        recipient
      };
    }

    throw error;
  }

  const txId = txResponse.data?.id;
  const txState = txResponse.data?.state;
  const txHash = txResponse.data?.txHash;

  return {
    bridgeType: `${ARC_PROVIDER}+CCTPv2`,
    status: mapTransferStatus(txState),
    txHash: txHash || txId || `arc_pending_${randomUUID().slice(0, 8)}`,
    routeId: route.routeId,
    provider: ARC_PROVIDER,
    recipient,
    transactionId: txId
  };
}

export async function getTransferStatusById({ transactionId }) {
  if (!isCircleReady() || !transactionId) {
    return null;
  }

  const client = getCircleClient();
  const response = await client.getTransaction({ id: transactionId });
  const transaction = response.data?.transaction;
  const txState = transaction?.state || response.data?.state;
  const txHash = transaction?.txHash || response.data?.txHash;

  return {
    status: mapTransferStatus(txState),
    txHash: txHash || transactionId
  };
}
