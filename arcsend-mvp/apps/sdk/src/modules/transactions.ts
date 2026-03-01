import { BaseModule } from '../base';
import {
  type ApiResponse,
  type NormalizedTransactionItem,
  type TransferStatusRaw,
  TransactionGetSchema,
  type TransactionItem,
  TransactionsListSchema,
  WebhookPayloadSchema,
  type WebhookPayload
} from '../types';
import { toCanonicalTransferStatus } from '../status';
import { normalizeAxiosError, parseWithSchema, wrapSuccess } from '../utils';

export class TransactionsModule extends BaseModule {
  async list(): Promise<ApiResponse<TransactionItem[]>> {
    try {
      const response = await this.http.get('/transactions', {
        headers: await this.authHeaders()
      });

      return wrapSuccess(parseWithSchema(TransactionsListSchema, response.data).items);
    } catch (error) {
      normalizeAxiosError(error, 'Failed to load transactions');
    }
  }

  async get(id: string): Promise<ApiResponse<TransactionItem>> {
    try {
      const response = await this.http.get(`/transactions/${id}`, {
        headers: await this.authHeaders()
      });

      return wrapSuccess(parseWithSchema(TransactionGetSchema, response.data).item);
    } catch (error) {
      normalizeAxiosError(error, 'Failed to load transaction');
    }
  }

  async webhooks(payload: WebhookPayload) {
    try {
      const parsed = WebhookPayloadSchema.parse(payload);
      const response = await this.http.post('/transactions/webhooks', parsed);
      return wrapSuccess(response.data);
    } catch (error) {
      normalizeAxiosError(error, 'Failed to post webhook payload');
    }
  }

  async listNormalized(): Promise<ApiResponse<NormalizedTransactionItem[]>> {
    const result = await this.list();
    const items = (result.data ?? []).map((item) => ({
      ...item,
      rawStatus: item.status as TransferStatusRaw,
      status: toCanonicalTransferStatus(item.status)
    }));

    return wrapSuccess(items);
  }

  async getNormalized(id: string): Promise<ApiResponse<NormalizedTransactionItem>> {
    const result = await this.get(id);
    const item = result.data as TransactionItem;

    return wrapSuccess({
      ...item,
      rawStatus: item.status as TransferStatusRaw,
      status: toCanonicalTransferStatus(item.status)
    });
  }
}
