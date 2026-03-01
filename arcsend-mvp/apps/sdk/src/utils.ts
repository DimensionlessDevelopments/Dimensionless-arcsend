import { AxiosError } from 'axios';
import type { ZodType } from 'zod';
import type { ApiResponse } from './types';

export class ArcSendError extends Error {
  public status?: number;
  public details?: unknown;

  constructor(message: string, status?: number, details?: unknown) {
    super(message);
    this.name = 'ArcSendError';
    this.status = status;
    this.details = details;
  }
}

export function parseWithSchema<T>(schema: ZodType<T>, payload: unknown): T {
  return schema.parse(payload);
}

export function wrapSuccess<T>(data: T): ApiResponse<T> {
  return { success: true, data };
}

export function normalizeAxiosError(error: unknown, fallback: string): never {
  if (error && typeof error === 'object' && (error as Error).name === 'ArcSendError') {
    throw error;
  }

  if ((error as AxiosError)?.isAxiosError) {
    const axiosError = error as AxiosError<{ error?: string }>;
    throw new ArcSendError(
      axiosError.response?.data?.error || fallback,
      axiosError.response?.status,
      axiosError.response?.data
    );
  }

  if (error instanceof Error) {
    throw new ArcSendError(error.message);
  }

  throw new ArcSendError(fallback);
}
