import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const baseUrl = process.env.DOCUMIND_E2E_BASE_URL;
const nonce = process.env.DOCUMIND_E2E_HARNESS_NONCE;
test.skip(!baseUrl || !nonce, 'Chạy bằng harness E2E cách ly.');
test.use({ channel: 'chrome' });
test.setTimeout(60_000);
test.beforeEach(async ({ page }) => {
  if (!baseUrl || !nonce || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl))
    throw new Error('Thiếu môi trường test.');
  const marker = await page.request.get(`${baseUrl}/__phase03_harness`);
  if (!marker.ok() || (await marker.text()) !== nonce) throw new Error('Sai Vite test.');
});

test('tải tài liệu thật, kiểm tra lỗi và xóa đến 404', async ({ page }) => {
  await page.goto(`${baseUrl}/register`);
  const email = `phase05-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('link', { name: 'Tài liệu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thư viện của bạn đang trống' })).toBeVisible();
  const input = page.getByLabel('Chọn tài liệu PDF, DOCX hoặc TXT');
  await input.setInputFiles({
    name: 'quá-lớn.txt',
    mimeType: 'text/plain',
    buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
  });
  await expect(page.getByText('Tệp vượt quá giới hạn 10 MiB.', { exact: true })).toBeVisible();
  await input.setInputFiles({
    name: 'không-hợp-lệ.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('không phải PDF'),
  });
  await expect(
    page
      .getByRole('region', { name: 'Kết quả tải tệp' })
      .getByText('Định dạng tệp không được hỗ trợ.'),
  ).toBeVisible();
  await input.setInputFiles([
    {
      name: 'Tài liệu thử nghiệm.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Nội dung thử nghiệm tổng hợp bằng tiếng Việt.'),
    },
    {
      name: 'Tài liệu thứ hai.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Nội dung tổng hợp thứ hai.'),
    },
  ]);
  await expect(page.getByText('Đã tiếp nhận · Chờ xử lý')).toHaveCount(2);
  const secondCard = page
    .locator('article.document-card')
    .filter({ hasText: 'Tài liệu thứ hai.txt' });
  await expect(secondCard).toBeVisible();
  await page.context().setOffline(true);
  await secondCard.getByRole('button', { name: /Chi tiết/ }).click();
  const offlineDialog = page.getByRole('dialog', { name: 'Chi tiết tài liệu' });
  await expect(offlineDialog.getByText('Chưa tải được chi tiết')).toBeVisible();
  await page.context().setOffline(false);
  await offlineDialog.getByRole('button', { name: 'Thử lại' }).click();
  await expect(offlineDialog.getByText('Tài liệu thứ hai.txt')).toBeVisible();
  await offlineDialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  const tooLargeStatus = await page.evaluate(async () => {
    const { authManager } = await import('/src/features/auth/auth-manager.ts');
    const { documentsApi } = await import('/src/api/documents.ts');
    const { ApiError } = await import('/src/api/errors.ts');
    const token = await authManager.accessToken();
    if (!token) throw new Error('Thiếu phiên test');
    try {
      await documentsApi.upload(
        token,
        new File([new Uint8Array(10 * 1024 * 1024 + 1)], 'oversized.txt', { type: 'text/plain' }),
      );
      return 200;
    } catch (error) {
      if (!(error instanceof ApiError)) throw error;
      return error.status ?? 0;
    }
  });
  expect(tooLargeStatus).toBe(413);
  const card = page.locator('article.document-card').filter({ hasText: 'Tài liệu thử nghiệm.txt' });
  await expect(card).toBeVisible();
  await expect(card.getByText('Đang chờ')).toBeVisible();
  await page.getByLabel('Tìm theo tên trong trang hiện tại').fill('không có');
  await expect(page.getByText('Không tìm thấy trong trang này')).toBeVisible();
  await page.getByLabel('Tìm theo tên trong trang hiện tại').clear();
  await card.getByRole('button', { name: /Chi tiết/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Chi tiết tài liệu' });
  await expect(dialog.getByText('Tài liệu thử nghiệm.txt')).toBeVisible();
  await expect(dialog.getByText('0 / 3')).toBeVisible();
  await expect(dialog.getByRole('link', { name: 'Mở hội thoại' })).toHaveAttribute('href', '/app/chat');
  await dialog.getByRole('button', { name: 'Xóa tài liệu' }).click();
  await expect(dialog.getByText(/Nội dung hội thoại cũ vẫn được giữ/)).toBeVisible();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' && response.url().includes('/api/v1/documents/'),
  );
  const goneResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      /\/api\/v1\/documents\/[^/?]+$/.test(response.url()) &&
      response.status() === 404,
    { timeout: 25_000 },
  );
  await dialog.getByRole('button', { name: 'Xác nhận xóa' }).click();
  const acceptedDelete = await deleteResponse;
  expect(acceptedDelete.status()).toBe(202);
  const documentId = new URL(acceptedDelete.url()).pathname.split('/').pop();
  if (!documentId) throw new Error('Thiếu ID tài liệu test');
  const deletingStatus = await page.evaluate(async (id) => {
    const { authManager } = await import('/src/features/auth/auth-manager.ts');
    const { documentsApi } = await import('/src/api/documents.ts');
    const token = await authManager.accessToken();
    if (!token) throw new Error('Thiếu phiên test');
    return (await documentsApi.detail(token, id)).status;
  }, documentId);
  expect(deletingStatus).toBe('DELETING');
  await expect(dialog.getByText(/Tài liệu đang được xóa/)).toBeVisible();
  expect((await goneResponse).status()).toBe(404);
  await expect(page.getByText('Đã xóa tài liệu', { exact: true })).toBeVisible({ timeout: 25_000 });
  await expect(card).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Tài liệu thứ hai.txt' })).toBeVisible();
});

test('giao diện thư viện responsive và truy cập được bằng axe', async ({ page }) => {
  await page.goto(`${baseUrl}/register`);
  const email = `phase05-a11y-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${baseUrl}/app/documents`);
    await expect(page.getByRole('heading', { name: /Thư viện tài liệu/ })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: innerWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);
    expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  }
});

async function signInLibrary(page: import('@playwright/test').Page) {
  await page.goto(`${baseUrl}/register`);
  const email = `phase05-extra-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('link', { name: 'Tài liệu', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Thư viện tài liệu/ })).toBeVisible();
}

