import { test, expect } from '@playwright/test';

const BASE = 'https://robocode.rahejaom.workers.dev';

test.describe('Scrap Follower', () => {
  let email: string;

  test.beforeAll(async ({ request }) => {
    email = `scrap-${Date.now()}@test.com`;
    const res = await request.post(`${BASE}/api/auth/signup`, {
      data: { email, password: 'TestPass123!', name: 'ScrapTest' },
    });
    expect(res.status()).toBe(200);
    const cookie = res.headers()['set-cookie']?.split(';')[0].split('=')[1];
    expect(cookie).toBeTruthy();

    // Set to all-done state with scrap in backpack, outside apartment
    await request.post(`${BASE}/api/sync`, {
      data: {
        questStage: 'all-done',
        backpack: ['scrap'],
        cutsceneDone: true,
        batteryInstalled: true,
        pendingBatteryCutscene: false,
        position: { x: -9.6, y: -5.5, room: 'outside', rotation: 0 },
      },
      headers: { Cookie: `session=${cookie}` },
    });
  });

  test('follower is created, activated, and follows the player', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));

    await page.goto(`${BASE}/game`, { waitUntil: 'networkidle', timeout: 30000 });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 20000 });

    // Wait for follower to be created and activated
    await page.waitForTimeout(8000);

    // Verify follower creation and activation logs
    expect(logs.some((l) => l.includes('[scrap] FOLLOWER CREATED'))).toBeTruthy();
    expect(logs.some((l) => l.includes('[scrap] ACTIVATED'))).toBeTruthy();

    // Check initial follower position from window var
    let fx = await page.evaluate(() => (window as any).__scrapFollowerX);
    let fy = await page.evaluate(() => (window as any).__scrapFollowerY);
    expect(fx).toBeCloseTo(-3.6, 1);
    expect(fy).toBeCloseTo(-5.0, 1);

    // Move player east (KeyD) to trigger follower follow
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(3000);
    await page.keyboard.up('KeyD');
    await page.waitForTimeout(2000);

    // Check follower has moved from initial position
    const newFx = await page.evaluate(() => (window as any).__scrapFollowerX);
    const newFy = await page.evaluate(() => (window as any).__scrapFollowerY);
    expect(newFx).not.toBeCloseTo(-3.6, 1);
    expect(newFy).not.toBeCloseTo(-5.0, 1);

    // Check no critical errors
    const criticalErrors = logs.filter(
      (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404') && !e.includes('fetch')
    );
    expect(criticalErrors).toEqual([]);
  });
});
