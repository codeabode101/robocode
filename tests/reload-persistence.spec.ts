import { test, expect } from '@playwright/test';

const BASE = 'https://robocode.rahejaom.workers.dev';

test.describe('Data persistence after reload', () => {
  let email: string;
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    email = `reload-${Date.now()}@test.com`;
    const res = await request.post(`${BASE}/api/auth/signup`, {
      data: { email, password: 'TestPass123!', name: 'ReloadTest' },
    });
    expect(res.status()).toBe(200);
    cookie = (res.headers()['set-cookie'] || '').split(';')[0].split('=')[1];
    expect(cookie).toBeTruthy();
  });

  test('dedicated quest API persists across reload', async ({ request }) => {
    // Save quest stage
    const saveRes = await request.post(`${BASE}/api/profile/quest`, {
      data: { stage: 'unit1-done' },
      headers: { Cookie: `session=${cookie}` },
    });
    expect(saveRes.status()).toBe(200);

    // Load profile
    const loadRes = await request.get(`${BASE}/api/profile`, {
      headers: { Cookie: `session=${cookie}` },
    });
    expect(loadRes.status()).toBe(200);
    const data = await loadRes.json();
    expect(data.questStage).toBe('unit1-done');
  });

  test('dedicated money API persists across reload', async ({ request }) => {
    const saveRes = await request.post(`${BASE}/api/profile/money`, {
      data: { amount: 30 },
      headers: { Cookie: `session=${cookie}` },
    });
    expect(saveRes.status()).toBe(200);

    const loadRes = await request.get(`${BASE}/api/profile`, {
      headers: { Cookie: `session=${cookie}` },
    });
    expect(loadRes.status()).toBe(200);
    const data = await loadRes.json();
    expect(data.currency).toBe(30);
  });

  test('dedicated inventory API persists across reload', async ({ request }) => {
    const saveRes = await request.post(`${BASE}/api/profile/inventory`, {
      data: { items: ['battery', 'sensor'] },
      headers: { Cookie: `session=${cookie}` },
    });
    expect(saveRes.status()).toBe(200);

    const loadRes = await request.get(`${BASE}/api/profile`, {
      headers: { Cookie: `session=${cookie}` },
    });
    expect(loadRes.status()).toBe(200);
    const data = await loadRes.json();
    expect(data.backpack).toEqual(['battery', 'sensor']);
  });

  test('full game scenario: battery cutscene data survives reload', async ({ page, context }) => {
    // Add session cookie
    await context.addCookies([{
      name: 'session', value: cookie,
      domain: 'robocode.rahejaom.workers.dev', path: '/',
    }]);

    // Step 1: Set up initial state via API
    await page.request.post(`${BASE}/api/profile/money`, {
      data: { amount: 25 },
      headers: { Cookie: `session=${cookie}` },
    });
    await page.request.post(`${BASE}/api/profile/inventory`, {
      data: { items: ['battery'] },
      headers: { Cookie: `session=${cookie}` },
    });
    await page.request.post(`${BASE}/api/profile/quest`, {
      data: { stage: 'unit1-done' },
      headers: { Cookie: `session=${cookie}` },
    });

    // Step 2: Load game - expect to see the game
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE}/game`, { waitUntil: 'networkidle', timeout: 30000 });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 20000 });

    // Wait for profile to load and game to initialize
    await page.waitForTimeout(5000);

    // Step 3: Reload the page (simulate crash/refresh)
    await page.reload({ waitUntil: 'networkidle', timeout: 30000 });
    await expect(canvas).toBeVisible({ timeout: 20000 });

    await page.waitForTimeout(5000);

    // Step 4: Verify no critical errors
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404') && !e.includes('fetch') && !e.includes('Retry')
    );
    expect(criticalErrors).toEqual([]);

    // Step 5: Verify server-side data after reload
    const profileRes = await page.request.get(`${BASE}/api/profile`, {
      headers: { Cookie: `session=${cookie}` },
    });
    expect(profileRes.status()).toBe(200);
    const profile = await profileRes.json();
    expect(profile.questStage).toBe('unit1-done');
    expect(profile.currency).toBe(25);
    expect(profile.backpack).toContain('battery');
  });
});
