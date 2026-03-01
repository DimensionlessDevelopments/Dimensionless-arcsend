'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChainInput, EstimateResponse } from '../types';
import { useArcSend } from './ArcSendProvider';

export interface UseQuoteParams {
  destinationChain?: ChainInput;
  amount?: string;
  sourceChain?: ChainInput;
  routeStrategy?: 'auto' | 'manual';
  enabled?: boolean;
  debounceMs?: number;
}

export interface UseQuoteReturn {
  quote: EstimateResponse['route'] | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useQuote(params: UseQuoteParams): UseQuoteReturn {
  const { client } = useArcSend();
  const [quote, setQuote] = useState<EstimateResponse['route'] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  const {
    destinationChain,
    amount,
    sourceChain,
    routeStrategy,
    enabled = true,
    debounceMs = 300
  } = params;

  const canFetch = useMemo(
    () => Boolean(enabled && destinationChain && amount && amount !== '0'),
    [enabled, destinationChain, amount]
  );

  const fetchQuote = useCallback(async () => {
    if (!canFetch || !destinationChain || !amount) {
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setError(null);

    try {
      const result = await client.transfers.estimate({
        destinationChain,
        amount,
        sourceChain,
        routeStrategy
      });

      if (requestId === requestIdRef.current) {
        setQuote(result.data?.route ?? null);
      }
    } catch (nextError) {
      if (requestId === requestIdRef.current) {
        setError(nextError instanceof Error ? nextError : new Error('Failed to fetch quote'));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [canFetch, client, destinationChain, amount, sourceChain, routeStrategy]);

  useEffect(() => {
    if (!canFetch) {
      setQuote(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      fetchQuote();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [canFetch, debounceMs, fetchQuote]);

  const refetch = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    await fetchQuote();
  }, [fetchQuote]);

  return { quote, isLoading, error, refetch };
}
