import { query, requestJson, requestVoid, type RequestOptions } from './client';
import type { Document, Page, PageParams, UploadResult } from './types';
export const documentsApi = {
  list: (token: string, params: PageParams = {}, options?: RequestOptions) =>
    requestJson<Page<Document>>(`/documents${query(params)}`, { ...options, token }),
  detail: (token: string, id: string, options?: RequestOptions) =>
    requestJson<Document>(`/documents/${encodeURIComponent(id)}`, { ...options, token }),
  upload: (token: string, file: File, options?: RequestOptions) => {
    const form = new FormData();
    form.append('file', file);
    return requestJson<UploadResult>('/documents', { ...options, method: 'POST', token, form });
  },
  delete: (token: string, id: string, options?: RequestOptions) =>
    requestVoid(`/documents/${encodeURIComponent(id)}`, { ...options, method: 'DELETE', token }),
};
