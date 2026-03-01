import type { CanonicalTransferStatus, NormalizedTransferStatus } from './types';

export interface TrackedTransfer {
  id: string;
  status: CanonicalTransferStatus;
  rawStatus: string;
  txHash?: string | null;
  fromChain: string;
  toChain: string;
  amount: string;
  recipient: string;
  updatedAt: string;
  firstSeenAt: number;
  lastSeenAt: number;
}

export class ExecutionTracker {
  private readonly entries = new Map<string, TrackedTransfer>();
  private readonly maxEntries: number;

  constructor(maxEntries = 250) {
    this.maxEntries = maxEntries;
  }

  syncFromBackend(status: NormalizedTransferStatus): TrackedTransfer {
    const now = Date.now();
    const existing = this.entries.get(status.id);

    const tracked: TrackedTransfer = {
      id: status.id,
      status: status.status,
      rawStatus: status.rawStatus,
      txHash: status.txHash,
      fromChain: status.fromChain,
      toChain: status.toChain,
      amount: status.amount,
      recipient: status.recipient,
      updatedAt: status.updatedAt,
      firstSeenAt: existing?.firstSeenAt ?? now,
      lastSeenAt: now
    };

    this.entries.set(status.id, tracked);
    this.trim();
    return tracked;
  }

  get(id: string): TrackedTransfer | undefined {
    return this.entries.get(id);
  }

  list(): TrackedTransfer[] {
    return Array.from(this.entries.values()).sort((a, b) => b.lastSeenAt - a.lastSeenAt);
  }

  clear(): void {
    this.entries.clear();
  }

  private trim(): void {
    if (this.entries.size <= this.maxEntries) {
      return;
    }

    const overflow = this.entries.size - this.maxEntries;
    const oldest = Array.from(this.entries.entries())
      .sort(([, a], [, b]) => a.lastSeenAt - b.lastSeenAt)
      .slice(0, overflow);

    for (const [id] of oldest) {
      this.entries.delete(id);
    }
  }
}
