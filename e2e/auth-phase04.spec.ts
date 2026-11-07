import { expect, test } from '@playwright/test';

import AxeBuilder from '@axe-core/playwright';
const baseUrl = process.env.DOCUMIND_E2E_BASE_URL;
const nonce = process.env.DOCUMIND_E2E_HARNESS_NONCE;
test.skip(!baseUrl || !nonce, 'Chạy qua harness E2E cách ly.');
test.use({ channel: 'chrome' });
test.beforeEach(async ({ page }) => {
  if (!baseUrl || !nonce || !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseUrl))
    throw new Error('Thiếu môi trường test.');
  const marker = await page.request.get(`${baseUrl}/__phase03_harness`);
  if (!marker.ok() || (await marker.text()) !== nonce) throw new Error('Sai Vite test.');
});

test('đăng ký, đăng nhập, reload hai tab và đăng xuất', async ({ page, context }) => {
  await page.goto(`${baseUrl}/app`);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.getByRole('link', { name: 'Tạo tài khoản' }).click();
  const email = `phase04-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Hiện mật khẩu' }).click();
  await expect(page.getByLabel('Mật khẩu', { exact: true })).toHaveAttribute('type', 'text');
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(
    page.getByText('Tạo tài khoản thành công. Hãy đăng nhập để tiếp tục.'),
  ).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  const second = await context.newPage();
  await second.goto(`${baseUrl}/app`);
  await expect(second.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  await Promise.all([page.reload(), second.reload()]);
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  await expect(second.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  await page.getByRole('button', { name: /Tài khoản/ }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(second.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByText('Bạn đã đăng xuất.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});

test('mất mạng lúc logout không khôi phục phiên và cho thử lại', async ({ page, context }) => {
  await page.goto(`${baseUrl}/register`);
  const email = `phase04-offline-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole('button', { name: /Tài khoản/ }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await expect(
    page.getByText('Chưa xác nhận đăng xuất với máy chủ. Vui lòng thử lại.'),
  ).toBeVisible();
  await context.setOffline(false);
  await page.reload();
  await expect(page.getByRole('button', { name: 'Thử đăng xuất lại' })).toBeVisible();
  await page.getByRole('button', { name: 'Thử đăng xuất lại' }).click();
  await expect(page.getByText('Bạn đã đăng xuất.', { exact: true })).toBeVisible();
});

test('refresh đến muộn sau logout không khôi phục phiên', async ({ page, context }) => {
  await page.goto(`${baseUrl}/register`);
  const email = `phase04-race-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  const second = await context.newPage();
  await second.goto(`${baseUrl}/app`);
  await expect(second.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  let release: () => void = () => {};
  let reached: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const requestReached = new Promise<void>((resolve) => {
    reached = resolve;
  });
  await page.route('**/api/v1/auth/refresh', async (route) => {
    reached();
    await gate;
    await route.continue();
  });
  await page.evaluate(async () => {
    const originalNow = Date.now.bind(Date);
    Date.now = () => originalNow() + 16 * 60 * 1000;
    const { authManager } = await import('/src/features/auth/auth-manager.ts');
    void authManager.refresh().catch(() => {});
  });
  await requestReached;
  await second.getByRole('button', { name: /Tài khoản/ }).click();
  await second.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await expect(second.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  release();
  await expect(second.getByText('Bạn đã đăng xuất.', { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});

test('đổi tài khoản giữa hai tab xóa cache tài khoản trước', async ({ page, context }) => {
  await page.goto(`${baseUrl}/register`);
  const firstEmail = `phase04-a-${crypto.randomUUID()}@example.test`;
  const secondEmail = `phase04-b-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(firstEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(firstEmail);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  const firstId = await page.evaluate(async () => {
    const { authManager } = await import('/src/features/auth/auth-manager.ts');
    const { queryClient, queryKeys } = await import('/src/app/query-client.ts');
    const id = authManager.getSnapshot().user?.id;
    if (!id) throw new Error('Thiếu tài khoản đầu tiên');
    queryClient.setQueryData(queryKeys.usage(id), { questionCount: 42 });
    return id;
  });
  const second = await context.newPage();
  await second.goto(`${baseUrl}/app`);
  await expect(second.getByText(firstEmail)).toBeVisible();
  await second.evaluate(
    async ({ email, secret }) => {
      const { authApi } = await import('/src/api/auth.ts');
      const { authManager } = await import('/src/features/auth/auth-manager.ts');
      const credentials = { email, password: secret };
      await authApi.register(credentials, await authApi.csrf());
      await authManager.login(credentials);
    },
    { email: secondEmail, secret: password },
  );
  await expect(page.getByText(secondEmail)).toBeVisible();
  const oldCache = await page.evaluate(async (id) => {
    const { queryClient, queryKeys } = await import('/src/app/query-client.ts');
    return queryClient.getQueryData(queryKeys.usage(id)) ?? null;
  }, firstId);
  expect(oldCache).toBeNull();
});

test('hai tab xử lý REFRESH_RACE khi Web Locks không khả dụng', async ({ page, context }) => {
  await page.goto(`${baseUrl}/register`);
  const email = `phase04-race-window-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  const second = await context.newPage();
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: undefined });
  });
  let count = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const statuses: number[] = [];
  await context.route('**/api/v1/auth/refresh', async (route) => {
    count += 1;
    if (count <= 2) {
      if (count === 2) release();
      await gate;
    }
    await route.continue();
  });
  context.on('response', (response) => {
    if (response.url().endsWith('/api/v1/auth/refresh')) statuses.push(response.status());
  });
  await Promise.all([page.reload(), second.goto(`${baseUrl}/app`)]);
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  await expect(second.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  expect(statuses).toContain(409);
  expect(statuses.filter((status) => status === 200).length).toBe(2);
});

test('refresh token cũ dùng lại sau 5 giây đưa người dùng về màn đăng nhập', async ({
  page,
  context,
}) => {
  await page.goto(`${baseUrl}/register`);
  const email = `phase04-reuse-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  const oldCookie = (await context.cookies()).find((cookie) => cookie.name === 'refresh_token');
  if (!oldCookie) throw new Error('Thiếu refresh cookie');
  await page.reload();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  await new Promise((resolve) => setTimeout(resolve, 5200));
  await context.addCookies([oldCookie]);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).not.toBeVisible();
});

test('giao diện xác thực responsive và không có lỗi axe tự động', async ({ page }) => {
  for (const width of [360, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`${baseUrl}/login`);
    await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      viewport: window.innerWidth,
    }));
    expect(dimensions.scroll).toBeLessThanOrEqual(dimensions.viewport);
    const result = await new AxeBuilder({ page }).analyze();
    expect(result.violations).toEqual([]);
  }
});

