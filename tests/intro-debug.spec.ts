import { test, expect } from '@playwright/test';

const BASE = 'https://robocode.rahejaom.workers.dev';

test.describe('Apartment entry test', () => {
  test('check ALL console output', async ({ page, context }) => {
    const logs: string[] = [];
    page.on('console', msg => logs.push(`[${msg.type()}] ${msg.text()}`));

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
    if (await gotIt.count() > 0) await gotIt.click();
    await page.waitForTimeout(10000);

    // Print ALL non-framework logs
    const allLogs = logs.filter(l => {
      const text = l.toLowerCase();
      return !text.includes('self.__next') && !text.includes('three.') &&
             !text.includes('webgl') && !text.includes('worker') &&
             !text.includes('dep0205') && !text.includes('[warning]');
    });
    console.log('[DEBUG] ALL page logs:');
    allLogs.forEach(l => console.log(l));

    const profileRes = await page.request.get(`${BASE}/api/profile`, {
      headers: { Cookie: `session=${cookieValue}` },
    });
    console.log('[DEBUG] Profile:', JSON.stringify(await profileRes.json(), null, 2));
  });
});
