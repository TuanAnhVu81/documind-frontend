import { requestJson, type RequestOptions } from './client';
import type { Usage } from './types';
export const usageApi = {
  summary: (token: string, options?: RequestOptions) =>
    requestJson<Usage>('/usage', { ...options, token }),
};
