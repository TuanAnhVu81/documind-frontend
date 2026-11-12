import { execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { createClsTracker } from './cls';

const base = process.env.DOCUMIND_E2E_BASE_URL;
const nonce = process.env.DOCUMIND_E2E_HARNESS_NONCE;
const db = process.env.DOCUMIND_E2E_DB_NAME;
const captures = resolve('.local/phase10-screenshots');
test.skip(!base || !nonce || !db, 'Chạy bằng harness E2E cách ly.');
test.use({ channel: 'chrome' });
test.setTimeout(120_000);

test('CLS tính theo session window và bỏ qua layout shift do tương tác', () => {
  const tracker = createClsTracker();
  tracker.add(0, 0.1, false);
  tracker.add(900, 0.2, false);
  tracker.add(1000, 1, true);
  tracker.add(2000, 0.4, false);
  expect(tracker.value()).toBeCloseTo(0.4);
  const longSession = createClsTracker();
  for (let time = 0; time <= 5000; time += 500) longSession.add(time, 0.01, false);
  expect(longSession.value()).toBeCloseTo(0.1);
});

test('giao diện thật, bàn phím và responsive với dữ liệu demo cách ly', async ({ page }) => {
  if (!base || !nonce || !db || !/^documind_fe_e2e_[0-9a-f]{16}$/.test(db))
    throw new Error('Thiếu môi trường test cách ly');
  mkdirSync(captures, { recursive: true });
  expect(await (await page.request.get(`${base}/__phase03_harness`)).text()).toBe(nonce);
  await page.addInitScript({ content: `
    const tracker = (${createClsTracker.toString()})();
    window.phase10Metrics = tracker;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        tracker.add(entry.startTime, entry.value, entry.hadRecentInput);
      }
    }).observe({ type: 'layout-shift', buffered: true });
  ` });
  await page.goto(`${base}/register`);
  const fontFaces = await page.evaluate(async () => {
    const faces = await document.fonts.load('400 14px "Be Vietnam Pro"', 'Tiếng Việt');
    return faces.filter((face) => face.status === 'loaded').length;
  });
  expect(fontFaces).toBeGreaterThan(0);
  const email = `phase10-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByLabel('Nhập lại mật khẩu').fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('link', { name: 'Bắt đầu hội thoại' })).toHaveAttribute('href', '/app/chat');
  await page.getByRole('link', { name: 'Tài liệu', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Thư viện tài liệu' })).toHaveCSS('font-weight', '700');
  await expect(page.getByRole('heading', { name: 'Thư viện của bạn đang trống' })).toBeVisible();
  await page.screenshot({ path: resolve(captures, '01-upload-trong.png') });
  const input = page.getByLabel('Chọn tài liệu PDF, DOCX hoặc TXT');
  await input.setInputFiles({ name: 'demo.txt', mimeType: 'text/plain', buffer: Buffer.from('Tài liệu thử nghiệm.') });
  await expect(page.getByText('Đã tiếp nhận · Chờ xử lý')).toBeVisible();
  const card = page.locator('article.document-card').filter({ hasText: 'demo.txt' });
  await expect(card).toBeVisible();
  await page.screenshot({ path: resolve(captures, '02-thu-vien.png') });
  const detail = card.getByRole('button', { name: /Chi tiết/ });
  await detail.focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Chi tiết tài liệu' });
  await expect(dialog.getByRole('link', { name: 'Mở hội thoại' })).toHaveAttribute('href', '/app/chat');
  for (let i = 0; i < 8; i++) {
    await page.keyboard.press('Tab');
    expect(await dialog.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(detail).toBeFocused();
  await page.context().setOffline(true);
  await detail.click();
  await expect(dialog.getByText('Chưa tải được chi tiết')).toBeVisible();
  await page.screenshot({ path: resolve(captures, '03-loi-ket-noi.png') });
  await page.context().setOffline(false);
  await dialog.getByRole('button', { name: 'Đóng', exact: true }).click();
  await page.getByRole('link', { name: 'Hội thoại', exact: true }).click();
  await page.getByRole('button', { name: 'Tạo hội thoại', exact: true }).click();
  await expect(page).toHaveURL(/\/app\/chat\/[0-9a-f-]+$/);
  const conversation = page.url().split('/').pop()!;
  expect(conversation).toMatch(/^[0-9a-f-]{36}$/);
  const docId = await page.evaluate(async () => {
    const { authManager } = await import('/src/features/auth/auth-manager.ts');
    const { documentsApi } = await import('/src/api/documents.ts');
    const token = await authManager.accessToken();
    if (!token) throw new Error('Thiếu phiên demo');
    return (await documentsApi.list(token, { page: 0, size: 20 })).items[0]?.id;
  });
  expect(docId).toMatch(/^[0-9a-f-]{36}$/);
  const sql = `INSERT INTO messages(id,conversation_id,ordinal,role,content,status,outcome,sources) VALUES
    (gen_random_uuid(),'${conversation}'::uuid,1,'ASSISTANT','Thông tin demo [S1].','COMPLETE','ANSWER',jsonb_build_array(jsonb_build_object('sourceId','S1','documentId','${docId}','filename','demo.txt','locationType','PARAGRAPH','pageNumber',NULL,'paragraphIndex',1,'startOffset',0,'endOffset',20,'snippet','Tài liệu thử nghiệm.','availability','AVAILABLE')))`;
  execFileSync('docker', ['exec', 'local_postgres', 'psql', '-U', 'postgres', '-d', db, '-v', 'ON_ERROR_STOP=1', '-c', sql]);
  await page.reload();
  await page.setViewportSize({ width: 1440, height: 900 });
  const chip = page.getByRole('button', { name: /Xem nguồn S1/ });
  await expect(chip).toBeVisible();
  await page.screenshot({ path: resolve(captures, '04-hoi-thoai.png') });
  await chip.focus();
  await page.keyboard.press('Enter');
  const panel = page.getByRole('complementary', { name: 'Chi tiết nguồn trích dẫn' });
  await expect(panel).toBeFocused();
  await page.screenshot({ path: resolve(captures, '05-nguon-trich-dan.png') });
  await panel.getByRole('button', { name: 'Đóng nguồn trích dẫn' }).click();
  await expect(chip).toBeFocused();
  for (const width of [320, 390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.getByLabel('Câu hỏi của bạn')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: resolve(captures, '06-mobile-chat.png') });
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.setViewportSize({ width: 320, height: 360 });
  const draft = page.getByLabel('Câu hỏi của bạn');
  await draft.fill('Dòng đầu');
  await draft.press('Enter');
  await expect(draft).toHaveValue('Dòng đầu\n');
  await draft.fill(('Câu hỏi demo dài để thử cuộn.\n').repeat(80));
  await page.context().setOffline(true);
  await draft.press('Control+Enter');
  const retry = page.getByRole('button', { name: 'Kiểm tra lại yêu cầu' });
  await expect(retry).toBeVisible();
  await retry.scrollIntoViewIfNeeded();
  expect(await retry.evaluate((button) => {
    const rect = button.getBoundingClientRect();
    const container = button.closest('.chat-main')!.getBoundingClientRect();
    return rect.top >= container.top && rect.bottom <= container.bottom;
  })).toBe(true);
  await page.context().setOffline(false);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  await page.getByRole('button', { name: 'Mở điều hướng' }).click();
  const drawer = page.getByRole('dialog', { name: 'Điều hướng' });
  await drawer.getByRole('link', { name: 'Cài đặt' }).click();
  await page.getByLabel('Tối', { exact: true }).check();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('heading', { name: 'Cài đặt' })).toHaveCSS('color', 'rgb(238, 243, 252)');
  await expect(page.getByRole('heading', { name: 'Cài đặt' })).toHaveCSS('font-weight', '700');
  expect((await new AxeBuilder({ page }).analyze()).violations).toEqual([]);
  await page.screenshot({ path: resolve(captures, '07-mobile-cai-dat-toi.png') });
  const metrics = await page.evaluate(() => {
    const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
    return {
      cls: (window as unknown as { phase10Metrics: { value(): number } }).phase10Metrics.value(),
      domContentLoadedMs: navigation.domContentLoadedEventEnd,
    };
  });
  console.log(`Phase 10 dev-session metrics: CLS=${metrics.cls.toFixed(4)}, DOMContentLoaded=${metrics.domContentLoadedMs.toFixed(0)}ms`);
});
