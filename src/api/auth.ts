import { requestJson, requestVoid, type RequestOptions } from './client';
import type { Credentials, Csrf, Session, User } from './types';
const authPost = <T>(path: string, csrf: Csrf, json?: unknown, signal?: AbortSignal) =>
  requestJson<T>(`/auth/${path}`, {
    method: 'POST',
    headers: { [csrf.headerName]: csrf.token },
    json,
    signal,
  });
export const authApi = {
  csrf: (options?: RequestOptions) => requestJson<Csrf>('/auth/csrf', options),
  register: (credentials: Credentials, csrf: Csrf, signal?: AbortSignal) =>
    authPost<User>('register', csrf, credentials, signal),
  login: (credentials: Credentials, csrf: Csrf, signal?: AbortSignal) =>
    authPost<Session>('login', csrf, credentials, signal),
  refresh: (csrf: Csrf, signal?: AbortSignal) =>
    authPost<Session>('refresh', csrf, undefined, signal),
  logout: (csrf: Csrf, signal?: AbortSignal) =>
    requestVoid('/auth/logout', {
      method: 'POST',
      headers: { [csrf.headerName]: csrf.token },
      signal,
    }),
};
