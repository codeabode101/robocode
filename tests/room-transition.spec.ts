import { test, expect } from '@playwright/test';

test.describe('Room Transitions', () => {
  test('enters and exits workshop without crash', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    const email = `room${Date.now()}@test.com`;
    const res = await page.request.post('https://robocode.rahejaom.workers.dev/api/auth/signup', {
      data: { email, password: 'TestPass123!', name: 'RoomTest' },
    });
    expect(res.status()).toBe(200);

    await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'networkidle', timeout: 30000 });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 20000 });

    // Wait for scene to fully load
    await page.waitForTimeout(8000);

    // Walk toward workshop door at (-6, -10.3) from spawn (0, -7)
    // Need to walk south (S key = -Y) and west (A key = -X)
    // With default camera yaw=0: S moves toward -Y
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(4000);
    await page.keyboard.up('KeyA');
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(3000);
    await page.keyboard.up('KeyS');

    // Try entering workshop by walking into door area
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(1000);
    await page.keyboard.up('KeyW');

    await page.waitForTimeout(1000);

    // Try to exit by walking south toward the door
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(3000);
    await page.keyboard.up('KeyS');

    await page.waitForTimeout(2000);

    await expect(canvas).toBeVisible();

    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404') && !e.includes('fetch') && !e.includes('Retry')
    );
    expect(criticalErrors).toEqual([]);
  });
});
