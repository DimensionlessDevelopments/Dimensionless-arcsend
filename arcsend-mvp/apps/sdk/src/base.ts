import type { AxiosInstance } from 'axios';
import type { ArcSendConfig } from './client';

export class BaseModule {
  constructor(protected http: AxiosInstance, protected getToken?: ArcSendConfig['getToken']) {}

  protected async authHeaders() {
    const staticToken = this.http.defaults.headers.common?.Authorization as string | undefined;
    const dynamic = this.getToken ? await this.getToken() : undefined;
    const token = dynamic || (staticToken ? staticToken.replace(/^Bearer\\s+/i, '') : undefined);

    if (!token) {
      return {};
    }

    return { Authorization: `Bearer ${token}` };
  }
}
