import { test, expect } from '@playwright/test';

const BASE = 'https://robocode.rahejaom.workers.dev';

test.describe('Apartment entry test', () => {
  test('intro cutscene completes fully', async ({ page, context }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(msg.text()));

    const email = `apt-${Date.now()}@test.com`;
    const res = await page.request.post(`${BASE}/api/auth/signup`, {
      data: { email, password: 'TestPass123!', name: 'AptTest' },
    });
    expect(res.status()).toBe(200);
    const cookieValue = (res.headers()['set-cookie'] || '').split(';')[0].split('=')[1];
    await context.addCookies([{
      name: 'session', value: cookieValue,
      domain: 'robocode.rahejaom.workers.dev', path: '/',
    }]);

    await page.request.post(`${BASE}/api/sync`, {
      data: { position: { x: 0, y: -1.5, room: 'apartment' } },
      headers: { Cookie: `session=${cookieValue}` },
    });

    await page.goto(`${BASE}/game`, { waitUntil: 'networkidle', timeout: 30000 });
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
    await page.waitForTimeout(6000);

    const gotIt = page.locator('button:has-text("Got it!")');
    if (await gotIt.count() > 0) {
      await gotIt.click();
      console.log('[DEBUG] Dismissed controls modal');
    }

    // Press Enter every 800ms to advance dialogs (60s total = 75 presses)
    for (let i = 0; i < 75; i++) {
      await page.waitForTimeout(800);
      await page.keyboard.press('Enter');
    }

    const profileRes = await page.request.get(`${BASE}/api/profile`, {
      headers: { Cookie: `session=${cookieValue}` },
    });
    const profile = await profileRes.json();
    console.log('[DEBUG] Profile:', JSON.stringify(profile, null, 2));

    const phaseLogs = logs.filter(l => l.includes('[TRANSITION]') || l.includes('open-box') || l.includes('done') || l.includes('idle'));
    console.log('[DEBUG] Phase transition logs:', phaseLogs.slice(0, 30));

    await page.screenshot({ path: '/tmp/opencode/after-full-cutscene.png' });
  });
});
