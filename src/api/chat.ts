import { requestStream, type RequestOptions } from './client';
import type { ChatRequest } from './types';
export const chatApi = {
  stream: (
    token: string,
    conversationId: string,
    key: string,
    body: ChatRequest,
    options?: RequestOptions,
  ) =>
    requestStream(`/conversations/${encodeURIComponent(conversationId)}/messages`, {
      ...options,
      method: 'POST',
      token,
      json: body,
      headers: { 'Idempotency-Key': key },
    }),
};
