import { ApiError, errorFromResponse } from './errors';

export type RequestOptions = { signal?: AbortSignal; timeoutMs?: number; token?: string };
type Options = RequestOptions & {
  method?: 'GET' | 'POST' | 'DELETE';
  json?: unknown;
  form?: FormData;
  headers?: HeadersInit;
};

async function request<T>(
  path: string,
  options: Options = {},
  read: (response: Response) => Promise<T>,
): Promise<T> {
  const {
    signal,
    timeoutMs = 75_000,
    token,
    method = 'GET',
    json,
    form,
    headers: inputHeaders,
  } = options;
  const headers = new Headers(inputHeaders);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (json !== undefined) headers.set('Content-Type', 'application/json');
  const timeout = new AbortController();
  const timer = setTimeout(() => timeout.abort(), timeoutMs);
  const combined = signal ? AbortSignal.any([signal, timeout.signal]) : timeout.signal;
  try {
    const response = await fetch(`/api/v1${path}`, {
      method,
      headers,
      body: form ?? (json === undefined ? undefined : JSON.stringify(json)),
      credentials: 'same-origin',
      cache: 'no-store',
      signal: combined,
    });
    if (!response.ok) throw await errorFromResponse(response);
    return await read(response);
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Yêu cầu đã được hủy.', 'AbortError');
    if (timeout.signal.aborted)
      throw new ApiError('Kết nối mất quá nhiều thời gian. Vui lòng thử lại.', { code: 'TIMEOUT' });
    if (error instanceof ApiError) throw error;
    throw new ApiError('Không thể kết nối đến máy chủ. Vui lòng kiểm tra kết nối.', {
      code: 'NETWORK_ERROR',
    });
  } finally {
    clearTimeout(timer);
  }
}
export async function parseJsonResponse<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError('Phản hồi của máy chủ không hợp lệ.', {
      status: response.status,
      code: 'INVALID_RESPONSE',
    });
  }
}
export async function requestJson<T>(path: string, options?: Options): Promise<T> {
  return request(path, options, parseJsonResponse<T>);
}
export async function requestVoid(path: string, options?: Options): Promise<void> {
  await request(path, options, async () => undefined);
}
export async function requestStream(
  path: string,
  options: Options,
): Promise<ReadableStream<Uint8Array>> {
  const headers = new Headers(options.headers);
  headers.set('Accept', 'text/event-stream');
  return request(path, { ...options, headers }, async (response) => {
    if (
      !response.headers.get('Content-Type')?.toLowerCase().startsWith('text/event-stream') ||
      !response.body
    )
      throw new ApiError('Phản hồi của máy chủ không hợp lệ.', {
        status: response.status,
        code: 'INVALID_RESPONSE',
      });
    return response.body;
  });
}
export function query(params: Record<string, number | undefined>): string {
  const values = new URLSearchParams();
  for (const [key, value] of Object.entries(params))
    if (value !== undefined) values.set(key, String(value));
  const result = values.toString();
  return result ? `?${result}` : '';
}
