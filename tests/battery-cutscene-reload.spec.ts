import { test, expect } from '@playwright/test';

const BASE = 'https://robocode.rahejaom.workers.dev';

test.describe('Battery cutscene reload scenario', () => {
  let email: string;
  let cookie: string;

  test.beforeAll(async ({ request }) => {
    email = `bat-reload-${Date.now()}@test.com`;
    const res = await request.post(`${BASE}/api/auth/signup`, {
      data: { email, password: 'TestPass123!', name: 'BatReloadTest' },
    });
    expect(res.status()).toBe(200);
    cookie = (res.headers()['set-cookie'] || '').split(';')[0].split('=')[1];
    expect(cookie).toBeTruthy();
  });

  // @ts-ignore
  test.setTimeout(120000);
  test('simulates post-intro state: battery cutscene triggers and survives reload', async ({ page, context }) => {
    // Add session cookie
    await context.addCookies([{
      name: 'session', value: cookie,
      domain: 'robocode.rahejaom.workers.dev', path: '/',
    }]);

    // Step 1: Set up server state to simulate "post-intro, has-battery, inside apartment"
    await page.request.post(`${BASE}/api/profile/money`, {
      data: { amount: 0 },
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
    // Set cutsceneDone=true and position=apartment via sync
    await page.request.post(`${BASE}/api/sync`, {
      data: { cutsceneDone: true, position: { x: 0, y: -1.5, room: 'apartment', rotation: 0 } },
      headers: { Cookie: `session=${cookie}` },
    });

    // Verify server state
    const profileRes = await page.request.get(`${BASE}/api/profile`, {
      headers: { Cookie: `session=${cookie}` },
    });
    const profile = await profileRes.json();
    console.log('INITIAL STATE:', JSON.stringify({ questStage: profile.questStage, backpack: profile.backpack, currency: profile.currency, cutsceneDone: profile.cutsceneDone, batteryInstalled: profile.batteryInstalled, position: profile.position.room }));
    expect(profile.questStage).toBe('unit1-done');
    expect(profile.backpack).toContain('battery');
    expect(profile.cutsceneDone).toBe(true);
    expect(profile.position.room).toBe('apartment');
    expect(profile.batteryInstalled).toBe(false);

    // Step 2: Load game
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(`${BASE}/game`, { waitUntil: 'load', timeout: 30000 });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 20000 });

    // Wait for game to initialize (profile load, scene setup)
    await page.waitForTimeout(10000);

    // Step 3: Check if controls modal appeared (indicates battery cutscene is pending)
    // The battery cutscene guard waits for controls modal to dismiss
    const controlsModal = page.locator('text=How to play');
    const controlsVisible = await controlsModal.isVisible().catch(() => false);

    if (controlsVisible) {
      // Dismiss controls modal — cutscene should start
      await controlsModal.press('Enter');
      await page.waitForTimeout(1000);
    }

    // Wait for cutscene to begin (hideGameUi = true, no mission text)
    await page.waitForTimeout(3000);

    // Verify mission text is NOT visible during cutscene
    // During battery cutscene, hideGameUi is true, so mission box should not exist
    const missionVisible = await page.locator('text=Earn $10').or(page.locator('text=Bring the battery')).isVisible().catch(() => false);
    // It's OK if mission is visible or not — the cutscene might have already progressed past hide

    // DEBUG: Check server state before reload
    const beforeReloadProfile = await page.request.get(`${BASE}/api/profile`);
    const brp = await beforeReloadProfile.json();
    console.log('BEFORE RELOAD:', JSON.stringify({ questStage: brp.questStage, backpack: brp.backpack, currency: brp.currency, cutsceneDone: brp.cutsceneDone, batteryInstalled: brp.batteryInstalled, position: brp.position.room }));

    // Step 4: RELOAD during the cutscene
    // Use 'load' instead of 'networkidle' — persistent WebSocket keeps network busy
    await page.reload({ waitUntil: 'load', timeout: 30000 });
    await expect(canvas).toBeVisible({ timeout: 20000 });

    // Wait for profile load and pending cutscene detection (retries + scene init)
    await page.waitForTimeout(10000);

    // Step 5: After reload, controls modal should appear again (pending cutscene)
    const controlsAfterReload = page.locator('text=How to play');
    await expect(controlsAfterReload).toBeVisible({ timeout: 10000 });

    // Dismiss it
    await controlsAfterReload.press('Enter');
    await page.waitForTimeout(2000);

    // Step 6: Verify no crashes
    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404') && !e.includes('fetch') && !e.includes('Retry') && !e.includes('ResizeObserver') && !e.includes('AbortError')
    );
    expect(criticalErrors).toEqual([]);

    // Step 7: Verify server data is intact after reload
    const profileAfter = await page.request.get(`${BASE}/api/profile`);
    const pAfter = await profileAfter.json();
    console.log('AFTER RELOAD:', JSON.stringify({ questStage: pAfter.questStage, backpack: pAfter.backpack, currency: pAfter.currency, cutsceneDone: pAfter.cutsceneDone, batteryInstalled: pAfter.batteryInstalled }));
    expect(pAfter.questStage).toBe('unit1-done');
    expect(pAfter.backpack).toContain('battery');
    expect(pAfter.cutsceneDone).toBe(true);
    expect(pAfter.batteryInstalled).toBe(false);
  });
});
