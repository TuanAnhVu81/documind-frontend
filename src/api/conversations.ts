import { query, requestJson, requestVoid, type RequestOptions } from './client';
import type { Conversation, MessagePage, Page, PageParams } from './types';
export const conversationsApi = {
  create: (token: string, title?: string, options?: RequestOptions) =>
    requestJson<Conversation>('/conversations', {
      ...options,
      token,
      method: 'POST',
      json: title === undefined ? {} : { title },
    }),
  list: (token: string, params: PageParams = {}, options?: RequestOptions) =>
    requestJson<Page<Conversation>>(`/conversations${query(params)}`, { ...options, token }),
  messages: (
    token: string,
    id: string,
    params: { beforeOrdinal?: number; limit?: number } = {},
    options?: RequestOptions,
  ) =>
    requestJson<MessagePage>(`/conversations/${encodeURIComponent(id)}/messages${query(params)}`, {
      ...options,
      token,
    }),
  delete: (token: string, id: string, options?: RequestOptions) =>
    requestVoid(`/conversations/${encodeURIComponent(id)}`, {
      ...options,
      method: 'DELETE',
      token,
    }),
};
