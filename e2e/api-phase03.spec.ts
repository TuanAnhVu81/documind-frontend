import { expect, test } from '@playwright/test';

const baseUrl = process.env.DOCUMIND_E2E_BASE_URL;
const nonce = process.env.DOCUMIND_E2E_HARNESS_NONCE;
test.skip(!baseUrl || !nonce, 'Chạy qua npm run test:e2e:phase03 để tạo môi trường test riêng.');
test.use({ channel: 'chrome' });
test.beforeEach(async ({ page }) => {
  if (!baseUrl || !nonce || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl)) {
    throw new Error('Thiếu môi trường E2E được cách ly.');
  }
  const marker = await page.request.get(`${baseUrl}/__phase03_harness`);
  if (!marker.ok() || (await marker.text()) !== nonce) throw new Error('Sai Vite test.');
});

test('lỗi mất kết nối được xử lý an toàn', async ({ page, context }) => {
  await page.goto(`${baseUrl}/app`);
  await page.evaluate(() => import('/src/api/usage.ts'));
  await context.setOffline(true);
  const result = await page.evaluate(async () => {
    const { usageApi } = await import('/src/api/usage.ts');
    try {
      await usageApi.summary('invalid');
      return null;
    } catch (error) {
      return { name: (error as Error).name, message: (error as Error).message };
    }
  });
  await context.setOffline(false);
  expect(result?.name).toBe('ApiError');
  expect(result?.message).toContain('Không thể kết nối');
});

test('API client làm việc với BE thật và dữ liệu tổng hợp', async ({ page }) => {
  await page.goto(`${baseUrl}/app`);
  const result = await page.evaluate(async () => {
    const { authApi } = await import('/src/api/auth.ts');
    const { documentsApi } = await import('/src/api/documents.ts');
    const { conversationsApi } = await import('/src/api/conversations.ts');
    const { chatApi } = await import('/src/api/chat.ts');
    const { usageApi } = await import('/src/api/usage.ts');
    const { ApiError } = await import('/src/api/errors.ts');
    const codes: Record<string, number | undefined> = {};
    const expectError = async (name: string, action: () => Promise<unknown>) => {
      try {
        await action();
        throw new Error(`Expected ${name}`);
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        codes[name] = error.status;
      }
    };
    await expectError('unauthorized', () => documentsApi.list('invalid'));
    const csrf = await authApi.csrf();
    const credentials = {
      email: `phase03-${crypto.randomUUID()}@example.test`,
      password: `Demo-${crypto.randomUUID()}!`,
    };
    await authApi.register(credentials, csrf);
    await expectError('duplicate', () => authApi.register(credentials, csrf));
    const session = await authApi.login(credentials, csrf);
    const refreshed = await authApi.refresh(csrf);
    if (refreshed.user.id !== session.user.id) throw new Error('Refresh sai tài khoản');
    const token = refreshed.accessToken;
    const controller = new AbortController();
    controller.abort();
    let cancelled = false;
    try {
      await usageApi.summary(token, { signal: controller.signal });
    } catch (error) {
      cancelled = error instanceof DOMException && error.name === 'AbortError';
    }
    const initial = await documentsApi.list(token);
    const upload = await documentsApi.upload(
      token,
      new File(['Tài liệu demo tổng hợp.'], 'demo.txt', { type: 'text/plain' }),
    );
    const afterUpload = await documentsApi.list(token);
    const detail = await documentsApi.detail(token, upload.id);
    await expectError('notFound', () => documentsApi.detail(token, crypto.randomUUID()));
    await expectError('unsupported', () =>
      documentsApi.upload(
        token,
        new File(['demo'], 'demo.exe', { type: 'application/octet-stream' }),
      ),
    );
    const conversation = await conversationsApi.create(token, 'Hội thoại thử nghiệm');
    const conversations = await conversationsApi.list(token);
    const messages = await conversationsApi.messages(token, conversation.id);
    const key = crypto.randomUUID();
    const stream = await chatApi.stream(token, conversation.id, key, {
      content: 'Tài liệu nói gì?',
    });
    const reader = stream.getReader();
    const decoder = new TextDecoder();
    let streamText = '';
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      streamText += decoder.decode(chunk.value, { stream: true });
    }
    const replay = await chatApi.stream(token, conversation.id, key, {
      content: 'Tài liệu nói gì?',
    });
    const replayText = await new Response(replay).text();
    const history = await conversationsApi.messages(token, conversation.id);
    const usage = await usageApi.summary(token);
    await conversationsApi.delete(token, conversation.id);
    await documentsApi.delete(token, upload.id);
    await authApi.logout(csrf);
    let retryAfter: string | undefined;
    for (let attempt = 0; attempt < 12; attempt++) {
      try {
        await authApi.login({ ...credentials, password: 'incorrect-demo-password' }, csrf);
        throw new Error('Đăng nhập sai không được thành công');
      } catch (error) {
        if (!(error instanceof ApiError)) throw error;
        if (error.status === 429) {
          codes.rateLimited = error.status;
          retryAfter = error.retryAfter;
          break;
        }
        if (error.status !== 401) throw error;
      }
    }
    await expectError('tooLarge', () =>
      documentsApi.upload(
        token,
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'large.txt', { type: 'text/plain' }),
      ),
    );
    return {
      codes,
      initial: initial.totalElements,
      count: afterUpload.totalElements,
      documentStatus: detail.status,
      conversationFound: conversations.items.some((item) => item.id === conversation.id),
      messageCount: messages.items.length,
      streamHasDone: streamText.includes('event:done') || streamText.includes('event: done'),
      replayed: replayText.includes('"replayed":true'),
      outcome: history.items.find((item) => item.role === 'ASSISTANT')?.outcome,
      sources: history.items.find((item) => item.role === 'ASSISTANT')?.sources,
      questionCount: usage.questionCount,
      retryAfter,
      cancelled,
    };
  });
  expect(result.initial).toBe(0);
  expect(result.count).toBe(1);
  expect(result.documentStatus).toBe('PENDING');
  expect(result.conversationFound).toBe(true);
  expect(result.messageCount).toBe(0);
  expect(result.questionCount).toBe(1);
  expect(result.streamHasDone).toBe(true);
  expect(result.replayed).toBe(true);
  expect(result.outcome).toBe('NO_EVIDENCE');
  expect(result.sources).toEqual([]);
  expect(result.retryAfter).toBeTruthy();
  expect(result.cancelled).toBe(true);
  expect(result.codes).toEqual({
    unauthorized: 401,
    duplicate: 409,
    notFound: 404,
    unsupported: 415,
    rateLimited: 429,
    tooLarge: 413,
  });
});
