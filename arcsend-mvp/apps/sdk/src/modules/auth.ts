import { AxiosInstance } from 'axios';
import { z } from 'zod';
import { AuthResponseSchema, type AuthResponse } from '../types';
import { normalizeAxiosError, parseWithSchema, wrapSuccess } from '../utils';

const WalletChallengeSchema = z.object({
  address: z.string(),
  message: z.string(),
  expiresAt: z.number()
});

export class AuthModule {
  constructor(private http: AxiosInstance) {}

  async login(email: string, password: string) {
    try {
      const response = await this.http.post('/auth/login', { email, password });
      return wrapSuccess(parseWithSchema(AuthResponseSchema, response.data));
    } catch (error) {
      normalizeAxiosError(error, 'Login failed');
    }
  }

  async signup(email: string, password: string) {
    try {
      const response = await this.http.post('/auth/signup', { email, password });
      return wrapSuccess(parseWithSchema(AuthResponseSchema, response.data));
    } catch (error) {
      normalizeAxiosError(error, 'Signup failed');
    }
  }

  async walletChallenge(address: string) {
    try {
      const response = await this.http.post('/auth/wallet/challenge', { address });
      return wrapSuccess(parseWithSchema(WalletChallengeSchema, response.data));
    } catch (error) {
      normalizeAxiosError(error, 'Wallet challenge failed');
    }
  }

  async walletVerify(address: string, message: string, signature: string) {
    try {
      const response = await this.http.post('/auth/wallet/verify', { address, message, signature });
      return wrapSuccess(parseWithSchema(AuthResponseSchema, response.data));
    } catch (error) {
      normalizeAxiosError(error, 'Wallet verification failed');
    }
  }

  async loginAndSetToken(client: { setToken: (token: string) => void }, email: string, password: string) {
    const result = (await this.login(email, password)) as { success: true; data: AuthResponse };
    client.setToken(result.data.token);
    return result;
  }
}
