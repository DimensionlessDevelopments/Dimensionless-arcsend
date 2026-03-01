import React from 'react';
import { useTransferStatus } from 'arcsend-sdk/react';

export default function TransactionStatus({
  status,
  transferId
}: {
  status: string;
  transferId?: string;
}) {
  const normalizedInput = status.toLowerCase();
  const isTerminal = normalizedInput === 'completed' || normalizedInput === 'failed';

  const { status: liveStatus } = useTransferStatus({
    transferId,
    enabled: Boolean(transferId) && !isTerminal,
    pollIntervalMs: 4000
  });

  const normalized = liveStatus?.status ?? (normalizedInput === 'confirmed' ? 'processing' : normalizedInput === 'submitted' ? 'pending' : normalizedInput);
  const label = liveStatus?.status ?? status;

  const className =
    normalized === 'completed'
      ? 'inline-flex rounded-full border border-emerald-300 bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-700'
      : normalized === 'processing'
        ? 'inline-flex rounded-full border border-blue-300 bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700'
      : normalized === 'failed'
        ? 'inline-flex rounded-full border border-rose-300 bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700'
        : 'inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700';

  return <span className={className}>{label}</span>;
}
