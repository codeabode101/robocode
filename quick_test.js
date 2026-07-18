const { chromium } = require('playwright');
const fs = require('fs');

(async () => {
  const envContent = fs.readFileSync('.dev.vars', 'utf-8');
  const key = envContent.match(/WORKOS_API_KEY=(.+)/)[1].trim();
  const { SignJWT } = await import('jose');
  const jwt = await new SignJWT({ sub: 'test-user-id' }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(new TextEncoder().encode(key));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader-webgl']
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addCookies([{ name: 'session', value: jwt, domain: 'robocode.rahejaom.workers.dev', path: '/', httpOnly: true, secure: true }]);
  const page = await ctx.newPage();
  
  console.log('Loading...');
  await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(8000);

  // Dismiss modals
  await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.includes('Got it')) { b.click(); break; } });
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.includes('\u00d7')) b.click(); });
  await page.waitForTimeout(300);
  await page.evaluate(() => { const c = document.querySelector('canvas'); if (c && !document.pointerLockElement) c.requestPointerLock(); });
  await page.waitForTimeout(300);

  // Take spawn screenshot first
  await page.screenshot({ path: '/tmp/wt_01_spawn.png' });
  console.log('01: spawn');

  // Walk east ~10 units to get closer to buildings but not too close
  await page.keyboard.down('d');
  await page.waitForTimeout(1350);
  await page.keyboard.up('d');
  await page.waitForTimeout(200);

  // Rotate camera to look north at building from a distance
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => {
      document.querySelector('canvas')?.dispatchEvent(new PointerEvent('pointermove', { movementX: 0, movementY: -160, bubbles: true }));
    });
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/tmp/wt_02_east_north.png' });
  console.log('02: east looking north');

  // Now walk further east to x~13, then look at the slate building
  await page.keyboard.down('d');
  await page.waitForTimeout(400);
  await page.keyboard.up('d');
  await page.waitForTimeout(200);

  // Slight left rotation
  for (let i = 0; i < 3; i++) {
    await page.evaluate(() => {
      document.querySelector('canvas')?.dispatchEvent(new PointerEvent('pointermove', { movementX: -20, movementY: 0, bubbles: true }));
    });
    await page.waitForTimeout(30);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: '/tmp/wt_03_slate.png' });
  console.log('03: slate building');

  await browser.close();
  console.log('Done');
})();
