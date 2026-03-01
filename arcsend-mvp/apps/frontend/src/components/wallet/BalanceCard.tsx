import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createApi, getApiError } from '../../services/api';
import {
  CHAINS,
  NETWORK_CODES,
  NETWORK_LABELS,
  type BalanceChain,
  type ChainMetadataResponse,
  type LiquidityChainItem,
  type LiquiditySurfaceResponse
} from '../../types';

const BALANCE_CHAINS: BalanceChain[] = ['arc-testnet', ...CHAINS];

export default function BalanceCard({
  token,
  refreshTick
}: {
  token: string;
  refreshTick?: number;
}) {
  const [chain, setChain] = useState<BalanceChain>('arc-testnet');
  const [chainLiquidity, setChainLiquidity] = useState<LiquidityChainItem | null>(null);
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [networkLabels, setNetworkLabels] = useState<Record<string, string>>({ ...NETWORK_LABELS });
  const [networkCodes, setNetworkCodes] = useState<Record<string, string>>({ ...NETWORK_CODES });
  const latestRequestId = useRef(0);

  useEffect(() => {
    async function fetchMetadata() {
      try {
        const response = await createApi(token).get<ChainMetadataResponse>('/wallet/metadata');
        const labels = { ...NETWORK_LABELS };
        const codes = { ...NETWORK_CODES };
        response.data.chains.forEach((item) => {
          labels[item.chain] = item.label;
          codes[item.chain] = item.chainCode;
        });
        setNetworkLabels(labels);
        setNetworkCodes(codes);
      } catch {
      }
    }

    void fetchMetadata();
  }, [token]);

  const fetchBalance = useCallback(async () => {
    const requestId = latestRequestId.current + 1;
    latestRequestId.current = requestId;
    const selectedChain = chain;

    try {
      setIsLoading(true);
      const response = await createApi(token).get<LiquiditySurfaceResponse>('/wallet/liquidity');
      const selectedLiquidity = response.data.chains.find((item) => item.chain === selectedChain) || null;

      if (requestId !== latestRequestId.current) {
        return;
      }

      if (!selectedLiquidity) {
        setChainLiquidity(null);
        setMessage(`No liquidity entry found for ${networkLabels[selectedChain]} (${networkCodes[selectedChain]})`);
        return;
      }

      setChainLiquidity(selectedLiquidity);
      setMessage(`Balance loaded from unified liquidity surface for ${networkLabels[selectedChain]} (${selectedLiquidity.chainCode})`);
    } catch (error) {
      if (requestId !== latestRequestId.current) {
        return;
      }

      setMessage(getApiError(error, 'Balance fetch failed'));
      setChainLiquidity(null);
    } finally {
      if (requestId === latestRequestId.current) {
        setIsLoading(false);
      }
    }
  }, [chain, token, networkLabels, networkCodes]);

  useEffect(() => {
    void fetchBalance();
  }, [fetchBalance, refreshTick]);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-800">Balance Card</h2>
      <div className="mt-4 flex flex-wrap gap-3">
        <select
          value={chain}
          onChange={(event) => setChain(event.target.value as BalanceChain)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 capitalize text-slate-700"
        >
          {BALANCE_CHAINS.map((item) => (
            <option key={item} value={item}>
              {networkLabels[item]} ({networkCodes[item]})
            </option>
          ))}
        </select>
        <button
          onClick={fetchBalance}
          disabled={isLoading}
          className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600"
        >
          {isLoading ? 'Loading...' : 'Load Balance'}
        </button>
      </div>
      {chainLiquidity && (
        <div className="mt-4 space-y-2 text-slate-700">
          <p>
            <span className="font-medium">Wallet Address:</span>{' '}
            {chainLiquidity.walletAddress ? (
              <span className="break-all">{chainLiquidity.walletAddress}</span>
            ) : (
              <span className="text-slate-500">Not available</span>
            )}
          </p>
          <p>
            <span className="font-medium">Network:</span> {chainLiquidity.chainCode}
          </p>
          <p>
            <span className="font-medium">Route Status:</span>{' '}
            {chainLiquidity.isRoutable ? 'Routable' : 'Not configured'}
          </p>
          <p>
            <span className="font-medium">{networkLabels[chainLiquidity.chain]} Balance:</span>{' '}
            {Number(chainLiquidity.availableUsdc).toLocaleString()} USDC
          </p>
        </div>
      )}
      {message && <p className="mt-2 text-sm text-slate-500">{message}</p>}
    </div>
  );
}
