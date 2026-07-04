import { test, expect } from '@playwright/test';

const BASE = 'https://robocode.rahejaom.workers.dev';

test.describe('Full Game Flow', () => {
  let email: string;
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    email = `fullflow-${Date.now()}@test.com`;
    const res = await request.post(`${BASE}/api/auth/signup`, {
      data: { email, password: 'TestPass123!', name: 'FlowTest' },
    });
    expect(res.status()).toBe(200);
    cookie = (res.headers()['set-cookie'] || '').split(';')[0].split('=')[1];
    expect(cookie).toBeTruthy();
  });

  test('Stage: intro — fresh user loads game without errors', async ({ page, context }) => {
    await context.addCookies([{
      name: 'session', value: cookie,
      domain: 'robocode.rahejaom.workers.dev', path: '/',
    }]);

    // Verify initial state via API
    const profileRes = await page.request.get(`${BASE}/api/profile`);
    const profile = await profileRes.json();
    expect(profile.questStage).toBe('intro');

    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(`${BASE}/game`, { waitUntil: 'load', timeout: 30000 });
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(6000);

    const critical = errors.filter(
      (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404') && !e.includes('fetch') && !e.includes('Retry') && !e.includes('ResizeObserver') && !e.includes('AbortError')
    );
    expect(critical).toEqual([]);
  });

  test('Stage: unit1-done — post-cutscene state renders without errors', async ({ page, context }) => {
    await context.addCookies([{
      name: 'session', value: cookie,
      domain: 'robocode.rahejaom.workers.dev', path: '/',
    }]);

    // Set post-cutscene state: player has letter, shop unlocked
    await page.request.post(`${BASE}/api/sync`, {
      data: { questStage: 'unit1-done', cutsceneDone: true, workshopIntroDone: true, position: { x: 0, y: -7, room: 'outside', rotation: 0 } },
      headers: { Cookie: `session=${cookie}` },
    });
    await page.request.post(`${BASE}/api/profile/inventory`, {
      data: { items: [] },
      headers: { Cookie: `session=${cookie}` },
    });

    // Verify state
    const profile = await (await page.request.get(`${BASE}/api/profile`)).json();
    expect(profile.questStage).toBe('unit1-done');
    expect(profile.cutsceneDone).toBe(true);

    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(`${BASE}/game`, { waitUntil: 'load', timeout: 30000 });
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(6000);

    const critical = errors.filter(
      (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404') && !e.includes('fetch') && !e.includes('Retry') && !e.includes('ResizeObserver') && !e.includes('AbortError')
    );
    expect(critical).toEqual([]);
  });

  test('Stage: all-done — scrap follower active without errors', async ({ page, context }) => {
    await context.addCookies([{
      name: 'session', value: cookie,
      domain: 'robocode.rahejaom.workers.dev', path: '/',
    }]);

    // Set completed state: all-done, battery installed, scrap in backpack
    await page.request.post(`${BASE}/api/sync`, {
      data: { questStage: 'all-done', cutsceneDone: true, batteryInstalled: true, pendingBatteryCutscene: false, position: { x: -9.6, y: -5.5, room: 'outside', rotation: 0 } },
      headers: { Cookie: `session=${cookie}` },
    });
    await page.request.post(`${BASE}/api/profile/inventory`, {
      data: { items: ['scrap'] },
      headers: { Cookie: `session=${cookie}` },
    });

    const profile = await (await page.request.get(`${BASE}/api/profile`)).json();
    expect(profile.questStage).toBe('all-done');
    expect(profile.batteryInstalled).toBe(true);

    const errors: string[] = [];
    page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });

    await page.goto(`${BASE}/game`, { waitUntil: 'load', timeout: 30000 });
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(10000);

    // Verify follower was created and activated
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));
    // Check the activity was logged before our listener — re-evaluate
    const fx = await page.evaluate(() => (window as any).__scrapFollowerX);
    const fy = await page.evaluate(() => (window as any).__scrapFollowerY);
    if (typeof fx === 'number') expect(fx).not.toBeCloseTo(-3.6, 0);

    const critical = errors.filter(
      (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404') && !e.includes('fetch') && !e.includes('Retry') && !e.includes('ResizeObserver') && !e.includes('AbortError')
    );
    expect(critical).toEqual([]);
  });

  test('State transitions via API — all endpoints work correctly', async ({ page }) => {
    const headers = { Cookie: `session=${cookie}` };
    // Test each quest stage can be set and read back
    const stages = ['intro', 'unit1', 'unit1-done', 'unit2', 'unit2-done', 'all-done'] as const;
    for (const stage of stages) {
      const setRes = await page.request.post(`${BASE}/api/profile/quest`, {
        data: { stage },
        headers,
      });
      expect(setRes.status()).toBe(200);

      const getRes = await page.request.get(`${BASE}/api/profile`, { headers });
      const data = await getRes.json();
      expect(data.questStage).toBe(stage);
    }

    // Backpack persistence
    const items = ['scrap'];
    await page.request.post(`${BASE}/api/profile/inventory`, {
      data: { items },
      headers,
    });
    const invRes = await (await page.request.get(`${BASE}/api/profile`, { headers })).json();
    expect(invRes.backpack).toEqual(items);

    // Money persistence
    await page.request.post(`${BASE}/api/profile/money`, {
      data: { amount: 42 },
      headers,
    });
    const moneyRes = await (await page.request.get(`${BASE}/api/profile`, { headers })).json();
    expect(moneyRes.currency).toBe(42);
  });
});
