import axios, { AxiosInstance } from 'axios';
import { WalletsModule } from './modules/wallets';
import { TransfersModule } from './modules/transfers';
import { TransactionsModule } from './modules/transactions';
import { AuthModule } from './modules/auth';
import { ArcEventEmitter, ARC_EVENTS, type ArcEventName, type ArcEventPayloads } from './events';
import { ExecutionTracker, type TrackedTransfer } from './execution-tracker';
import type { NormalizedTransferStatus } from './types';

function assertBackendSafeCredential(value: string, fieldName: 'token' | 'apiKey') {
  const trimmed = value.trim();

  const looksLikeCircleApiKey = /^(TEST_API_KEY|LIVE_API_KEY):/i.test(trimmed);
  const looksLikeCircleEntitySecret = /^[a-fA-F0-9]{64}$/.test(trimmed);

  if (looksLikeCircleApiKey || looksLikeCircleEntitySecret) {
    throw new Error(
      `${fieldName} appears to be a Circle credential. Do not pass Circle API keys or Entity Secrets to the public SDK client. Use an ArcSend-issued auth token/API key from your backend auth layer.`
    );
  }
}

export interface ArcSendConfig {
  apiKey?: string;
  baseUrl?: string;
  timeout?: number;
  token?: string;
  getToken?: () => string | undefined | Promise<string | undefined>;
}

export class ArcSendClient {
  private http: AxiosInstance;
  public wallets: WalletsModule;
  public transfers: TransfersModule;
  public transactions: TransactionsModule;
  public auth: AuthModule;
  public readonly tracker: ExecutionTracker;
  public readonly events: ArcEventEmitter;

  constructor(config: ArcSendConfig) {
    const initialToken = config.token || config.apiKey;

    if (config.token) {
      assertBackendSafeCredential(config.token, 'token');
    }

    if (config.apiKey) {
      assertBackendSafeCredential(config.apiKey, 'apiKey');
    }

    this.http = axios.create({
      baseURL: config.baseUrl || 'http://localhost:4001',
      timeout: config.timeout || 30000,
      headers: {
        ...(initialToken ? { Authorization: `Bearer ${initialToken}` } : {}),
        'Content-Type': 'application/json'
      }
    });

    this.wallets = new WalletsModule(this.http, config.getToken);
    this.transfers = new TransfersModule(this.http, config.getToken);
    this.transactions = new TransactionsModule(this.http, config.getToken);
    this.auth = new AuthModule(this.http);
    this.tracker = new ExecutionTracker();
    this.events = new ArcEventEmitter();
  }

  setToken(token: string) {
    assertBackendSafeCredential(token, 'token');
    this.http.defaults.headers.common.Authorization = `Bearer ${token}`;
  }

  clearToken() {
    delete this.http.defaults.headers.common.Authorization;
  }

  on<K extends ArcEventName>(event: K, callback: (data: ArcEventPayloads[K]) => void) {
    this.events.on(event, callback);
  }

  off<K extends ArcEventName>(event: K, callback: (data: ArcEventPayloads[K]) => void) {
    this.events.off(event, callback);
  }

  async refreshTransferStatus(transferId: string): Promise<NormalizedTransferStatus> {
    const result = await this.transfers.getStatusNormalized(transferId);
    const status = result.data as NormalizedTransferStatus;
    this.syncTrackedTransfer(status);
    return status;
  }

  getTrackedTransfer(transferId: string): TrackedTransfer | undefined {
    return this.tracker.get(transferId);
  }

  listTrackedTransfers(): TrackedTransfer[] {
    return this.tracker.list();
  }

  private syncTrackedTransfer(status: NormalizedTransferStatus): TrackedTransfer {
    const tracked = this.tracker.syncFromBackend(status);

    this.events.emit(ARC_EVENTS.TRANSFER_STATUS_CHANGED, {
      transferId: status.id,
      status: status.status,
      rawStatus: status.rawStatus,
      txHash: status.txHash,
      timestamp: Date.now()
    });

    if (status.status === 'completed') {
      this.events.emit(ARC_EVENTS.TRANSFER_COMPLETED, {
        transferId: status.id,
        txHash: status.txHash,
        timestamp: Date.now()
      });
    }

    if (status.status === 'failed') {
      this.events.emit(ARC_EVENTS.TRANSFER_FAILED, {
        transferId: status.id,
        error: {
          message: 'Transfer failed according to backend status',
          recoverable: false
        },
        timestamp: Date.now()
      });
    }

    return tracked;
  }
}
