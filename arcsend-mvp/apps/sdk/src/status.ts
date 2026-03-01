import type { CanonicalTransferStatus, TransferStatusRaw } from './types';

const submittedLike = new Set<TransferStatusRaw>(['submitted', 'pending']);
const processingLike = new Set<TransferStatusRaw>(['confirmed', 'processing']);

export function toCanonicalTransferStatus(status: TransferStatusRaw | string): CanonicalTransferStatus {
  const normalized = String(status).toLowerCase() as TransferStatusRaw;

  if (normalized === 'completed') {
    return 'completed';
  }

  if (normalized === 'failed') {
    return 'failed';
  }

  if (processingLike.has(normalized)) {
    return 'processing';
  }

  if (submittedLike.has(normalized)) {
    return 'pending';
  }

  return 'pending';
}
