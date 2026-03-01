import React, { useState, type FormEvent } from 'react';
import { createApi, getApiError } from '../../services/api';
import {
  CHAINS,
  NETWORK_CHAIN_IDS,
  NETWORK_CODES,
  NETWORK_LABELS,
  type ArcRoute,
  type ChainMetadataResponse,
  type Chain,
  type LiquiditySurfaceResponse,
  type TransferChain,
  type TransferPayload
} from '../../types';

const DESTINATION_CHAINS: TransferChain[] = ['arc-testnet', ...CHAINS];

function isValidArcAddress(value: string) {
  return /^0x[a-fA-F0-9]{40}$/.test(value.trim());
}

function isValidSolanaAddress(value: string) {
  return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(value.trim());
}

function isValidRecipientForChain(chain: TransferChain, value: string) {
  if (chain === 'solana') {
    return isValidSolanaAddress(value);
  }

  return isValidArcAddress(value);
}

function recipientPlaceholder(chain: TransferChain) {
  return chain === 'solana'
    ? 'Recipient Solana address (base58)'
    : 'Recipient EVM address (0x + 40 hex)';
}

function toHelpfulSendMessage(rawMessage: string) {
  const lower = rawMessage.toLowerCase();

  if (lower.includes('asset amount owned by the wallet is insufficient')) {
    return 'Transfer blocked by source wallet balance on Circle. Fund the selected source wallet with test USDC, then retry.';
  }

  if (lower.includes('cannot find target token')) {
    return 'Transfer blocked by token accessibility on Circle for this route. Verify chain token configuration and wallet access.';
  }

  return rawMessage;
}

