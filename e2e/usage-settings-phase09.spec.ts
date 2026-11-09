import { execFileSync } from 'node:child_process';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.DOCUMIND_E2E_BASE_URL;
const nonce = process.env.DOCUMIND_E2E_HARNESS_NONCE;
const db = process.env.DOCUMIND_E2E_DB_NAME;
test.skip(!base || !nonce || !db, 'Chạy bằng harness E2E cách ly.');
test.use({ channel: 'chrome' });
test.setTimeout(90_000);

test('usage và cài đặt dùng BE thật, số liệu demo cách ly và không gọi AI', async ({ page }) => {
  if (!base || !nonce || !db || !/^documind_fe_e2e_[0-9a-f]{16}$/.test(db))
    throw new Error('Thiếu môi trường test cách ly');
  expect(await (await page.request.get(`${base}/__phase03_harness`)).text()).toBe(nonce);
  await page.goto(`${base}/register`);
  const email = `phase09-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('link', { name: 'Thống kê', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thống kê sử dụng' })).toBeVisible();
  await expect(page.getByText('Chưa có hoạt động được ghi nhận')).toBeVisible();
  await expect(
    page.locator('.usage-card').filter({ hasText: 'Lượt hỏi' }).locator('strong'),
  ).toHaveText('0');
  const userId = await page.evaluate(async () => {
    const { authManager } = await import('/src/features/auth/auth-manager.ts');
    return authManager.getSnapshot().user?.id;
  });
  expect(userId).toMatch(/^[0-9a-f-]{36}$/);
  const sql = `INSERT INTO question_events(generation_id,user_id,created_at) VALUES (gen_random_uuid(),'${userId}'::uuid,now());
  INSERT INTO usage_logs(id,user_id,operation,provider,model,prompt_tokens,completion_tokens,embedding_tokens,estimated_cost_usd,estimated,created_at) VALUES
  (gen_random_uuid(),'${userId}'::uuid,'CHAT_ANSWER','demo','demo',150,20,NULL,0.00001,false,now()),
  (gen_random_uuid(),'${userId}'::uuid,'QUERY_EMBEDDING','demo','demo',NULL,NULL,200,NULL,true,now())`;
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
    sql,
  ]);
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect(
    page.locator('.usage-card').filter({ hasText: 'Lượt hỏi' }).locator('strong'),
  ).toHaveText('1');
  await expect(
    page.locator('.usage-card').filter({ hasText: 'Token đầu vào' }).locator('strong'),
  ).toHaveText('150');
  await expect(
    page.locator('.usage-card').filter({ hasText: 'Token đầu ra' }).locator('strong'),
  ).toHaveText('20');
  await expect(
    page.locator('.usage-card').filter({ hasText: 'Token embedding' }).locator('strong'),
  ).toHaveText('200');
  await expect(page.getByText('Có số liệu ước tính')).toBeVisible();
  await expect(page.locator('.usage-cost strong')).toHaveText('Chưa có số liệu');
  await page.context().setOffline(true);
  await page.getByRole('button', { name: 'Làm mới' }).click();
  await expect(page.getByRole('heading', { name: 'Chưa tải được thống kê' })).toBeVisible();
  await page.context().setOffline(false);
  await page.getByRole('button', { name: 'Thử lại' }).click();
  await expect(
    page.locator('.usage-card').filter({ hasText: 'Lượt hỏi' }).locator('strong'),
  ).toHaveText('1');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: 'Mở điều hướng' }).click();
  await page
    .getByRole('dialog', { name: 'Điều hướng' })
    .getByRole('link', { name: 'Cài đặt' })
    .click();
  await expect(page.getByRole('heading', { name: 'Cài đặt' })).toBeVisible();
  await expect(page.locator('.settings-profile').getByText(email)).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await page.getByLabel('Theo hệ thống').check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByText('Đang bật')).toBeVisible();
  await page.getByLabel('Sáng', { exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.getByLabel('Sáng', { exact: true })).toBeChecked();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.getByRole('button', { name: 'Đăng xuất', exact: true }).click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText('Bạn đã đăng xuất.', { exact: true })).toBeVisible({ timeout: 15000 });
  await page.goto(`${base}/register`);
  const otherEmail = `phase09-other-${crypto.randomUUID()}@example.test`;
  await page.getByLabel('Email').fill(otherEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(otherEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('button', { name: 'Mở điều hướng' }).click();
  await page
    .getByRole('dialog', { name: 'Điều hướng' })
    .getByRole('link', { name: 'Thống kê' })
    .click();
  await expect(page.getByText('Chưa có hoạt động được ghi nhận')).toBeVisible();
  await expect(
    page.locator('.usage-card').filter({ hasText: 'Lượt hỏi' }).locator('strong'),
  ).toHaveText('0');
});
