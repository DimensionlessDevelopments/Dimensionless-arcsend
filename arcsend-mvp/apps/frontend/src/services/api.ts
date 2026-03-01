import axios from 'axios';

export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4001';

export function createApi(token?: string) {
  return axios.create({
    baseURL: API_BASE,
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
}

export function getApiError(error: unknown, fallback: string) {
  if (axios.isAxiosError(error)) {
    const payload = error.response?.data as
      | { error?: string | Array<{ message?: string }> | Record<string, unknown> }
      | undefined;

    const rawError = payload?.error;
    if (typeof rawError === 'string' && rawError.trim()) {
      return rawError;
    }

    if (Array.isArray(rawError) && rawError.length) {
      const firstMessage = rawError
        .map((item) => (typeof item?.message === 'string' ? item.message : ''))
        .find((value) => value);

      if (firstMessage) {
        return firstMessage;
      }
    }

    if (rawError && typeof rawError === 'object') {
      try {
        return JSON.stringify(rawError);
      } catch {
      }
    }

    if (typeof error.message === 'string' && error.message.trim()) {
      return error.message;
    }
  }
  return fallback;
}
