import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.DOCUMIND_E2E_BASE_URL;
const nonce = process.env.DOCUMIND_E2E_HARNESS_NONCE;
const db = process.env.DOCUMIND_E2E_DB_NAME;
test.skip(!base || !nonce || !db, 'Chạy bằng harness E2E cách ly.');
test.use({ channel: 'chrome' });
test.setTimeout(90_000);

test('tạo, đọc lịch sử phân trang, điều hướng và xóa hội thoại với BE thật', async ({ page }) => {
  if (!base || !nonce || !db || !/^documind_fe_e2e_[0-9a-f]{16}$/.test(db))
    throw new Error('Thiếu database test cách ly');
  const marker = await page.request.get(`${base}/__phase03_harness`);
  expect(await marker.text()).toBe(nonce);
  await page.goto(`${base}/register`);
  const email = `phase06-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('link', { name: 'Hội thoại', exact: true }).click();
  await expect(
    page.getByText('Chưa có hội thoại nào. Tạo một hội thoại để bắt đầu.'),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Tạo hội thoại', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/chat\/[0-9a-f-]+$/);
  const first = page.url().split('/').pop()!;
  expect(first).toMatch(/^[0-9a-f-]{36}$/);
  await expect(page.getByRole('button', { name: 'Gửi câu hỏi' })).toBeDisabled();
  await page.getByLabel('Câu hỏi của bạn').fill('Bản nháp hội thoại thứ nhất');
  execFileSync('docker', [
    'exec',
    'local_postgres',
    'psql',
    '-U',
    'postgres',
    '-d',
    db,
    '-v',
    'ON_ERROR_STOP=1',
    '-c',
    `INSERT INTO messages (id, conversation_id, ordinal, role, content, status) SELECT gen_random_uuid(), '${first}'::uuid, n, 'USER', 'Tin nhắn thử nghiệm ' || n, 'COMPLETE' FROM generate_series(1,55) n`,
  ]);
  await page.reload();
  await expect(page.getByText('Tin nhắn thử nghiệm 55', { exact: true })).toBeVisible();
  await expect(page.getByText('Tin nhắn thử nghiệm 1', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Tải tin nhắn cũ hơn' }).click();
  await expect(page.getByText('Tin nhắn thử nghiệm 1', { exact: true })).toBeAttached();
  await expect(page.locator('.chat-message')).toHaveCount(55);
  await page.getByLabel('Câu hỏi của bạn').fill('Bản nháp riêng của hội thoại thứ nhất');
  await page.route(
    '**/api/v1/conversations',
    async (route) => {
      if (route.request().method() === 'POST') {
        await route.fetch();
        await route.abort();
      } else await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Tạo hội thoại mới' }).click();
  await expect(
    page.getByText(
      'Chưa xác định được hội thoại đã tạo hay chưa. Hãy kiểm tra danh sách trước khi tạo lại.',
    ),
  ).toBeVisible();
  const sidebar = page.getByRole('navigation', { name: 'Danh sách hội thoại' });
  await expect(sidebar.locator('a')).toHaveCount(2);
  const newLink = sidebar.locator(`a:not([href="/app/chat/${first}"])`);
  await newLink.click();
  await expect(page).not.toHaveURL(new RegExp(first));
  const second = page.url();
  await expect(page.getByLabel('Câu hỏi của bạn')).toHaveValue('');
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(first));
  await expect(page.getByLabel('Câu hỏi của bạn')).toHaveValue(
    'Bản nháp riêng của hội thoại thứ nhất',
  );
  await expect(page.getByText('Tin nhắn thử nghiệm 55', { exact: true })).toBeAttached();
  await page.goForward();
  await expect(page).toHaveURL(second);
  await page.reload();
  await expect(page).toHaveURL(second);
  await expect(page.getByRole('heading', { name: 'Bắt đầu từ một câu hỏi' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Mở danh sách hội thoại' }).click();
  await expect(page.getByRole('dialog', { name: 'Hội thoại' })).toBeVisible();
  const secondId = new URL(second).pathname.split('/').pop()!;
  await page.route(
    `**/api/v1/conversations/${secondId}`,
    async (route) => {
      if (route.request().method() === 'DELETE') {
        await route.fetch();
        await route.abort();
      } else await route.continue();
    },
    { times: 1 },
  );
  await page
    .getByRole('dialog', { name: 'Hội thoại' })
    .locator('.chat-conversation')
    .filter({ has: page.locator(`a[href="/app/chat/${secondId}"]`) })
    .getByRole('button', { name: 'Xóa Hội thoại mới' })
    .click();
  await page
    .getByRole('dialog', { name: 'Xóa hội thoại?' })
    .getByRole('button', { name: 'Xóa hội thoại' })
    .click();
  await expect(page.getByRole('dialog', { name: 'Xóa hội thoại?' })).toBeHidden();
  await expect(page).toHaveURL(/\/app\/chat$/);
  await expect(
    page.getByRole('dialog', { name: 'Hội thoại' }).locator(`a[href="/app/chat/${secondId}"]`),
  ).toHaveCount(0);
  await page.keyboard.press('Escape');
  const accessibility = await new AxeBuilder({ page }).analyze();
  expect(accessibility.violations).toEqual([]);
});
