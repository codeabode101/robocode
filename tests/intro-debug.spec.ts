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

    // Dismiss controls modal
    const gotIt = page.locator('button:has-text("Got it!")');
    if (await gotIt.count() > 0) {
      await gotIt.click();
      console.log('[DEBUG] Dismissed controls modal');
    }

    // Wait for cutscene to progress through animation phases to first dialog
    // walk-west(2s) → open-box(1.5s) → lift-rise(1s) → lift-carry(2s) → lift-lower(1s)
    // → fetch-laptop(1.5s) → link-computer(2s) → electrocute(3s delay → dialog)
    // Total ~14s from cutscene start to electrocute dialog
    await page.waitForTimeout(25000);

    // Check for TFB dialog presence — look for any text that appears
    const texts = await page.evaluate(() => {
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
      const result: string[] = [];
      let node;
      while (node = walker.nextNode()) {
        const t = (node as Text).textContent?.trim();
        if (t && t.length > 0 && t.length < 200) result.push(t);
      }
      return result;
    });

    console.log('[DEBUG] Text after 25s:');
    const interesting = [...new Set(texts)].filter(t =>
      !t.startsWith('self.__next') && !t.startsWith('@keyframes') &&
      !t.startsWith('0%') && !t.startsWith('}') && !t.startsWith('.animate') &&
      !t.startsWith('label-build') && t.length < 150
    );
    interesting.forEach(t => console.log(`  "${t}"`));

    // Check for cutscene phase transition logs
    const cutsceneLogs = logs.filter(l =>
      l.includes('walk-west') || l.includes('electrocute') || l.includes('string-tutorial') ||
      l.includes('laptop-ui') || l.includes('antenna-glow') || l.includes('date-coding') ||
      l.includes('reboot') || l.includes('version-coding') || l.includes('pre-boot') ||
      l.includes('boot-coding') || l.includes('boot') || l.includes('battery-scene') ||
      l.includes('done') || l.includes('STARTING APT') || l.includes('DEBUG_CUT')
    );
    console.log('[DEBUG] Cutscene-related logs:');
    cutsceneLogs.forEach(l => console.log(`  ${l.slice(0, 120)}`));

    // Check final profile
    const profileRes = await page.request.get(`${BASE}/api/profile`, {
      headers: { Cookie: `session=${cookieValue}` },
    });
    const profile = await profileRes.json();
    console.log('[DEBUG] Profile:', JSON.stringify(profile, null, 2));

    await page.screenshot({ path: '/tmp/opencode/after-full-cutscene.png' });
  });
});
