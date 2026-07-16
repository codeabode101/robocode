const { chromium } = require('playwright');
const fs = require('fs');

const SITE = 'https://robocode.rahejaom.workers.dev';
const OUT = '/tmp/camtest';
const MAX_RETRIES = 2;

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }

let jwt = null;

async function getJwt() {
  if (jwt) return jwt;
  const envContent = fs.readFileSync('.dev.vars', 'utf-8');
  const match = envContent.match(/WORKOS_API_KEY=(.+)/);
  const key = match[1].trim();
  const { SignJWT } = await import('jose');
  jwt = await new SignJWT({ sub: 'test-user-id' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(key));
  return jwt;
}

async function launchBrowser() {
  return chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu-sandbox',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader-webgl',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  });
}

async function runScene(sceneNum, sceneFn) {
  const jwtVal = await getJwt();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) log(`  Retry ${attempt}/${MAX_RETRIES} for scene ${sceneNum}`);

    let browser, page;
    let crashed = false;

    try {
      browser = await launchBrowser();
      const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
      await ctx.addCookies([{
        name: 'session', value: jwtVal,
        domain: 'robocode.rahejaom.workers.dev', path: '/',
        httpOnly: true, secure: true,
      }]);

      page = await ctx.newPage();
      page.on('crash', () => { crashed = true; log(`  !! PAGE CRASHED`); });

      await page.goto(`${SITE}/game`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(4000);
      await page.reload({ waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(6000);

      if (crashed) throw new Error('crashed during load');

      await page.evaluate(() => {
        for (const b of document.querySelectorAll('button'))
          if (b.textContent.includes('Got it')) { b.click(); break; }
      });
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      await page.evaluate(() => {
        for (const b of document.querySelectorAll('button'))
          if (b.textContent.includes('\u00d7')) b.click();
      });
      await page.waitForTimeout(300);

      await page.evaluate(() => {
        const c = document.querySelector('canvas');
        if (c && !document.pointerLockElement) c.requestPointerLock();
      });
      await page.waitForTimeout(300);

      if (crashed) throw new Error('crashed during init');

      const s = {
        walk: async (keys, ms) => {
          if (crashed) throw new Error('crashed');
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
        },
        rot: async (mx, my) => {
          if (crashed) throw new Error('crashed');
          const steps = 12;
          for (let i = 0; i < steps; i++) {
            await page.evaluate(({ a, b }) => {
              const c = document.querySelector('canvas');
              if (c) c.dispatchEvent(new PointerEvent('pointermove', { movementX: a, movementY: b, bubbles: true }));
            }, { a: Math.round(mx / steps), b: Math.round(my / steps) });
            await page.waitForTimeout(20);
          }
          await page.waitForTimeout(200);
        },
        shot: async (label) => {
          if (crashed) throw new Error('crashed');
          const t0 = Date.now();
          await page.screenshot({ path: `${OUT}_${label}.png` });
          const dt = Date.now() - t0;
          const size = (fs.statSync(`${OUT}_${label}.png`).size / 1024).toFixed(0);
          log(`  -> ${label} (${size}KB, ${dt}ms)`);
        },
      };

      await sceneFn(s);
      log(`  Scene ${sceneNum}: OK`);
      return true;
    } catch (e) {
      if (crashed) {
        log(`  Scene ${sceneNum}: CRASHED - ${e.message}`);
      } else {
        log(`  Scene ${sceneNum}: ERROR - ${e.message.slice(0, 120)}`);
      }
      if (attempt >= MAX_RETRIES) {
        log(`  Scene ${sceneNum}: GAVE UP after ${MAX_RETRIES + 1} attempts`);
        return false;
      }
    } finally {
      try { await browser?.close(); } catch {}
    }
  }
  return false;
}

// Spawn: (0, -7). Move speed: ~7.4 units/sec → 135ms per unit.
// Camera pitch starts at 0.8 rad (~46° down). movementY=-130 → nearly horizontal.
//
// TEST: Walk right up to each building's wall, rotate camera INTO the building.
// If camera push-out works, we see wall surface — NOT the interior.
// If broken, we see inside (floor, back walls, sky through gaps).

const scenes = [
  // 1: Concrete east face — walk to (0, 3), rotate INTO building (look west)
  async (s) => {
    await s.walk(['w'], 1350);
    await s.rot(200, -130);
    await s.shot('01_concrete_into');
  },
  // 2: Concrete south face — walk to (0, 1), rotate INTO building (look north)
  async (s) => {
    await s.walk(['w'], 1080);
    await s.rot(0, -130);
    await s.shot('02_concrete_south_into');
  },
  // 3: Brick south face — walk to (6, 1), rotate INTO building (look north)
  async (s) => {
    await s.walk(['s'], 135);
    await s.walk(['d'], 810);
    await s.walk(['w'], 1215);
    await s.rot(0, -130);
    await s.shot('03_brick_south_into');
  },
  // 4: Slate top west face — walk to (13, 4), rotate INTO building (look east)
  async (s) => {
    await s.walk(['s'], 135);
    await s.walk(['d'], 1755);
    await s.walk(['w'], 1485);
    await s.rot(-200, -130);
    await s.shot('04_slate_west_into');
  },
  // 5: Slate mid south face — walk to (13, -5), rotate INTO building (look northeast)
  async (s) => {
    await s.walk(['s'], 135);
    await s.walk(['d'], 1755);
    await s.walk(['w'], 270);
    await s.rot(-100, -130);
    await s.shot('05_slate_mid_into');
  },
  // 6: Wood north face — walk to (13, -9), rotate INTO building (look southeast)
  async (s) => {
    await s.walk(['s'], 135);
    await s.walk(['d'], 1755);
    await s.walk(['w'], 270);
    await s.rot(-100, -130);
    await s.shot('06_wood_north_into');
  },
];

(async () => {
  log(`Running ${scenes.length} camera-into-building tests (max ${MAX_RETRIES} retries each)`);
  let passed = 0, failed = 0;
  for (let i = 0; i < scenes.length; i++) {
    log(`\nScene ${i + 1}/${scenes.length}`);
    const ok = await runScene(i + 1, scenes[i]);
    if (ok) passed++; else failed++;
  }

  log('\n=== Final Results ===');
  const files = fs.readdirSync('/tmp').filter(f => /^camtest_\d{2}_/.test(f) && f.endsWith('.png'));
  let totalKB = 0;
  for (const f of files.sort()) {
    const s = fs.statSync(`/tmp/${f}`);
    const kb = (s.size / 1024).toFixed(0);
    totalKB += parseInt(kb);
    log(`  ${f} (${kb} KB)`);
  }
  log(`${passed} passed, ${failed} failed, ${files.length} screenshots, ${totalKB} KB total`);
  if (failed > 0) process.exit(1);
})().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });
