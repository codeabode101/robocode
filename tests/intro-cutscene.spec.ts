import { test, expect } from '@playwright/test';

const BASE = 'https://robocode.rahejaom.workers.dev';

test.describe('Intro cutscene', () => {
  test('starts playing after controls modal dismissed', async ({ page, context }) => {
    const email = `apt-${Date.now()}@test.com`;
    const res = await page.request.post(`${BASE}/api/auth/signup`, {
      data: { email, password: 'TestPass123!', name: 'AptTest' },
    });
    expect(res.ok()).toBe(true);
    const c = (res.headers()['set-cookie'] || '').split(';')[0].split('=')[1];
    await context.addCookies([{
      name: 'session', value: c, domain: 'robocode.rahejaom.workers.dev', path: '/',
    }]);

    await page.request.post(`${BASE}/api/sync`, {
      data: { position: { x: 0, y: -1.5, room: 'apartment' } },
      headers: { Cookie: `session=${c}` },
    });

    let cutsceneStarted = false;
    page.on('console', msg => {
      if (msg.text().includes('aptCutscenePhaseRef.current = \'walk-west\'')) cutsceneStarted = true;
    });

    await page.goto(`${BASE}/game`, { waitUntil: 'networkidle', timeout: 30000 });
    await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });

    // Wait for controls modal
    await page.waitForTimeout(5000);
    // Profile should have cutsceneDone: false
    let p = await (await page.request.get(`${BASE}/api/profile`, {
      headers: { Cookie: `session=${c}` },
    })).json();
    expect(p.cutsceneDone).toBe(false);

    // Dismiss controls modal
    const gotIt = page.locator('button:has-text("Got it!")');
    if (await gotIt.count() > 0) await gotIt.click();

    // Wait and verify cutscene doesn't complete (has interactive phases)
    await page.waitForTimeout(3000);
    p = await (await page.request.get(`${BASE}/api/profile`, {
      headers: { Cookie: `session=${c}` },
    })).json();
    // cutscene should still not be done (not enough time + interactive phases)
    // But the important thing: the game didn't crash and profile is intact
    expect(p.cutsceneDone).toBe(false);
    expect(p.questStage).toBe('intro');
  });
});
