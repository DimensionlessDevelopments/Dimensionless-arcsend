import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { initiateDeveloperControlledWalletsClient } from '@circle-fin/developer-controlled-wallets';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ENV_PATH = path.join(__dirname, '..', '.env');
const OUTPUT_PATH = path.join(__dirname, '..', 'output', 'multichain-wallets.json');

type ChainConfig = {
  label: string;
  blockchain: 'BASE-SEPOLIA' | 'ETH-SEPOLIA' | 'MATIC-AMOY' | 'SOL-DEVNET';
  walletIdKey: string;
  walletAddressKey: string;
  walletBlockchainKey: string;
  usdcAddressKey: string;
};

const TARGET_CHAINS: ChainConfig[] = [
  {
    label: 'base',
    blockchain: 'BASE-SEPOLIA',
    walletIdKey: 'CIRCLE_WALLET_ID_BASE_SEPOLIA',
    walletAddressKey: 'CIRCLE_WALLET_ADDRESS_BASE_SEPOLIA',
    walletBlockchainKey: 'CIRCLE_WALLET_BLOCKCHAIN_BASE_SEPOLIA',
    usdcAddressKey: 'CIRCLE_USDC_ADDRESS_BASE_SEPOLIA'
  },
  {
    label: 'ethereum',
    blockchain: 'ETH-SEPOLIA',
    walletIdKey: 'CIRCLE_WALLET_ID_ETH_SEPOLIA',
    walletAddressKey: 'CIRCLE_WALLET_ADDRESS_ETH_SEPOLIA',
    walletBlockchainKey: 'CIRCLE_WALLET_BLOCKCHAIN_ETH_SEPOLIA',
    usdcAddressKey: 'CIRCLE_USDC_ADDRESS_ETH_SEPOLIA'
  },
  {
    label: 'polygon',
    blockchain: 'MATIC-AMOY',
    walletIdKey: 'CIRCLE_WALLET_ID_MATIC_AMOY',
    walletAddressKey: 'CIRCLE_WALLET_ADDRESS_MATIC_AMOY',
    walletBlockchainKey: 'CIRCLE_WALLET_BLOCKCHAIN_MATIC_AMOY',
    usdcAddressKey: 'CIRCLE_USDC_ADDRESS_MATIC_AMOY'
  },
  {
    label: 'solana',
    blockchain: 'SOL-DEVNET',
    walletIdKey: 'CIRCLE_WALLET_ID_SOL_DEVNET',
    walletAddressKey: 'CIRCLE_WALLET_ADDRESS_SOL_DEVNET',
    walletBlockchainKey: 'CIRCLE_WALLET_BLOCKCHAIN_SOL_DEVNET',
    usdcAddressKey: 'CIRCLE_USDC_ADDRESS_SOL_DEVNET'
  }
];

