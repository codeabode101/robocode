const { chromium } = require('playwright');
const fs = require('fs');

const SITE = 'https://robocode.rahejaom.workers.dev';
const OUT = '/tmp/test';
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
          const steps = 8;
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
// Camera pitch starts at 0.8 rad (~46° down). movementY=-160 → horizontal. movementY=-200 → looking up ~20°.
//
// Road layout (gaps between grass blocks):
//   Horizontal roads at y=[-1,1], y=[-9.5,-7], y=[7,10]
//   Vertical roads at x=[-1,1], x=[11,13]
// Buildings are ON grass blocks. Stand on ADJACENT road, NOT on grass.
// Key: walk shorter distances — player collision stops at grass edge.
//
// Buildings:
//   Concrete: (-5.7, 4), w=8, d=4.5 → south face y=1.75, east face x=-1.7
//   Brick:    (6, 4), w=8.5, d=4.5 → south face y=1.75
//   Slate top: (18.5, 4), w=9, d=4.5 → south face y=1.75, west face x=14
//   Slate mid: (18.5, -4), w=9, d=4.5 → south face y=-6.25, west face x=14
//   Wood:     (18.5, -11.75), w=9, d=3.5 → north face y=-10, west face x=14
//
// Walk helper: ms = units * 135

const scenes = [
  // 1: Spawn view
  async (s) => {
    await s.shot('01_spawn');
  },
  // 2: Concrete (-5.7, 4) south face — stand at (0, -3), look northwest
  async (s) => {
    await s.walk(['w'], 540);
    await s.rot(-140, -160); await s.shot('02_concrete');
  },
  // 3: Brick (6, 4) south face — stand at (6, -3), look north
  async (s) => {
    await s.walk(['s'], 135);
    await s.walk(['d'], 810);
    await s.walk(['w'], 675);
    await s.rot(0, -160); await s.shot('03_brick');
  },
  // 4: Slate top (18.5, 4) — stand at (13, -3), look northeast
  async (s) => {
    await s.walk(['s'], 135);
    await s.walk(['d'], 1755);
    await s.walk(['w'], 675);
    await s.rot(-20, -160); await s.shot('04_slate_top');
  },
  // 5: Concrete east face — stand at (-1, 4), look west
  async (s) => {
    await s.walk(['w'], 1485);
    await s.rot(180, -160); await s.shot('05_concrete_east');
  },
  // 6: Wood (18.5, -11.75) south face — stand at (13, -8), look southeast
  async (s) => {
    await s.walk(['s'], 135);
    await s.walk(['d'], 1755);
    await s.rot(-20, -130); await s.shot('06_wood');
  },
];

(async () => {
  log(`Running ${scenes.length} scenes (max ${MAX_RETRIES} retries each)`);
  let passed = 0, failed = 0;
  for (let i = 0; i < scenes.length; i++) {
    log(`\nScene ${i + 1}/${scenes.length}`);
    const ok = await runScene(i + 1, scenes[i]);
    if (ok) passed++; else failed++;
  }

  log('\n=== Final Results ===');
  const files = fs.readdirSync('/tmp').filter(f => /^test_\d{2}_/.test(f) && f.endsWith('.png'));
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
