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
  page.on('crash', () => console.log('PAGE CRASHED'));

  console.log('Loading...');
  await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForTimeout(10000);

  // Dismiss modals
  await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.includes('Got it')) { b.click(); break; } });
  await page.waitForTimeout(1000);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate(() => { for (const b of document.querySelectorAll('button')) if (b.textContent.includes('\u00d7')) b.click(); });
  await page.waitForTimeout(500);
  await page.evaluate(() => { const c = document.querySelector('canvas'); if (c && !document.pointerLockElement) c.requestPointerLock(); });
  await page.waitForTimeout(500);

  const rot = async (mx, my) => {
    for (let i = 0; i < 8; i++) {
      await page.evaluate(({ a, b }) => {
        document.querySelector('canvas')?.dispatchEvent(new PointerEvent('pointermove', { movementX: a, movementY: b, bubbles: true }));
      }, { a: Math.round(mx / 8), b: Math.round(my / 8) });
      await page.waitForTimeout(25);
    }
    await page.waitForTimeout(500);
  };

  const walk = async (keys, ms) => {
    for (const k of keys) await page.keyboard.down(k).catch(() => {});
    await page.waitForTimeout(ms).catch(() => {});
    for (const k of keys) await page.keyboard.up(k).catch(() => {});
    await page.waitForTimeout(300);
  };

  // Concrete building (-5.7, 4) south face
  await walk(['w'], 540);
  await rot(-140, -160);
  await page.screenshot({ path: '/tmp/wt_01_concrete.png' }).catch(() => {});
  console.log('01: concrete');

  // Brick (6, 4) south face
  await walk(['d'], 810);
  await rot(0, -160);
  await page.screenshot({ path: '/tmp/wt_02_brick.png' }).catch(() => {});
  console.log('02: brick');

  // Slate top (18.5, 4)
  await walk(['d'], 1000);
  await rot(-20, -160);
  await page.screenshot({ path: '/tmp/wt_03_slate.png' }).catch(() => {});
  console.log('03: slate');

  // Wood (18.5, -11.75) — walk south
  await walk(['s'], 1100);
  await rot(-30, -130);
  await page.screenshot({ path: '/tmp/wt_04_wood.png' }).catch(() => {});
  console.log('04: wood');

  await browser.close();
  console.log('Done');
})();