test('thông điệp session từ trước logout không phục hồi phiên', async ({ page, context }) => {
  await page.goto(`${baseUrl}/register`);
  const email = `phase04-old-message-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  const second = await context.newPage();
  await second.goto(`${baseUrl}/app`);
  await expect(second.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  await second.evaluate(async () => {
    const { authManager } = await import('/src/features/auth/auth-manager.ts');
    const accessToken = await authManager.accessToken();
    const user = authManager.getSnapshot().user;
    const generation = localStorage.getItem('documind-session-generation');
    if (!accessToken || !user || !generation) throw new Error('Thiếu phiên test');
    const oldMessage = {
      type: 'session',
      generation,
      session: { accessToken, user, tokenType: 'Bearer', expiresIn: 900 },
      expiresAt: Date.now() + 900_000,
    };
    (window as Window & { sendOldSession?: () => void }).sendOldSession = () =>
      new BroadcastChannel('documind-auth-v1').postMessage(oldMessage);
  });
  await page.getByRole('button', { name: /Tài khoản/ }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await expect(page.getByText('Bạn đã đăng xuất.', { exact: true })).toBeVisible();
  await expect(second.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await second.evaluate(() =>
    (window as Window & { sendOldSession?: () => void }).sendOldSession?.(),
  );
  await page.waitForTimeout(350);
  await expect(page.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toHaveCount(0);
});

test('logout xóa phiên tab khác ngay cả khi không có BroadcastChannel', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: undefined });
  });
  await page.goto(`${baseUrl}/register`);
  const email = `phase04-storage-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  const second = await context.newPage();
  await second.goto(`${baseUrl}/app`);
  await expect(second.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  const id = await second.evaluate(async () => {
    const { authManager } = await import('/src/features/auth/auth-manager.ts');
    const { queryClient, queryKeys } = await import('/src/app/query-client.ts');
    const userId = authManager.getSnapshot().user?.id;
    if (!userId) throw new Error('Thiếu user test');
    queryClient.setQueryData(queryKeys.usage(userId), { questionCount: 42 });
    return userId;
  });
  await page.getByRole('button', { name: /Tài khoản/ }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await expect(second.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  const cached = await second.evaluate(async (userId) => {
    const { queryClient, queryKeys } = await import('/src/app/query-client.ts');
    return queryClient.getQueryData(queryKeys.usage(userId)) ?? null;
  }, id);
  expect(cached).toBeNull();
  await expect(page.getByText('Bạn đã đăng xuất.', { exact: true })).toBeVisible();
});

test('logout chờ login đang gửi khi không có Web Locks và BroadcastChannel', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    Object.defineProperty(navigator, 'locks', { configurable: true, value: undefined });
    Object.defineProperty(window, 'BroadcastChannel', { configurable: true, value: undefined });
  });
  await page.goto(`${baseUrl}/register`);
  const email = `phase04-login-race-${crypto.randomUUID()}@example.test`;
  const password = `Demo-${crypto.randomUUID()}!`;
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Mật khẩu', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click();
  await expect(page.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  const second = await context.newPage();
  await second.goto(`${baseUrl}/app`);
  await expect(second.getByRole('heading', { name: /Chào mừng đến DocuMind/ })).toBeVisible();
  let release: () => void = () => {};
  let reached: () => void = () => {};
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const loginReached = new Promise<void>((resolve) => {
    reached = resolve;
  });
  await second.route('**/api/v1/auth/login', async (route) => {
    reached();
    await gate;
    await route.continue();
  });
  await second.evaluate(
    async ({ account, secret }) => {
      const { authManager } = await import('/src/features/auth/auth-manager.ts');
      void authManager.login({ email: account, password: secret }).catch(() => {});
    },
    { account: email, secret: password },
  );
  await loginReached;
  await page.getByRole('button', { name: /Tài khoản/ }).click();
  await page.getByRole('menuitem', { name: 'Đăng xuất' }).click();
  await expect(page.getByText('Đang đăng xuất…')).toBeVisible();
  await expect(page.getByText('Bạn đã đăng xuất.', { exact: true })).toHaveCount(0);
  release();
  await expect(page.getByText('Bạn đã đăng xuất.', { exact: true })).toBeVisible();
  await expect(second.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
  await second.reload();
  await expect(second.getByRole('heading', { name: 'Đăng nhập' })).toBeVisible();
});