export default function SendForm({
  token,
  onTransferSuccess
}: {
  token: string;
  onTransferSuccess: () => Promise<void>;
}) {
  const [fromChain, setFromChain] = useState<Chain>('base');
  const [toChain, setToChain] = useState<TransferChain>('arc-testnet');
  const [routeStrategy, setRouteStrategy] = useState<'auto' | 'manual'>('auto');
  const [amount, setAmount] = useState('1');
  const [recipient, setRecipient] = useState('');
  const [route, setRoute] = useState<ArcRoute | null>(null);
  const [message, setMessage] = useState('');
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bestSourceChain, setBestSourceChain] = useState<TransferChain | null>(null);
  const [routableDestinations, setRoutableDestinations] = useState<Set<TransferChain>>(new Set(DESTINATION_CHAINS));
  const [routableSources, setRoutableSources] = useState<Set<Chain>>(new Set(CHAINS));
  const [networkLabels, setNetworkLabels] = useState<Record<string, string>>({ ...NETWORK_LABELS });
  const [networkCodes, setNetworkCodes] = useState<Record<string, string>>({ ...NETWORK_CODES });
  const [networkChainIds, setNetworkChainIds] = useState<Record<string, number | null>>({
    ...NETWORK_CHAIN_IDS
  });
  const [destinationWallets, setDestinationWallets] = useState<Record<string, string | null>>({});
  const [availableUsdcByChain, setAvailableUsdcByChain] = useState<Record<string, number>>({});

  function hasLoadedLiquidityForChain(chain: TransferChain | Chain) {
    return Object.prototype.hasOwnProperty.call(availableUsdcByChain, chain);
  }

  function formatNetwork(chain: TransferChain | Chain) {
    const chainId = networkChainIds[chain];
    if (chainId) {
      return `${networkLabels[chain]} (${networkCodes[chain]} • Chain ID ${chainId})`;
    }

    return `${networkLabels[chain]} (${networkCodes[chain]})`;
  }

  React.useEffect(() => {
    async function fetchLiquiditySurface() {
      try {
        const metadata = await createApi(token).get<ChainMetadataResponse>('/wallet/metadata');
        const labels = { ...NETWORK_LABELS };
        const codes = { ...NETWORK_CODES };
        const ids = { ...NETWORK_CHAIN_IDS };
        metadata.data.chains.forEach((item) => {
          labels[item.chain] = item.label;
          codes[item.chain] = item.chainCode;
          ids[item.chain] = item.chainId;
        });
        setNetworkLabels(labels);
        setNetworkCodes(codes);
        setNetworkChainIds(ids);
      } catch {
      }

      try {
        const response = await createApi(token).get<LiquiditySurfaceResponse>('/wallet/liquidity');
        setBestSourceChain(response.data.bestSourceChain);
        const walletMap: Record<string, string | null> = {};
        const liquidityMap: Record<string, number> = {};
        response.data.chains.forEach((item) => {
          walletMap[item.chain] = item.walletAddress || null;
          liquidityMap[item.chain] = Number(item.availableUsdc || '0');
        });
        setDestinationWallets(walletMap);
        setAvailableUsdcByChain(liquidityMap);
        const routable = response.data.chains
          .filter((item) => item.isRoutable)
          .map((item) => item.chain as TransferChain);
        const destinationSet = new Set(routable);
        setRoutableDestinations(destinationSet);

        const sourceSet = new Set(
          routable.filter((item): item is Chain => item !== 'arc-testnet')
        );
        setRoutableSources(sourceSet.size ? sourceSet : new Set(CHAINS));

        if (!destinationSet.has(toChain)) {
          const fallbackDestination = routable[0] || 'arc-testnet';
          setToChain(fallbackDestination);
          setMessage('Destination network was updated to the first routable chain.');
        }

        if (routeStrategy === 'manual' && sourceSet.size && !sourceSet.has(fromChain)) {
          setFromChain(Array.from(sourceSet)[0]);
          setMessage('Source network was updated to a routable chain.');
        }
      } catch {
        setBestSourceChain(null);
      }
    }

    void fetchLiquiditySurface();
  }, [token]);

  React.useEffect(() => {
    if (recipient.trim()) {
      return;
    }

    const walletAddress = destinationWallets[toChain];
    if (walletAddress) {
      setRecipient(walletAddress);
    }
  }, [toChain, destinationWallets, recipient]);

  React.useEffect(() => {
    setRoute(null);
  }, [routeStrategy, fromChain, toChain]);

  function validateForm() {
    if (!routableDestinations.has(toChain)) {
      setRoute(null);
      setMessage('Selected destination is not routable with the current backend chain configuration.');
      return false;
    }

    if (routeStrategy === 'manual' && !routableSources.has(fromChain)) {
      setRoute(null);
      setMessage('Selected source is not routable. Choose another source chain or switch to auto source.');
      return false;
    }

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setRoute(null);
      setMessage('Enter a valid USD amount greater than 0.');
      return false;
    }

    if (!/^\d+(\.\d{1,6})?$/.test(amount.trim())) {
      setRoute(null);
      setMessage('Amount supports up to 6 decimal places.');
      return false;
    }

    if (routeStrategy === 'manual') {
      if (!hasLoadedLiquidityForChain(fromChain)) {
        setRoute(null);
        setMessage(`USDC balance for ${formatNetwork(fromChain)} is still loading. Try again in a moment.`);
        return false;
      }

      const manualAvailable = availableUsdcByChain[fromChain];
      if (parsedAmount > manualAvailable) {
        setRoute(null);
        setMessage(
          `Insufficient USDC on ${formatNetwork(fromChain)}. Available: ${manualAvailable.toFixed(6)} USDC.`
        );
        return false;
      }
    } else if (bestSourceChain) {
      if (!hasLoadedLiquidityForChain(bestSourceChain)) {
        setRoute(null);
        setMessage(`USDC balance for auto source ${formatNetwork(bestSourceChain)} is still loading. Try again in a moment.`);
        return false;
      }

      const autoAvailable = availableUsdcByChain[bestSourceChain];
      if (parsedAmount > autoAvailable) {
        setRoute(null);
        setMessage(
          `Insufficient USDC on auto source ${formatNetwork(bestSourceChain)}. Available: ${autoAvailable.toFixed(6)} USDC.`
        );
        return false;
      }
    }

    if (!recipient.trim()) {
      setRoute(null);
      setMessage('Recipient address is required.');
      return false;
    }

    if (!isValidRecipientForChain(toChain, recipient)) {
      setRoute(null);
      setMessage(
        toChain === 'solana'
          ? 'Enter a valid Solana address (base58).'
          : 'Enter a valid EVM-style address (0x + 40 hex characters).'
      );
      return false;
    }

    return true;
  }

  async function previewRoute() {
    if (!validateForm()) {
      return;
    }

    try {
      setIsPreviewLoading(true);
      const response = await createApi(token).post<{ route: ArcRoute }>('/transfer/quote', {
        fromChain: routeStrategy === 'manual' ? fromChain : undefined,
        toChain,
        amount
      });

      setRoute(response.data.route);
      setMessage(`Arc route ready from ${response.data.route.fromChain} to ${response.data.route.toChain}`);
    } catch (error) {
      setRoute(null);
      setMessage(getApiError(error, 'Failed to quote Arc route'));
    } finally {
      setIsPreviewLoading(false);
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!validateForm()) {
      return;
    }

    const payload: TransferPayload = {
      fromChain: routeStrategy === 'manual' ? fromChain : undefined,
      toChain,
      amount,
      recipient,
      routeStrategy
    };

    try {
      setIsSubmitting(true);
      const response = await createApi(token).post<{ route: ArcRoute }>('/transfer/send', payload);
      setRoute(response.data.route);
      setMessage(
        `Transfer submitted via Arc route ${response.data.route.routeId} from ${formatNetwork(response.data.route.fromChain)}`
      );
      await onTransferSuccess();
    } catch (error) {
      setRoute(null);
      const rawMessage = getApiError(error, 'Transfer failed');
      setMessage(toHelpfulSendMessage(rawMessage));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold text-slate-800">Send Form</h2>
      <div className="mt-4 flex gap-2">
        <button
          type="button"
          onClick={() => {
            setRouteStrategy('auto');
            setMessage('');
          }}
          className={`rounded-full border px-3 py-1 text-xs ${routeStrategy === 'auto' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600'}`}
        >
          Arc Auto Source
        </button>
        <button
          type="button"
          onClick={() => {
            setRouteStrategy('manual');
            setMessage('');
          }}
          className={`rounded-full border px-3 py-1 text-xs ${routeStrategy === 'manual' ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-slate-300 text-slate-600'}`}
        >
          Arc Manual Source
        </button>
      </div>
      {routeStrategy === 'auto' && bestSourceChain && (
        <p className="mt-3 text-xs text-slate-500">
          Auto source: {formatNetwork(bestSourceChain)} based on available USDC ({(availableUsdcByChain[bestSourceChain] || 0).toFixed(6)}).
        </p>
      )}
      {routeStrategy === 'manual' && (
        <p className="mt-3 text-xs text-slate-500">
          Manual source: {formatNetwork(fromChain)} • available {(availableUsdcByChain[fromChain] || 0).toFixed(6)} USDC.
        </p>
      )}
      <div className="mt-4 grid gap-2">
        {routeStrategy === 'manual' && (
          <>
            <label className="text-sm font-medium text-slate-600">From</label>
            <select
              value={fromChain}
              onChange={(event) => {
                setFromChain(event.target.value as Chain);
                setMessage('');
              }}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 capitalize text-slate-700"
            >
              {CHAINS.map((item) => (
                <option key={item} value={item} disabled={!routableSources.has(item)}>
                  {formatNetwork(item)}
                </option>
              ))}
            </select>
          </>
        )}
        <label className="mt-3 text-sm font-medium text-slate-600">To</label>
        <select
          value={toChain}
          onChange={(event) => {
            setToChain(event.target.value as TransferChain);
            setMessage('');
          }}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 capitalize text-slate-700"
        >
          {DESTINATION_CHAINS.map((item) => (
            <option key={item} value={item} disabled={!routableDestinations.has(item)}>
              {routableDestinations.has(item) ? formatNetwork(item) : `${formatNetwork(item)} (unavailable)`}
            </option>
          ))}
        </select>
        <label className="mt-3 text-sm font-medium text-slate-600">Amount (USD)</label>
        <input
          type="number"
          min="0"
          step="0.000001"
          value={amount}
          onChange={(event) => {
            setAmount(event.target.value);
            setRoute(null);
          }}
          placeholder="0.00"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700"
        />
      </div>
      <input
        value={recipient}
        onChange={(event) => {
          setRecipient(event.target.value);
          setRoute(null);
        }}
        placeholder={recipientPlaceholder(toChain)}
        className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-700"
      />
      <button
        type="button"
        onClick={previewRoute}
        disabled={isPreviewLoading || isSubmitting}
        className="mt-3 w-full rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPreviewLoading ? 'Previewing...' : 'Preview Arc Route'}
      </button>
      {route && (
        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
          <p><strong>Provider:</strong> {route.provider}</p>
          <p><strong>Route:</strong> {formatNetwork(route.fromChain)} → {formatNetwork(route.toChain)}</p>
          <p><strong>Receive:</strong> {route.estimatedReceiveUsdc} USDC (fee {route.estimatedFeeUsdc})</p>
          <p><strong>Path:</strong> {route.settlementPath} • ETA {route.estimatedEtaSeconds}s</p>
        </div>
      )}
      <button
        type="submit"
        disabled={isSubmitting || isPreviewLoading}
        className="mt-4 w-full rounded-lg bg-blue-700 px-4 py-2 font-medium text-white hover:bg-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? 'Submitting...' : 'Send USDC via Arc'}
      </button>
      {message && <p className="mt-2 text-sm text-slate-500">{message}</p>}
    </form>
  );
}