test('mất phản hồi upload và DELETE vẫn đối soát với BE thật', async ({ page }) => {
  await signInLibrary(page);
  await page.route(
    '**/api/v1/documents',
    async (route) => {
      if (route.request().method() !== 'POST') {
        await route.continue();
        return;
      }
      const response = await route.fetch();
      expect(response.status()).toBe(202);
      await route.abort('failed');
    },
    { times: 1 },
  );
  await page.getByLabel('Chọn tài liệu PDF, DOCX hoặc TXT').setInputFiles({
    name: 'Mất phản hồi.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Tài liệu tổng hợp.'),
  });
  await expect(page.getByText(/Chưa xác định tệp đã được tiếp nhận/).first()).toBeVisible();
  await expect(
    page.locator('[aria-live="polite"]').filter({ hasText: 'Mất phản hồi.txt' }),
  ).toContainText('Chưa xác định');
  const card = page.locator('article.document-card').filter({ hasText: 'Mất phản hồi.txt' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /Chi tiết/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Chi tiết tài liệu' });
  await dialog.getByRole('button', { name: 'Xóa tài liệu' }).click();
  await page.route('**/api/v1/documents/*', async (route) => {
    if (route.request().method() !== 'DELETE') {
      await route.continue();
      return;
    }
    const response = await route.fetch();
    expect(response.status()).toBe(202);
    await route.abort('failed');
  });
  const missing = page.waitForResponse(
    (response) =>
      response.request().method() === 'GET' &&
      /\/api\/v1\/documents\/[^/?]+$/.test(response.url()) &&
      response.status() === 404,
    { timeout: 30_000 },
  );
  await dialog.getByRole('button', { name: 'Xác nhận xóa' }).click();
  await expect(
    dialog.getByText(/Chưa xác nhận được yêu cầu xóa|Tài liệu đang được xóa/).first(),
  ).toBeVisible();
  expect((await missing).status()).toBe(404);
  await expect(card).toHaveCount(0);
  await expect(
    page.getByText(/Đã xóa tài liệu|Tài liệu không còn trong thư viện/).first(),
  ).toBeVisible();
});

test('theo dõi xóa khi rời trang và quay lại', async ({ page }) => {
  await signInLibrary(page);
  await page.getByLabel('Chọn tài liệu PDF, DOCX hoặc TXT').setInputFiles({
    name: 'Theo dõi.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Dữ liệu tổng hợp.'),
  });
  const card = page.locator('article.document-card').filter({ hasText: 'Theo dõi.txt' });
  await expect(card).toBeVisible();
  await card.getByRole('button', { name: /Chi tiết/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Chi tiết tài liệu' });
  await dialog.getByRole('button', { name: 'Xóa tài liệu' }).click();
  const deleteResponse = page.waitForResponse(
    (response) =>
      response.request().method() === 'DELETE' && response.url().includes('/api/v1/documents/'),
  );
  await dialog.getByRole('button', { name: 'Xác nhận xóa' }).click();
  const id = new URL((await deleteResponse).url()).pathname.split('/').pop();
  if (!id) throw new Error('Thiếu ID tài liệu test');
  await expect(dialog.getByText(/Tài liệu đang được xóa/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('link', { name: 'Tổng quan', exact: true }).click();
  await page.waitForFunction(
    async (documentId) => {
      const { authManager } = await import('/src/features/auth/auth-manager.ts');
      const token = await authManager.accessToken();
      if (!token) return false;
      return (
        (
          await fetch(`/api/v1/documents/${documentId}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        ).status === 404
      );
    },
    id,
    { timeout: 30_000, polling: 1000 },
  );
  await page.reload();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  await page.getByRole('link', { name: 'Tài liệu', exact: true }).click();
  await expect(page.getByText('Đã xóa tài liệu', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole('heading', { name: 'Thư viện của bạn đang trống' })).toBeVisible();
});

test('đồng bộ thư viện hai tab khi thiếu BroadcastChannel', async ({ page, context }) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: undefined });
  });
  await signInLibrary(page);
  const second = await context.newPage();
  await second.goto(`${baseUrl}/app/documents`);
  await expect(second.getByRole('heading', { name: 'Thư viện của bạn đang trống' })).toBeVisible();
  await page.getByLabel('Chọn tài liệu PDF, DOCX hoặc TXT').setInputFiles({
    name: 'Hai tab.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('Dữ liệu tổng hợp.'),
  });
  const firstCard = page.locator('article.document-card').filter({ hasText: 'Hai tab.txt' });
  const secondCard = second.locator('article.document-card').filter({ hasText: 'Hai tab.txt' });
  await expect(firstCard).toBeVisible();
  await expect(secondCard).toBeVisible({ timeout: 3000 });
  await second.getByRole('link', { name: 'Tổng quan', exact: true }).click();
  const fixture = await second.evaluate(async () => {
    const { authManager } = await import('/src/features/auth/auth-manager.ts');
    const { queryClient } = await import('/src/app/query-client.ts');
    const { documentsApi } = await import('/src/api/documents.ts');
    const id = authManager.getSnapshot().user?.id;
    if (!id) throw new Error('Thiếu tài khoản test');
    const token = await authManager.accessToken();
    if (!token) throw new Error('Thiếu phiên test');
    const document = (await documentsApi.list(token)).items.find(
      (item) => item.filename === 'Hai tab.txt',
    );
    if (!document) throw new Error('Thiếu tài liệu test');
    queryClient.setQueryData(['user', id, 'conversations', 'cached-history', 'messages'], {
      pages: [
        {
          items: [
            {
              sources: [
                {
                  documentId: document.id,
                  filename: 'Hai tab.txt',
                  snippet: 'Dữ liệu tổng hợp.',
                  availability: 'AVAILABLE',
                },
              ],
            },
          ],
        },
      ],
      pageParams: [undefined],
    });
    return { id, documentId: document.id };
  });
  await firstCard.getByRole('button', { name: /Chi tiết/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Chi tiết tài liệu' });
  await dialog.getByRole('button', { name: 'Xóa tài liệu' }).click();
  await dialog.getByRole('button', { name: 'Xác nhận xóa' }).click();
  await expect
    .poll(() =>
      second.evaluate(async ({ id }) => {
        const { queryClient } = await import('/src/app/query-client.ts');
        const key = ['user', id, 'conversations', 'cached-history', 'messages'];
        const data = queryClient.getQueryData<{
          pages: {
            items: {
              sources: { filename: string | null; snippet: string | null; availability: string }[];
            }[];
          }[];
        }>(key);
        return {
          source: data?.pages[0].items[0].sources[0],
          invalidated: queryClient.getQueryState(key)?.isInvalidated,
        };
      }, fixture),
    )
    .toMatchObject({
      source: { filename: null, snippet: null, availability: 'DELETED' },
      invalidated: true,
    });
  await second.getByRole('link', { name: 'Tài liệu', exact: true }).click();
  await expect(secondCard.getByText('Đang xóa')).toBeVisible({ timeout: 4000 });
  await expect(secondCard).toHaveCount(0, { timeout: 30_000 });
});

test('đưa trang cuối về trang hợp lệ sau khi xóa tài liệu cuối', async ({ page }) => {
  await signInLibrary(page);
  await page.evaluate(async () => {
    const { authManager } = await import('/src/features/auth/auth-manager.ts');
    const { documentsApi } = await import('/src/api/documents.ts');
    const token = await authManager.accessToken();
    if (!token) throw new Error('Thiếu phiên test');
    for (let index = 0; index < 21; index++) {
      await documentsApi.upload(
        token,
        new File([`Tài liệu tổng hợp ${index}`], `Trang-${index}.txt`, { type: 'text/plain' }),
      );
    }
  });
  await page.reload();
  await expect(page.getByText('21 tài liệu trong thư viện')).toBeVisible();
  await page.getByRole('button', { name: 'Tiếp', exact: true }).click();
  await expect(page.getByText('Trang 2 / 2')).toBeVisible();
  const card = page.locator('article.document-card');
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: /Chi tiết/ }).click();
  const dialog = page.getByRole('dialog', { name: 'Chi tiết tài liệu' });
  await dialog.getByRole('button', { name: 'Xóa tài liệu' }).click();
  await dialog.getByRole('button', { name: 'Xác nhận xóa' }).click();
  await expect(page.getByText('Đã xóa tài liệu', { exact: true })).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText('20 tài liệu trong thư viện')).toBeVisible();
  await expect(page.locator('article.document-card')).toHaveCount(20);
  await expect(page.getByText('Thư viện của bạn đang trống')).toHaveCount(0);
  await expect(page.getByText('Trang 2 / 1')).toHaveCount(0);
});

test('tệp đã nhận vẫn hiện khi rời trang lúc tệp sau đang tải', async ({ page }) => {
  await signInLibrary(page);
  let uploadCount = 0;
  let release: () => void = () => {};
  let reached: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const secondReached = new Promise<void>((resolve) => {
    reached = resolve;
  });
  await page.route('**/api/v1/documents', async (route) => {
    if (route.request().method() === 'POST') {
      uploadCount++;
      if (uploadCount === 2) {
        reached();
        await gate;
      }
    }
    try {
      await route.continue();
    } catch {
      /* request aborted by navigation */
    }
  });
  await page.getByLabel('Chọn tài liệu PDF, DOCX hoặc TXT').setInputFiles([
    {
      name: 'Đã nhận.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Tài liệu tổng hợp thứ nhất.'),
    },
    {
      name: 'Chưa xong.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Tài liệu tổng hợp thứ hai.'),
    },
  ]);
  await secondReached;
  await page.getByRole('link', { name: 'Tổng quan', exact: true }).click();
  release();
  await page.getByRole('link', { name: 'Tài liệu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Đã nhận.txt' })).toBeVisible();
});
