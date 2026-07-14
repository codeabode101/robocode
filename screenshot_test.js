const { chromium } = require('playwright');
const fs = require('fs');

const SITE = 'https://robocode.rahejaom.workers.dev';
const OUT = '/tmp/test';

(async () => {
  const envContent = fs.readFileSync('.dev.vars', 'utf-8');
  const match = envContent.match(/WORKOS_API_KEY=(.+)/);
  const key = match[1].trim();
  const { SignJWT } = await import('jose');
  const jwt = await new SignJWT({ sub: 'test-user-id' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(key));

  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  await ctx.addCookies([{
    name: 'session', value: jwt,
    domain: 'robocode.rahejaom.workers.dev', path: '/',
    httpOnly: true, secure: true,
  }]);

  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', err => errors.push(err.message));

  console.log('Loading game...');
  await page.goto(`${SITE}/game`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForTimeout(5000);

  // === Helpers ===
  async function dismissModals() {
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.includes('Got it')) { btn.click(); break; }
      }
    });
    await page.waitForTimeout(500);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
    await page.evaluate(() => {
      for (const btn of document.querySelectorAll('button')) {
        if (btn.textContent.includes('\u00d7')) btn.click();
      }
    });
    await page.waitForTimeout(300);
  }

  async function acquirePointerLock() {
    await page.evaluate(() => {
      const canvas = document.querySelector('canvas');
      if (canvas && !document.pointerLockElement) canvas.requestPointerLock();
    });
    await page.waitForTimeout(300);
  }

  async function rotateCamera(movementX, movementY, steps = 5) {
    for (let i = 0; i < steps; i++) {
      await page.evaluate(({ mx, my }) => {
        const canvas = document.querySelector('canvas');
        if (!canvas) return;
        canvas.dispatchEvent(new PointerEvent('pointermove', {
          movementX: mx, movementY: my, bubbles: true, cancelable: true,
        }));
      }, { mx: Math.round(movementX / steps), my: Math.round(movementY / steps) });
      await page.waitForTimeout(50);
    }
    await page.waitForTimeout(200);
  }

  async function walk(keys, ms) {
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(ms);
    for (const k of keys) await page.keyboard.up(k);
    await page.waitForTimeout(100);
  }

  async function screenshot(label) {
    const path = `${OUT}_${label}.png`;
    await page.screenshot({ path });
    console.log(`  -> ${path}`);
  }

  // === Test sequence ===
  await dismissModals();
  await acquirePointerLock();
  await screenshot('01_spawn');

  // North toward top-left building (-5.7, 4)
  console.log('--- Top-left building ---');
  await walk(['w'], 3000);
  await rotateCamera(-200, -50);
  await screenshot('02_topleft_north');
  await walk(['a'], 2000);
  await rotateCamera(-150, -60);
  await screenshot('03_topleft_close');

  // East to top-center building (6, 4)
  console.log('--- Top-center building ---');
  await walk(['d'], 6000);
  await rotateCamera(0, -70);
  await screenshot('04_topcenter');

  // East to top-right building (18.5, 4)
  console.log('--- Top-right building ---');
  await walk(['d'], 7000);
  await rotateCamera(100, -60);
  await screenshot('05_topright');

  // South to mid-right building (18.5, -4)
  console.log('--- Mid-right building ---');
  await walk(['s'], 5000);
  await rotateCamera(80, 20);
  await screenshot('06_midright');

  // South to bottom-right building (18.5, -11.75)
  console.log('--- Bottom-right building ---');
  await walk(['s'], 6000);
  await rotateCamera(60, 40);
  await screenshot('07_bottomright');

  // Walk back west, look at buildings from the road
  console.log('--- Road view ---');
  await walk(['a'], 10000);
  await rotateCamera(0, -40);
  await screenshot('08_road_west');

  // === Summary ===
  console.log('\n=== Results ===');
  if (errors.length > 0) console.log('Page errors:', errors);
  else console.log('No page errors');

  const files = fs.readdirSync('/tmp').filter(f => f.startsWith('test_') && f.endsWith('.png'));
  console.log(`Screenshots: ${files.length}`);
  for (const f of files.sort()) {
    const s = fs.statSync(`/tmp/${f}`);
    console.log(`  ${f} (${(s.size / 1024).toFixed(0)} KB)`);
  }

  await browser.close();
  console.log('Done!');
})().catch(e => { console.error('FATAL:', e); process.exit(1); });
