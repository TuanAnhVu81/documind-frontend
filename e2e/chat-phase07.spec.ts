import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';

const base = process.env.DOCUMIND_E2E_BASE_URL;
const nonce = process.env.DOCUMIND_E2E_HARNESS_NONCE;
const db = process.env.DOCUMIND_E2E_DB_NAME;
test.skip(!base || !nonce || !db, 'Chạy bằng harness E2E cách ly.');
test.use({ channel: 'chrome' });
test.setTimeout(90_000);

test('SSE NO_EVIDENCE và replay dùng BE thật, không gọi Gemini', async ({ page }) => {
  if (!base || !nonce || !db || !/^documind_fe_e2e_[0-9a-f]{16}$/.test(db))
    throw new Error('Thiếu database test cách ly');
  const marker = await page.request.get(`${base}/__phase03_harness`);
  expect(await marker.text()).toBe(nonce);
  await page.goto(`${base}/register`);
  const email = `phase07-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('link', { name: 'Hội thoại', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo hội thoại', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/chat\/[0-9a-f-]+$/);
  const id = page.url().split('/').pop()!;
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  const question = 'Tài liệu nói gì về điều kiện hoàn tiền?';
  const requestPromise = page.waitForRequest(
    (request) =>
      request.method() === 'POST' && request.url().endsWith(`/conversations/${id}/messages`),
  );
  await page.getByLabel('Câu hỏi của bạn').fill(question);
  await page.getByLabel('Câu hỏi của bạn').press('Control+Enter');
  const request = await requestPromise;
  const key = request.headers()['idempotency-key'];
  expect(key).toMatch(/^[0-9a-f-]{36}$/);
  expect(request.postDataJSON()).toEqual({ content: question });
  await expect(
    page.getByText('Tôi không tìm thấy đủ bằng chứng trong các tài liệu hiện có.'),
  ).toBeVisible();
  await expect(page.locator('.chat-message')).toHaveCount(2);
  await expect(page.getByText(/Sử dụng:/)).toBeVisible();
  const replay = await page.evaluate(
    async ({ id, key, question }) => {
      const { authManager } = await import('/src/features/auth/auth-manager.ts');
      const token = await authManager.accessToken();
      const response = await fetch(`/api/v1/conversations/${id}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
          'Idempotency-Key': key,
        },
        body: JSON.stringify({ content: question }),
      });
      return { status: response.status, body: await response.text() };
    },
    { id, key, question },
  );
  expect(replay.status).toBe(200);
  expect(replay.body).toContain('"replayed":true');
  expect(replay.body).toContain('event:done');
  const count = execFileSync(
    'docker',
    [
      'exec',
      'local_postgres',
      'psql',
      '-U',
      'postgres',
      '-d',
      db,
      '-At',
      '-c',
      `SELECT count(*) FROM messages WHERE conversation_id='${id}'::uuid`,
    ],
    { encoding: 'utf8' },
  ).trim();
  expect(count).toBe('2');
  await page.reload();
  await expect(page.locator('.chat-message')).toHaveCount(2);
});

test('mất phản hồi rồi reload vẫn replay với cùng idempotency key', async ({ page }) => {
  if (!base || !nonce || !db || !/^documind_fe_e2e_[0-9a-f]{16}$/.test(db))
    throw new Error('Thiếu database test cách ly');
  const marker = await page.request.get(`${base}/__phase03_harness`);
  expect(await marker.text()).toBe(nonce);
  await page.goto(`${base}/register`);
  const email = `phase07-recovery-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('link', { name: 'Hội thoại', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo hội thoại', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/chat\/[0-9a-f-]+$/);
  const id = page.url().split('/').pop()!;
  expect(id).toMatch(/^[0-9a-f-]{36}$/);
  let originalKey = '';
  await page.route(`**/api/v1/conversations/${id}/messages`, async (route) => {
    if (route.request().method() !== 'POST') {
      await route.continue();
      return;
    }
    originalKey = route.request().headers()['idempotency-key'];
    await route.fetch(); // BE thực sự xử lý request; chỉ làm mất response trên đường về trình duyệt.
    await route.abort();
  });
  await page.getByLabel('Câu hỏi của bạn').fill('Thông tin nào có trong tài liệu?');
  await page.getByRole('button', { name: 'Gửi câu hỏi' }).click();
  await expect(page.getByRole('button', { name: 'Kiểm tra lại yêu cầu' })).toBeVisible();
  await page.unroute(`**/api/v1/conversations/${id}/messages`);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Kiểm tra lại yêu cầu' })).toBeVisible();
  const replayRequest = page.waitForRequest(
    (request) =>
      request.method() === 'POST' && request.url().endsWith(`/conversations/${id}/messages`),
  );
  await page.getByRole('button', { name: 'Kiểm tra lại yêu cầu' }).click();
  expect((await replayRequest).headers()['idempotency-key']).toBe(originalKey);
  await expect(
    page.getByText('Tôi không tìm thấy đủ bằng chứng trong các tài liệu hiện có.'),
  ).toBeVisible();
  await expect(page.locator('.chat-message')).toHaveCount(2);
  const count = execFileSync(
    'docker',
    [
      'exec',
      'local_postgres',
      'psql',
      '-U',
      'postgres',
      '-d',
      db,
      '-At',
      '-c',
      `SELECT count(*) FROM messages WHERE conversation_id='${id}'::uuid`,
    ],
    { encoding: 'utf8' },
  ).trim();
  expect(count).toBe('2');
});
