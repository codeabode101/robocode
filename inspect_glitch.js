const { chromium } = require('playwright');
const fs = require('fs');

const SITE = 'https://robocode.rahejaom.workers.dev';
const OUT = '/tmp/glitch';

async function run() {
  const envContent = fs.readFileSync('.dev.vars', 'utf-8');
  const match = envContent.match(/WORKOS_API_KEY=(.+)/);
  const key = match[1].trim();
  const { SignJWT } = await import('jose');
  const jwt = await new SignJWT({ sub: 'test-user-id' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(key));

  const browser = await chromium.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--enable-unsafe-swiftshader', '--use-gl=angle', '--use-angle=swiftshader-webgl'],
  });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addCookies([{
    name: 'session', value: jwt,
    domain: 'robocode.rahejaom.workers.dev', path: '/',
    httpOnly: true, secure: true,
  }]);

  const page = await ctx.newPage();
  await page.goto(`${SITE}/game`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(3000);
  await page.reload({ waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000);

  // Dismiss modals
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button'))
      if (b.textContent.includes('Got it')) { b.click(); break; }
  });
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button'))
      if (b.textContent.includes('\u00d7')) b.click();
  });
  await page.waitForTimeout(200);

  // Acquire pointer lock
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (c && !document.pointerLockElement) c.requestPointerLock();
  });
  await page.waitForTimeout(200);

  const rot = async (mx, my) => {
    const steps = 8;
    for (let i = 0; i < steps; i++) {
      await page.evaluate(({ a, b }) => {
        const c = document.querySelector('canvas');
        if (c) c.dispatchEvent(new PointerEvent('pointermove', { movementX: a, movementY: b, bubbles: true }));
      }, { a: Math.round(mx / steps), b: Math.round(my / steps) });
      await page.waitForTimeout(20);
    }
    await page.waitForTimeout(150);
  };

  const walk = async (keys, ms) => {
    const CHUNK = 2000;
    let rem = ms;
    while (rem > 0) {
      const dur = Math.min(CHUNK, rem);
      for (const k of keys) await page.keyboard.down(k);
      await page.waitForTimeout(dur);
      for (const k of keys) await page.keyboard.up(k);
      await page.waitForTimeout(50);
      rem -= dur;
    }
  };

  const shot = async (label) => {
    await page.screenshot({ path: `${OUT}_${label}.png` });
    console.log(`  -> ${label}`);
  };

  // From spawn (0, -7): walk to (13, -10) area
  // South 3u to y=-10 (405ms), east 13u to x=13 (1755ms)
  // Player should end up on the road between parts shop and wood building
  await walk(['s'], 405);
  await walk(['d'], 1755);

  // Multiple angles looking around
  await rot(0, -160); // default pitch, look straight
  await shot('01_at_13_neg10_default');

  await rot(0, -220); // look more up
  await shot('02_at_13_neg10_looking_up');

  await rot(-50, -160); // look left toward parts shop
  await shot('03_at_13_neg10_looking_left_parts_shop');

  await rot(50, -160); // look right toward wood building
  await shot('04_at_13_neg10_looking_right_wood');

  await rot(-90, -160); // look fully left (west)
  await shot('05_at_13_neg10_west');

  await rot(90, -160); // look fully right (east)
  await shot('06_at_13_neg10_east');

  await rot(0, -300); // look almost straight up
  await shot('07_at_13_neg10_straight_up');

  await rot(0, 0); // look down
  await shot('08_at_13_neg10_looking_down');

  // Now walk a bit closer to (13, -10) and look around
  // We're at (13, -10) - walk slightly south to see the south side
  await walk(['s'], 270); // 2 units south to y=-12
  await rot(0, -160);
  await shot('09_south_of_gap');

  // Walk north
  await walk(['w'], 540); // north 4 units to y=-8
  await rot(0, -160);
  await shot('10_north_of_gap');

  // Now walk to (13, -7) - on the road between parts shop and buildings
  // Look at the buildings from the road
  await rot(-135, -160); // look northwest toward parts shop
  await shot('11_looking_nw_parts_shop');

  await rot(45, -160); // look northeast
  await shot('12_looking_ne');

  await browser?.close();
  console.log('Done');
}

run().catch(e => { console.error(e); process.exit(1); });
