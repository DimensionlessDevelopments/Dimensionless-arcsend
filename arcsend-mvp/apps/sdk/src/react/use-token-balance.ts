'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChainInput, WalletBalance } from '../types';
import { useArcSend } from './ArcSendProvider';

export interface UseTokenBalanceParams {
  chain?: ChainInput;
  enabled?: boolean;
  refetchIntervalMs?: number;
}

export interface UseTokenBalanceReturn {
  balance: WalletBalance | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTokenBalance({
  chain,
  enabled = true,
  refetchIntervalMs
}: UseTokenBalanceParams): UseTokenBalanceReturn {
  const { client } = useArcSend();
  const [balance, setBalance] = useState<WalletBalance | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const requestIdRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const canFetch = Boolean(enabled && chain);

  const fetchBalance = useCallback(async () => {
    if (!chain || !canFetch) {
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    try {
      const result = await client.wallets.getBalance(chain);
      if (requestId === requestIdRef.current) {
        setBalance(result.data ?? null);
        setError(null);
      }
    } catch (nextError) {
      if (requestId === requestIdRef.current) {
        setError(nextError instanceof Error ? nextError : new Error('Failed to fetch balance'));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [canFetch, chain, client]);

  useEffect(() => {
    if (!canFetch) {
      setIsLoading(false);
      setError(null);
      setBalance(null);
      return;
    }

    fetchBalance();

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (refetchIntervalMs && refetchIntervalMs > 0) {
      intervalRef.current = setInterval(fetchBalance, refetchIntervalMs);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [canFetch, fetchBalance, refetchIntervalMs]);

  return {
    balance,
    isLoading,
    error,
    refetch: fetchBalance
  };
}
