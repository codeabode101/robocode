import { test, expect } from '@playwright/test';

const BASE = 'https://robocode.rahejaom.workers.dev';

test.describe('Scrap Follower', () => {
  test('follower is created, activated, and positioned correctly', async ({ page }) => {
    const logs: string[] = [];
    page.on('console', (msg) => logs.push(msg.text()));

    const email = `scrap-${Date.now()}@test.com`;
    const signupRes = await page.request.post(`${BASE}/api/auth/signup`, {
      data: { email, password: 'TestPass123!', name: 'ScrapTest' },
    });
    expect(signupRes.status()).toBe(200);

    await page.request.post(`${BASE}/api/sync`, {
      data: {
        questStage: 'all-done',
        backpack: ['scrap'],
        cutsceneDone: true,
        batteryInstalled: true,
        pendingBatteryCutscene: false,
        position: { x: -9.6, y: -5.5, room: 'outside', rotation: 0 },
      },
    });

    await page.goto(`${BASE}/game`, { waitUntil: 'networkidle', timeout: 30000 });
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(8000);

    // Follower was created and activated
    expect(logs.some((l) => l.includes('[scrap] FOLLOWER CREATED'))).toBeTruthy();
    expect(logs.some((l) => l.includes('[scrap] ACTIVATED'))).toBeTruthy();

    // Follower moved from its spawn point (-3.6, -5) toward the player
    const fx = await page.evaluate(() => (window as any).__scrapFollowerX);
    const fy = await page.evaluate(() => (window as any).__scrapFollowerY);
    expect(fx).not.toBeCloseTo(-3.6, 0);
    expect(fy).not.toBeCloseTo(-5.0, 0);

    // No backpack duplicate (dedup on profile load)
    expect(logs.filter((l) => l.includes('backpack')).length).toBeLessThanOrEqual(3);

    // No critical errors
    const criticalErrors = logs.filter(
      (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404') && !e.includes('fetch')
    );
    expect(criticalErrors).toEqual([]);
  });
});
