import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const base = process.env.DOCUMIND_E2E_BASE_URL;
const nonce = process.env.DOCUMIND_E2E_HARNESS_NONCE;
const db = process.env.DOCUMIND_E2E_DB_NAME;
test.skip(!base || !nonce || !db, 'Chạy bằng harness E2E cách ly.');
test.use({ channel: 'chrome' });
test.setTimeout(90_000);

test('đọc nguồn từ BE thật theo message, desktop/mobile và xóa tài liệu', async ({ page }) => {
  if (!base || !nonce || !db || !/^documind_fe_e2e_[0-9a-f]{16}$/.test(db))
    throw new Error('Thiếu môi trường test cách ly');
  expect(await (await page.request.get(`${base}/__phase03_harness`)).text()).toBe(nonce);
  await page.goto(`${base}/register`);
  const email = `phase08-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await page.getByRole('link', { name: 'Hội thoại', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo hội thoại', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/chat\/[0-9a-f-]+$/);
  const conversation = page.url().split('/').pop()!;
  expect(conversation).toMatch(/^[0-9a-f-]{36}$/);
  const pdf = readFileSync(resolve('../documind-backend/eval/fixtures/handbook-08.pdf')).toString(
    'base64',
  );
  const ids = await page.evaluate(async (pdfBase64) => {
    const { authManager } = await import('/src/features/auth/auth-manager.ts');
    const { documentsApi } = await import('/src/api/documents.ts');
    const token = await authManager.accessToken();
    if (!token) throw new Error('Không có phiên demo');
    const bytes = Uint8Array.from(atob(pdfBase64), (ch) => ch.charCodeAt(0));
    const first = await documentsApi.upload(
      token,
      new File([bytes], 'Nguon-thu-nhat.pdf', { type: 'application/pdf' }),
    );
    const second = await documentsApi.upload(
      token,
      new File(['Đoạn thử nghiệm độc lập.'], 'Nguon-thu-hai.txt', { type: 'text/plain' }),
    );
    return [first.id, second.id];
  }, pdf);
  for (const id of ids) expect(id).toMatch(/^[0-9a-f-]{36}$/);
  // Chèn fixture message vào database demo cách ly; không giả lập API và không gọi provider.
  const sql = `INSERT INTO messages(id,conversation_id,ordinal,role,content,status,outcome,sources) VALUES
    (gen_random_uuid(),'${conversation}'::uuid,1,'ASSISTANT','Thong tin mot [S1].','COMPLETE','ANSWER',jsonb_build_array(jsonb_build_object('sourceId','S1','documentId','${ids[0]}','filename','Nguon-thu-nhat.pdf','locationType','PAGE','pageNumber',3,'paragraphIndex',NULL,'startOffset',NULL,'endOffset',NULL,'snippet','Doan demo thu nhat ' || repeat('doan ',180),'availability','AVAILABLE'))),
    (gen_random_uuid(),'${conversation}'::uuid,2,'ASSISTANT','Thong tin hai [S1].','COMPLETE','ANSWER',jsonb_build_array(jsonb_build_object('sourceId','S1','documentId','${ids[1]}','filename','Nguon-thu-hai.txt','locationType','PARAGRAPH','pageNumber',NULL,'paragraphIndex',2,'startOffset',0,'endOffset',15,'snippet','Doan demo thu hai','availability','AVAILABLE')))`;
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
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  const firstChip = page.getByRole('button', { name: /Xem nguồn S1: Nguon-thu-nhat/ });
  await firstChip.focus();
  await firstChip.press('Enter');
  const panel = page.getByRole('complementary', { name: 'Chi tiết nguồn trích dẫn' });
  await expect(panel).toBeFocused();
  await expect(panel.getByText('Nguon-thu-nhat.pdf')).toBeVisible();
  await expect(panel.getByText('Trang 3')).toBeVisible();
  await expect(panel.getByText(/Doan demo thu nhat/)).toBeVisible();
  expect(await panel.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);
  expect(
    await page.locator('.chat-layout').evaluate((element) => element.clientHeight),
  ).toBeLessThanOrEqual(722);
  await panel.getByRole('button', { name: 'Đóng nguồn trích dẫn' }).click();
  await expect(firstChip).toBeFocused();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole('button', { name: /Xem nguồn S1: Nguon-thu-hai/ }).click();
  const sheet = page.getByRole('dialog', { name: 'Nguồn trích dẫn' });
  await expect(sheet.getByText('Nguon-thu-hai.txt')).toBeVisible();
  await expect(sheet.getByText(/Đoạn 2/)).toBeVisible();
  await expect(sheet.getByText('Doan demo thu hai')).toBeVisible();
  await sheet.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.evaluate(async (id) => {
    const { authManager } = await import('/src/features/auth/auth-manager.ts');
    const { documentsApi } = await import('/src/api/documents.ts');
    const token = await authManager.accessToken();
    if (!token) throw new Error('Không có phiên demo');
    await documentsApi.delete(token, id);
  }, ids[0]);
  await page.reload();
  await page.getByRole('button', { name: /Xem nguồn S1: Nguồn đã xóa/ }).click();
  const deleted = page.getByRole('dialog', { name: 'Nguồn trích dẫn' });
  await expect(deleted.getByText('Nguồn đã xóa')).toBeVisible();
  await expect(deleted.getByText('Nguon-thu-nhat.pdf')).toHaveCount(0);
  await expect(deleted.getByText('Doan demo thu nhat')).toHaveCount(0);
  await deleted.getByRole('button', { name: 'Đóng', exact: true }).click();
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
});
