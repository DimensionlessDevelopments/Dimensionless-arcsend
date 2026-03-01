import React from 'react';
import { createApi, getApiError } from '../../services/api';
import {
  type ChainMetadataResponse,
  NETWORK_CHAIN_IDS,
  NETWORK_CODES,
  NETWORK_LABELS,
  type TransactionItem,
  type TransferChain
} from '../../types';
import TransactionStatus from './TransactionStatus';

const EXPLORER_TX_BASE_BY_CHAIN: Record<TransferChain, string> = {
  'arc-testnet': import.meta.env.VITE_ARC_TESTNET_EXPLORER_TX_BASE || 'https://testnet.arcscan.app/tx/',
  ethereum: 'https://sepolia.etherscan.io/tx/',
  base: 'https://sepolia.basescan.org/tx/',
  polygon: 'https://amoy.polygonscan.com/tx/',
  solana: 'https://solscan.io/tx/'
};

export default function TransactionList({
  token,
  items,
  setItems,
  setMessage
}: {
  token: string;
  items: TransactionItem[];
  setItems: (value: TransactionItem[]) => void;
  setMessage: (value: string) => void;
}) {
  const [networkLabels, setNetworkLabels] = React.useState<Record<string, string>>({ ...NETWORK_LABELS });
  const [networkCodes, setNetworkCodes] = React.useState<Record<string, string>>({ ...NETWORK_CODES });
  const [networkChainIds, setNetworkChainIds] = React.useState<Record<string, number | null>>({
    ...NETWORK_CHAIN_IDS
  });
  const [explorerByChain, setExplorerByChain] = React.useState<Record<string, string>>({
    ...EXPLORER_TX_BASE_BY_CHAIN
  });

  React.useEffect(() => {
    async function fetchMetadata() {
      try {
        const response = await createApi(token).get<ChainMetadataResponse>('/wallet/metadata');
        const labels = { ...NETWORK_LABELS };
        const codes = { ...NETWORK_CODES };
        const ids = { ...NETWORK_CHAIN_IDS };
        const explorer = { ...EXPLORER_TX_BASE_BY_CHAIN };

        response.data.chains.forEach((item) => {
          labels[item.chain] = item.label;
          codes[item.chain] = item.chainCode;
          ids[item.chain] = item.chainId;
          explorer[item.chain] = item.explorerTxBase;
        });

        setNetworkLabels(labels);
        setNetworkCodes(codes);
        setNetworkChainIds(ids);
        setExplorerByChain(explorer);
      } catch {
      }
    }

    void fetchMetadata();
  }, [token]);

  function getExplorerTxUrlFromMap(item: TransactionItem) {
    const bridgeType = (item.bridgeType || '').toLowerCase();
    if (bridgeType.includes('soft-fallback')) {
      return null;
    }

    const txHash = item.txHash?.trim();
    if (!txHash) {
      return null;
    }

    if (item.toChain === 'arc-testnet' && !txHash.startsWith('0x')) {
      return null;
    }

    const base = explorerByChain[item.toChain];
    if (!base) {
      return null;
    }

    return `${base}${txHash}`;
  }

  function getExplorerUrlLabelFromMap(chain: TransferChain) {
    const chainId = networkChainIds[chain];
    if (chainId) {
      return `${networkLabels[chain]} (${networkCodes[chain]} • ${chainId})`;
    }

    return `${networkLabels[chain]} (${networkCodes[chain]})`;
  }

  async function fetchHistory() {
    try {
      const response = await createApi(token).get<{ items: TransactionItem[] }>('/transfer/history');
      setItems(response.data.items || []);
      setMessage('History refreshed');
    } catch (error) {
      setMessage(getApiError(error, 'Failed to load history'));
      setItems([]);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-800">Transaction History</h2>
        <button
          onClick={fetchHistory}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>
      <ul className="space-y-2 pl-0">
        {items.map((item) => {
          const explorerUrl = getExplorerTxUrlFromMap(item);
          const isSoftFallback = (item.bridgeType || '').toLowerCase().includes('soft-fallback');

          return (
            <li key={item.id} className="list-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700">
              <button
                type="button"
                onClick={() => {
                  if (explorerUrl) {
                    window.open(explorerUrl, '_blank', 'noopener,noreferrer');
                    return;
                  }

                  setMessage('Explorer link not available yet. Refresh after confirmation.');
                }}
                className="w-full text-left"
              >
                {item.amount} USDC {getExplorerUrlLabelFromMap(item.fromChain)}→{getExplorerUrlLabelFromMap(item.toChain)} • <TransactionStatus status={item.status} transferId={item.id} /> •{' '}
                {item.bridgeType}
                {explorerUrl ? (
                  <span className="ml-2 text-xs text-blue-600 underline">View on explorer</span>
                ) : isSoftFallback ? (
                  <span className="ml-2 text-xs text-amber-600">Simulated fallback (no on-chain tx)</span>
                ) : (
                  <span className="ml-2 text-xs text-slate-400">Explorer pending</span>
                )}
              </button>
            </li>
          );
        })}
      </ul>
      {items.length === 0 && (
        <p className="mt-3 text-sm text-slate-500">No transactions yet. Send USDC to populate history.</p>
      )}
    </div>
  );
}
