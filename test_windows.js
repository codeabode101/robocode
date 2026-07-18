const { chromium } = require('playwright');
const fs = require('fs');
const { SignJWT } = require('jose') || {};

(async () => {
  const envContent = fs.readFileSync('.dev.vars', 'utf-8');
  const key = envContent.match(/WORKOS_API_KEY=(.+)/)[1].trim();
  const { SignJWT: SJ } = await import('jose');
  const jwt = await new SJ({ sub: 'test-user-id' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(key));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader-webgl']
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addCookies([{ name: 'session', value: jwt, domain: 'robocode.rahejaom.workers.dev', path: '/', httpOnly: true, secure: true }]);
  const page = await ctx.newPage();
  await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Dismiss modals
  await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.includes('Got it')) { b.click(); break; } });
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.includes('\u00d7')) b.click(); });
  await page.waitForTimeout(300);

  // Acquire pointer lock
  await page.evaluate(() => { const c = document.querySelector('canvas'); if (c && !document.pointerLockElement) c.requestPointerLock(); });
  await page.waitForTimeout(300);

  // Walk east toward buildings at x=18.5 — spawn is at (0,-7), move speed ~7.4 u/s
  // d key = east. 18 units east = ~2430ms
  await page.keyboard.down('d');
  await page.waitForTimeout(2430);
  await page.keyboard.up('d');
  await page.waitForTimeout(200);

  // Rotate camera to look north at building face
  for (let i = 0; i < 12; i++) {
    await page.evaluate(() => {
      document.querySelector('canvas')?.dispatchEvent(new PointerEvent('pointermove', { movementX: 0, movementY: -160, bubbles: true }));
    });
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/test_building_windows.png' });
  console.log('Screenshot saved: /tmp/test_building_windows.png');

  await browser.close();
})();
