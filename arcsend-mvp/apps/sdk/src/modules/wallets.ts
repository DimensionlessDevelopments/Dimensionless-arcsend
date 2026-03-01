import { BaseModule } from '../base';
import {
  type ApiResponse,
  type Chain,
  ChainMetadataSchema,
  type LiquiditySurface,
  LiquiditySurfaceSchema,
  type WalletBalance,
  WalletBalanceSchema,
  type WalletListItem,
  WalletListResponseSchema,
  normalizeChain,
  type ChainInput
} from '../types';
import { normalizeAxiosError, parseWithSchema, wrapSuccess } from '../utils';

export class WalletsModule extends BaseModule {
  async getBalance(chain: ChainInput = 'arc-testnet'): Promise<ApiResponse<WalletBalance>> {
    try {
      const response = await this.http.get('/wallet/balance', {
        params: { chain: normalizeChain(chain) },
        headers: await this.authHeaders()
      });

      return wrapSuccess(parseWithSchema(WalletBalanceSchema, response.data));
    } catch (error) {
      normalizeAxiosError(error, 'Failed to fetch wallet balance');
    }
  }

  async list(options?: { includeBalance?: boolean }): Promise<ApiResponse<WalletListItem[]>> {
    try {
      const response = await this.http.get('/wallet/list', {
        params: options?.includeBalance ? { includeBalance: true } : undefined,
        headers: await this.authHeaders()
      });

      return wrapSuccess(parseWithSchema(WalletListResponseSchema, response.data).items);
    } catch (error) {
      normalizeAxiosError(error, 'Failed to list wallets');
    }
  }

  async getSupportedChains(): Promise<ApiResponse<Chain[]>> {
    try {
      const response = await this.http.get('/wallet/chains', {
        headers: await this.authHeaders()
      });

      const chains = (response.data?.chains || []) as Chain[];
      return wrapSuccess(chains);
    } catch (error) {
      normalizeAxiosError(error, 'Failed to load supported chains');
    }
  }

  async getLiquidity(): Promise<ApiResponse<LiquiditySurface>> {
    try {
      const response = await this.http.get('/wallet/liquidity', {
        headers: await this.authHeaders()
      });

      return wrapSuccess(parseWithSchema(LiquiditySurfaceSchema, response.data));
    } catch (error) {
      normalizeAxiosError(error, 'Failed to load liquidity surface');
    }
  }

  async getMetadata() {
    try {
      const response = await this.http.get('/wallet/metadata', {
        headers: await this.authHeaders()
      });

      return wrapSuccess(parseWithSchema(ChainMetadataSchema, response.data));
    } catch (error) {
      normalizeAxiosError(error, 'Failed to load chain metadata');
    }
  }
}
