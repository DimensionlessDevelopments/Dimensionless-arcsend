import { BaseModule } from '../base';
import {
  type ApiResponse,
  type CanonicalTransferStatus,
  EstimateRequestSchema,
  EstimateResponseSchema,
  type EstimateResponse,
  type NormalizedTransferStatus,
  SendRequestSchema,
  type SendRequest,
  SendResponseSchema,
  type SendResponse,
  type TransferStatusRaw,
  TransferStatusSchema,
  type TransferStatus,
  normalizeChain
} from '../types';
import { toCanonicalTransferStatus } from '../status';
import { normalizeAxiosError, parseWithSchema, wrapSuccess } from '../utils';

function mapEstimateToQuoteBody(request: Parameters<typeof SendRequestSchema.parse>[0]) {
  const parsed = EstimateRequestSchema.parse(request);
  const manual = parsed.routeStrategy === 'manual' && parsed.sourceChain;
  const normalizedSource = manual ? normalizeChain(parsed.sourceChain as NonNullable<typeof parsed.sourceChain>) : undefined;

  return {
    toChain: normalizeChain(parsed.destinationChain),
    amount: parsed.amount,
    ...(normalizedSource ? { fromChain: normalizedSource } : {})
  };
}

export class TransfersModule extends BaseModule {
  async estimate(request: Parameters<typeof EstimateRequestSchema.parse>[0]): Promise<ApiResponse<EstimateResponse>> {
    try {
      const body = mapEstimateToQuoteBody(request);
      const response = await this.http.post('/transfer/quote', body, {
        headers: await this.authHeaders()
      });

      return wrapSuccess(parseWithSchema(EstimateResponseSchema, response.data));
    } catch (error) {
      normalizeAxiosError(error, 'Failed to estimate transfer');
    }
  }

  async send(request: SendRequest): Promise<ApiResponse<SendResponse>> {
    try {
      const parsed = SendRequestSchema.parse(request);
      const manual = parsed.routeStrategy === 'manual' && parsed.sourceChain;
      const normalizedSource = manual
        ? normalizeChain(parsed.sourceChain as NonNullable<typeof parsed.sourceChain>)
        : undefined;

      const response = await this.http.post(
        '/transfer/send',
        {
          toChain: normalizeChain(parsed.destinationChain),
          amount: parsed.amount,
          recipient: parsed.destinationAddress,
          routeStrategy: parsed.routeStrategy || 'auto',
          ...(normalizedSource ? { fromChain: normalizedSource } : {})
        },
        { headers: await this.authHeaders() }
      );

      return wrapSuccess(parseWithSchema(SendResponseSchema, response.data));
    } catch (error) {
      normalizeAxiosError(error, 'Failed to send transfer');
    }
  }

  async getStatus(transferId: string): Promise<ApiResponse<TransferStatus>> {
    try {
      const response = await this.http.get(`/transfer/status/${transferId}`, {
        headers: await this.authHeaders()
      });

      return wrapSuccess(parseWithSchema(TransferStatusSchema, response.data));
    } catch (error) {
      normalizeAxiosError(error, 'Failed to get transfer status');
    }
  }

  async getStatusNormalized(transferId: string): Promise<ApiResponse<NormalizedTransferStatus>> {
    const result = await this.getStatus(transferId);
    const data = result.data as TransferStatus;

    const normalized: NormalizedTransferStatus = {
      ...data,
      rawStatus: data.status as TransferStatusRaw,
      status: toCanonicalTransferStatus(data.status)
    };

    return wrapSuccess(normalized);
  }

  normalizeStatus(status: TransferStatusRaw | string): CanonicalTransferStatus {
    return toCanonicalTransferStatus(status);
  }
}