function normalizeApiKey(rawApiKey: string) {
  return rawApiKey.trim().replace(/^['\"]|['\"]$/g, '');
}

function assertApiKeyFormat(apiKey: string) {
  const segments = apiKey.split(':');
  if (segments.length !== 3) {
    throw new Error(
      'Invalid CIRCLE_API_KEY format in apps/backend/.env. Expected TEST_API_KEY:<key_id>:<key_secret>.',
    );
  }

  const [environment, keyId, keySecret] = segments;
  if (environment !== 'TEST_API_KEY') {
    throw new Error('This project is testnet-only. CIRCLE_API_KEY must start with TEST_API_KEY.');
  }

  if (!keyId || !keySecret) {
    throw new Error('Invalid CIRCLE_API_KEY. Key ID and key secret segments must both be non-empty.');
  }
}

function upsertEnvValue(filePath: string, key: string, value: string) {
  let content = '';
  if (fs.existsSync(filePath)) {
    content = fs.readFileSync(filePath, 'utf-8');
  }

  const line = `${key}=${value}`;
  const regex = new RegExp(`^${key}=.*$`, 'm');

  if (regex.test(content)) {
    content = content.replace(regex, line);
  } else {
    if (content.length > 0 && !content.endsWith('\n')) {
      content += '\n';
    }
    content += `${line}\n`;
  }

  fs.writeFileSync(filePath, content, 'utf-8');
}

function hasValue(value: string | undefined) {
  return Boolean(value && value.trim().length > 0);
}

async function main() {
  const rawApiKey = process.env.CIRCLE_API_KEY;
  const entitySecret = process.env.CIRCLE_ENTITY_SECRET;
  let walletSetId = process.env.CIRCLE_WALLET_SET_ID;
  const fallbackWalletId = process.env.CIRCLE_WALLET_ID;

  if (!rawApiKey) {
    throw new Error('CIRCLE_API_KEY is required. Add it to apps/backend/.env first.');
  }
  if (!entitySecret) {
    throw new Error('CIRCLE_ENTITY_SECRET is required. Run circle:wallet:init first.');
  }

  const apiKey = normalizeApiKey(rawApiKey);
  assertApiKeyFormat(apiKey);

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });

  const client = initiateDeveloperControlledWalletsClient({
    apiKey,
    entitySecret
  });

  if (!walletSetId && hasValue(fallbackWalletId)) {
    try {
      const walletResponse = await client.getWallet({ id: fallbackWalletId! });
      walletSetId = walletResponse.data?.wallet?.walletSetId || '';

      if (walletSetId) {
        upsertEnvValue(ENV_PATH, 'CIRCLE_WALLET_SET_ID', walletSetId);
        console.log(`Resolved CIRCLE_WALLET_SET_ID from CIRCLE_WALLET_ID (${fallbackWalletId}).`);
      }
    } catch {
      walletSetId = walletSetId || '';
    }
  }

  if (!walletSetId) {
    throw new Error(
      'CIRCLE_WALLET_SET_ID is required (or resolvable from CIRCLE_WALLET_ID). Run circle:wallet:init first.',
    );
  }

  const summary: Array<{
    chain: string;
    blockchain: string;
    walletId: string;
    walletAddress: string;
    mode: 'existing' | 'created';
    usdcAddressConfigured: boolean;
  }> = [];

  const missingUsdcKeys: string[] = [];

  for (const chain of TARGET_CHAINS) {
    const existingWalletId = process.env[chain.walletIdKey];
    const existingWalletAddress = process.env[chain.walletAddressKey];
    const usdcAddress = process.env[chain.usdcAddressKey];

    if (hasValue(existingWalletId) && hasValue(existingWalletAddress)) {
      upsertEnvValue(ENV_PATH, chain.walletBlockchainKey, chain.blockchain);

      if (!hasValue(usdcAddress)) {
        missingUsdcKeys.push(chain.usdcAddressKey);
      }

      summary.push({
        chain: chain.label,
        blockchain: chain.blockchain,
        walletId: existingWalletId!,
        walletAddress: existingWalletAddress!,
        mode: 'existing',
        usdcAddressConfigured: hasValue(usdcAddress)
      });

      continue;
    }

    console.log(`Creating wallet for ${chain.label} (${chain.blockchain})...`);

    const createdWallet = (
      await client.createWallets({
        walletSetId,
        blockchains: [chain.blockchain],
        count: 1,
        accountType: 'EOA'
      })
    ).data?.wallets?.[0];

    if (!createdWallet?.id || !createdWallet?.address) {
      throw new Error(`Failed to create wallet for ${chain.label}`);
    }

    upsertEnvValue(ENV_PATH, chain.walletIdKey, createdWallet.id);
    upsertEnvValue(ENV_PATH, chain.walletAddressKey, createdWallet.address);
    upsertEnvValue(ENV_PATH, chain.walletBlockchainKey, chain.blockchain);

    if (!hasValue(usdcAddress)) {
      missingUsdcKeys.push(chain.usdcAddressKey);
    }

    summary.push({
      chain: chain.label,
      blockchain: chain.blockchain,
      walletId: createdWallet.id,
      walletAddress: createdWallet.address,
      mode: 'created',
      usdcAddressConfigured: hasValue(usdcAddress)
    });
  }

  fs.writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        walletSetId,
        wallets: summary
      },
      null,
      2,
    ),
    'utf-8',
  );

  console.log('\nMulti-chain wallet setup complete.');
  console.table(summary);
  console.log(`Saved summary: ${OUTPUT_PATH}`);

  if (missingUsdcKeys.length) {
    const uniqueMissing = Array.from(new Set(missingUsdcKeys));
    console.log('\nNext step: set these USDC token address keys in apps/backend/.env to make each chain routable:');
    for (const key of uniqueMissing) {
      console.log(`- ${key}`);
    }
  } else {
    console.log('\nAll chain USDC token address keys are already set.');
  }
}

main().catch((error) => {
  const status = error?.response?.status;
  const data = error?.response?.data;
  console.error('Error:', error?.message || error);
  if (status) {
    console.error('HTTP status:', status);
  }
  if (data) {
    console.error('Circle response:', JSON.stringify(data, null, 2));
  }
  process.exit(1);
});
