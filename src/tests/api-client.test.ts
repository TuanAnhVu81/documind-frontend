import { afterEach, describe, expect, it } from 'vitest';
import { parseJsonResponse } from '@/api/client';
import { errorFromResponse } from '@/api/errors';
import { queryClient, queryKeys, clearSessionCache } from '@/app/query-client';

afterEach(() => queryClient.clear());

describe('API client', () => {
  it('ánh xạ ProblemDetail và giữ requestId, Retry-After, không lộ detail', async () => {
    const response = new Response(
      JSON.stringify({
        code: 'GENERATION_IN_PROGRESS',
        requestId: 'req-1',
        detail: 'sensitive',
        generationId: 'g1',
        assistantMessageId: 'm1',
      }),
      { status: 409, headers: { 'Retry-After': '1' } },
    );
    const error = await errorFromResponse(response);
    expect(error).toMatchObject({
      status: 409,
      code: 'GENERATION_IN_PROGRESS',
      requestId: 'req-1',
      retryAfter: '1',
      generationId: 'g1',
      assistantMessageId: 'm1',
    });
    expect(error.message).not.toContain('sensitive');
  });
  it.each([401, 404, 409, 413, 415, 429, 503])(
    'ánh xạ HTTP %s khi body không phải JSON',
    async (status) => {
      const error = await errorFromResponse(new Response('technical error', { status }));
      expect(error.status).toBe(status);
      expect(error.message).not.toContain('technical error');
    },
  );
  it.each([200, 204, 205])('từ chối JSON rỗng với HTTP %s', async (status) => {
    await expect(parseJsonResponse(new Response(null, { status }))).rejects.toMatchObject({
      status,
      code: 'INVALID_RESPONSE',
    });
  });
  it('đọc JSON hợp lệ', async () => {
    await expect(parseJsonResponse(new Response('{"id":"demo"}'))).resolves.toEqual({ id: 'demo' });
  });
  it('chia cache theo user và xóa khi kết thúc phiên', async () => {
    queryClient.setQueryData(queryKeys.usage('user-a'), { questionCount: 1 });
    expect(queryClient.getQueryData(queryKeys.usage('user-b'))).toBeUndefined();
    await clearSessionCache();
    expect(queryClient.getQueryData(queryKeys.usage('user-a'))).toBeUndefined();
  });
  it('không retry mutation', () => {
    expect(queryClient.getDefaultOptions().mutations?.retry).toBe(false);
  });
});
