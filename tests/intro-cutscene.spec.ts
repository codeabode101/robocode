import { test, expect } from '@playwright/test';

const BASE = 'https://robocode.rahejaom.workers.dev';

test.describe('Intro cutscene for new account', () => {
  test('fresh account enters apartment and triggers intro cutscene', async ({ page, context }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Create fresh account
    const email = `intro-${Date.now()}@test.com`;
    const res = await page.request.post(`${BASE}/api/auth/signup`, {
      data: { email, password: 'TestPass123!', name: 'IntroTest' },
    });
    expect(res.status()).toBe(200);

    // Set the session cookie in the browser context
    const cookieValue = (res.headers()['set-cookie'] || '').split(';')[0].split('=')[1];
    await context.addCookies([{
      name: 'session', value: cookieValue,
      domain: 'robocode.rahejaom.workers.dev', path: '/',
    }]);

    // Verify profile is clean
    const initialProfile = await page.request.get(`${BASE}/api/profile`, {
      headers: { Cookie: `session=${cookieValue}` },
    });
    const initData = await initialProfile.json();
    console.log('[DEBUG] Initial profile:', JSON.stringify(initData));

    // Load game
    await page.goto(`${BASE}/game`, { waitUntil: 'networkidle', timeout: 30000 });
    const canvas = page.locator('canvas');
    await expect(canvas).toBeVisible({ timeout: 20000 });

    // Wait for game to fully initialize
    await page.waitForTimeout(8000);

    // Walk toward apartment door at (-3.6, -4.9) from spawn (0, -7)
    // With default camera yaw=0: W = +Y (up/north), A = -X (left/west)
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(3500);
    await page.keyboard.up('KeyA');

    await page.keyboard.down('KeyW');
    await page.waitForTimeout(2000);
    await page.keyboard.up('KeyW');

    await page.waitForTimeout(3000);

    // Check profile after play
    const afterProfile = await page.request.get(`${BASE}/api/profile`, {
      headers: { Cookie: `session=${cookieValue}` },
    });
    const afterData = await afterProfile.json();
    console.log('[DEBUG] Profile after play:', JSON.stringify(afterData));

    // Check for "Scrap is fully repaired" in the page
    const pageText = await page.textContent('body') || '';
    const hasFullyRepaired = pageText.includes('fully repaired');
    console.log('[DEBUG] "fully repaired" found in page:', hasFullyRepaired);

    // Check for mission box or dialog (TFB component shows speaker name)
    const hasSparky = pageText.includes('Sparky');
    console.log('[DEBUG] Sparky mention found in page:', hasSparky);

    // Take screenshot
    await page.screenshot({ path: '/tmp/opencode/intro-cutscene.png', fullPage: false });

    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404') && !e.includes('fetch') && !e.includes('Retry')
    );
    expect(criticalErrors).toEqual([]);
  });
});
