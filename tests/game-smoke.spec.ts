import { test, expect } from '@playwright/test';

test.describe('Game Smoke Test', () => {
  test('loads game and renders canvas without console errors', async ({ page, context }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const email = `smoke${Date.now()}@test.com`;
    const res = await page.request.post('https://robocode.rahejaom.workers.dev/api/auth/signup', {
      data: { email, password: 'TestPass123!', name: 'SmokeTest' },
    });
    expect(res.status()).toBe(200);

    await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'networkidle', timeout: 30000 });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 20000 });

    // Idle for a few seconds to let scene load
    await page.waitForTimeout(5000);

    // Walk around briefly
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2000);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(2000);
    await page.keyboard.up('KeyD');

    await page.waitForTimeout(2000);

    // Canvas should still be present
    await expect(canvas).toBeVisible();

    // Check for critical console errors (ignore Three.js warnings)
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404') && !e.includes('fetch')
    );
    expect(criticalErrors).toEqual([]);
  });
});
