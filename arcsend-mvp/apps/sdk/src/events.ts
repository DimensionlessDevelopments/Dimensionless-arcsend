import type { CanonicalTransferStatus } from './types';

export const ARC_EVENTS = {
  TRANSFER_STATUS_CHANGED: 'transferStatusChanged',
  TRANSFER_COMPLETED: 'transferCompleted',
  TRANSFER_FAILED: 'transferFailed'
} as const;

export type ArcEventName = (typeof ARC_EVENTS)[keyof typeof ARC_EVENTS];

export interface ArcEventPayloads {
  [ARC_EVENTS.TRANSFER_STATUS_CHANGED]: {
    transferId: string;
    status: CanonicalTransferStatus;
    rawStatus: string;
    txHash?: string | null;
    timestamp: number;
  };
  [ARC_EVENTS.TRANSFER_COMPLETED]: {
    transferId: string;
    txHash?: string | null;
    timestamp: number;
  };
  [ARC_EVENTS.TRANSFER_FAILED]: {
    transferId: string;
    error: { message: string; code?: string; recoverable?: boolean };
    timestamp: number;
  };
}

type EventCallback<T = unknown> = (data: T) => void;

export class ArcEventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();

  on<K extends ArcEventName>(event: K, callback: (data: ArcEventPayloads[K]) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }

    this.listeners.get(event)?.add(callback as EventCallback);
  }

  off<K extends ArcEventName>(event: K, callback: (data: ArcEventPayloads[K]) => void): void {
    this.listeners.get(event)?.delete(callback as EventCallback);
  }

  emit<K extends ArcEventName>(event: K, data: ArcEventPayloads[K]): void {
    const callbacks = this.listeners.get(event);
    if (!callbacks) {
      return;
    }

    for (const callback of callbacks) {
      callback(data);
    }
  }

  removeAllListeners(event?: ArcEventName): void {
    if (event) {
      this.listeners.delete(event);
      return;
    }

    this.listeners.clear();
  }
}
