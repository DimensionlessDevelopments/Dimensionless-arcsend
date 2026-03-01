const API_BASE = process.env.CIRCLE_BASE_URL || 'https://api.circle.com';

const chains = [
  { chain: 'BASE-SEPOLIA', envKey: 'CIRCLE_USDC_ADDRESS_BASE_SEPOLIA' },
  { chain: 'ETH-SEPOLIA', envKey: 'CIRCLE_USDC_ADDRESS_ETH_SEPOLIA' },
  { chain: 'MATIC-AMOY', envKey: 'CIRCLE_USDC_ADDRESS_MATIC_AMOY' },
  { chain: 'SOL-DEVNET', envKey: 'CIRCLE_USDC_ADDRESS_SOL_DEVNET' }
] as const;

function normalizeApiKey(rawApiKey: string) {
  return rawApiKey.trim().replace(/^['\"]|['\"]$/g, '');
}

async function getUsdcTokenAddress({
  apiKey,
  chain
}: {
  apiKey: string;
  chain: string;
}) {
  const url = new URL('/v1/w3s/config/entity/monitoredTokens', API_BASE);
  url.searchParams.set('symbol', 'USDC');
  url.searchParams.set('blockchain', chain);
  url.searchParams.set('pageSize', '20');

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`
    }
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(`Circle API error (${response.status}) for ${chain}: ${bodyText}`);
  }

  let payload: any = {};
  if (bodyText.trim().length > 0) {
    try {
      payload = JSON.parse(bodyText);
    } catch {
      throw new Error(`Circle API returned non-JSON response for ${chain}: ${bodyText}`);
    }
  }
  const tokens =
    payload?.data?.tokens ||
    payload?.data?.items ||
    payload?.tokens ||
    payload?.items ||
    [];

  const exact = tokens.find((token: any) => token?.symbol === 'USDC' && token?.blockchain === chain);
  const fallback = tokens.find((token: any) => token?.symbol === 'USDC');
  const selected = exact || fallback;

  if (!selected) {
    return {
      tokenId: null,
      tokenAddress: null
    };
  }

  return {
    tokenId: selected.id || null,
    tokenAddress: selected.tokenAddress || selected.address || selected.contractAddress || null
  };
}

async function main() {
  const rawApiKey = process.env.CIRCLE_API_KEY;
  if (!rawApiKey) {
    throw new Error('CIRCLE_API_KEY is required in apps/backend/.env');
  }

  const apiKey = normalizeApiKey(rawApiKey);
  const rows: Array<{ chain: string; tokenId: string | null; tokenAddress: string | null; envKey: string }> = [];

  for (const { chain, envKey } of chains) {
    const result = await getUsdcTokenAddress({ apiKey, chain });
    rows.push({ chain, tokenId: result.tokenId, tokenAddress: result.tokenAddress, envKey });
  }

  console.table(
    rows.map((row) => ({
      chain: row.chain,
      tokenId: row.tokenId,
      tokenAddress: row.tokenAddress,
      envKey: row.envKey
    }))
  );

  console.log('ENV_BLOCK_START');
  for (const row of rows) {
    console.log(`${row.envKey}=${row.tokenAddress || ''}`);
  }
  console.log('ENV_BLOCK_END');
}

main().catch((error) => {
  console.error(error?.message || error);
  process.exit(1);
});
