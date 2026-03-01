import { useCallback, useEffect, useMemo, useState } from 'react';
import { createApi, getApiError } from '../../services/api';
import { NETWORK_CODES, NETWORK_LABELS, type LiquiditySurfaceResponse } from '../../types';

export default function LiquiditySurfaceCard({
  token,
  refreshTick
}: {
  token: string;
  refreshTick?: number;
}) {
  const [surface, setSurface] = useState<LiquiditySurfaceResponse | null>(null);
  const [message, setMessage] = useState('');

  const totalUsdc = useMemo(() => Number(surface?.totalUsdc || 0), [surface?.totalUsdc]);

  const fetchLiquidity = useCallback(async () => {
    try {
      const response = await createApi(token).get<LiquiditySurfaceResponse>('/wallet/liquidity');
      setSurface(response.data);
      setMessage('');
    } catch (error) {
      setSurface(null);
      setMessage(getApiError(error, 'Failed to load liquidity surface'));
    }
  }, [token]);

  useEffect(() => {
    void fetchLiquidity();
  }, [fetchLiquidity, refreshTick]);

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <p className="mb-1 text-xs text-muted-foreground">Unified USDC Liquidity Surface</p>
          <p className="font-display text-2xl font-bold text-foreground">${totalUsdc.toLocaleString()} USDC</p>
        </div>
        <button
          type="button"
          onClick={() => void fetchLiquidity()}
          className="rounded-lg border border-border px-3 py-2 text-xs text-foreground hover:bg-secondary"
        >
          Refresh
        </button>
      </div>

      {surface && (
        <>
          <p className="mb-3 text-xs text-muted-foreground">
            Auto source currently uses {NETWORK_LABELS[surface.bestSourceChain]} ({NETWORK_CODES[surface.bestSourceChain]}).
          </p>
          <ul className="space-y-2">
            {surface.chains.map((item) => (
              <li key={item.chain} className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-xs">
                <div>
                  <p className="font-medium text-foreground">
                    {NETWORK_LABELS[item.chain]} ({item.chainCode})
                  </p>
                  <p className="text-muted-foreground">{item.isRoutable ? 'Routable' : 'Not configured'}</p>
                </div>
                <p className="font-semibold text-foreground">{Number(item.availableUsdc).toLocaleString()} USDC</p>
              </li>
            ))}
          </ul>
        </>
      )}

      {message && <p className="mt-3 text-xs text-muted-foreground">{message}</p>}
    </div>
  );
}
