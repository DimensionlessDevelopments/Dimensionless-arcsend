'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ARC_EVENTS } from '../events';
import type { NormalizedTransferStatus } from '../types';
import { useArcSend } from './ArcSendProvider';

export interface UseTransferStatusParams {
  transferId?: string;
  enabled?: boolean;
  pollIntervalMs?: number;
}

export interface UseTransferStatusReturn {
  status: NormalizedTransferStatus | null;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

export function useTransferStatus({
  transferId,
  enabled = true,
  pollIntervalMs = 4000
}: UseTransferStatusParams): UseTransferStatusReturn {
  const { client } = useArcSend();
  const [status, setStatus] = useState<NormalizedTransferStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const requestIdRef = useRef(0);

  const canFetch = Boolean(enabled && transferId);

  const fetchStatus = useCallback(async () => {
    if (!transferId || !canFetch) {
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);

    try {
      const nextStatus = await client.refreshTransferStatus(transferId);
      if (requestId === requestIdRef.current) {
        setStatus(nextStatus);
        setError(null);
      }
    } catch (nextError) {
      if (requestId === requestIdRef.current) {
        setError(nextError instanceof Error ? nextError : new Error('Failed to fetch transfer status'));
      }
    } finally {
      if (requestId === requestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [canFetch, client, transferId]);

  useEffect(() => {
    if (!canFetch) {
      setStatus(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    fetchStatus();

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    intervalRef.current = setInterval(fetchStatus, pollIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [canFetch, fetchStatus, pollIntervalMs]);

  useEffect(() => {
    if (!transferId) {
      return;
    }

    const handleChange = (event: { transferId: string }) => {
      if (event.transferId === transferId) {
        fetchStatus();
      }
    };

    client.on(ARC_EVENTS.TRANSFER_STATUS_CHANGED, handleChange);
    return () => client.off(ARC_EVENTS.TRANSFER_STATUS_CHANGED, handleChange);
  }, [client, fetchStatus, transferId]);

  return {
    status,
    isLoading,
    error,
    refetch: fetchStatus
  };
}
