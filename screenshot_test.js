const { chromium } = require('playwright');
const fs = require('fs');

const SITE = 'https://robocode.rahejaom.workers.dev';
const OUT = '/tmp/test';

function log(msg) { console.log(`[${new Date().toISOString().slice(11,19)}] ${msg}`); }

async function runScene(sceneNum, sceneFn) {
  const envContent = fs.readFileSync('.dev.vars', 'utf-8');
  const match = envContent.match(/WORKOS_API_KEY=(.+)/);
  const key = match[1].trim();
  const { SignJWT } = await import('jose');
  const jwt = await new SignJWT({ sub: 'test-user-id' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(new TextEncoder().encode(key));

  let browser, page;
  let crashed = false;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage'],
    });
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    await ctx.addCookies([{
      name: 'session', value: jwt,
      domain: 'robocode.rahejaom.workers.dev', path: '/',
      httpOnly: true, secure: true,
    }]);

    page = await ctx.newPage();
    page.on('crash', () => { crashed = true; log(`  !! PAGE CRASHED`); });

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
      // rot(movementX, movementY) — use large negative movementY to tilt camera horizontal
      // movementY of -140 brings pitch from 0.8 to ~0.1 (nearly horizontal)
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
        await page.waitForTimeout(150);
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
  } catch (e) {
    if (crashed) {
      log(`  Scene ${sceneNum}: CRASHED - ${e.message}`);
    } else {
      log(`  Scene ${sceneNum}: ERROR - ${e.message.slice(0, 100)}`);
    }
  } finally {
    try { await browser?.close(); } catch {}
  }
}

// Strategy for each scene:
// 1. Walk to position NEAR the building (but with some distance)
// 2. Rotate yaw to face the building
// 3. Tilt camera to ~horizontal (movementY ~ -140)
// 4. Take shot

const scenes = [
  // 1: Top-left building (-5.7, 4) — walk north+west, stop short, face east toward it
  async (s) => {
    await s.shot('01_spawn');
    // Walk north to y~2, west to x~-3 (stop ~3 units east of building)
    await s.walk(['w'], 2500); await s.walk(['a'], 1500);
    // Face east toward building, tilt horizontal
    await s.rot(-180, -130); await s.shot('02_topleft_face');
    // Walk a bit closer
    await s.walk(['a'], 1000);
    await s.rot(0, -10); await s.shot('03_topleft_close');
  },
  // 2: Top-center building (6, 4) — walk north, stop south of it
  async (s) => {
    await s.walk(['w'], 2500); await s.walk(['d'], 2000);
    // Face north toward building, tilt horizontal
    await s.rot(0, -130); await s.shot('04_topcenter_face');
    await s.walk(['w'], 800);
    await s.rot(20, -10); await s.shot('05_topcenter_close');
  },
  // 3: Top-right building (18.5, 4) — walk north+east
  async (s) => {
    await s.walk(['w'], 2500); await s.walk(['d'], 4000);
    // Face north/east toward building
    await s.rot(0, -130); await s.shot('06_topright_face');
    await s.rot(-60, 0); await s.shot('07_topright_side');
  },
  // 4: Mid-right building (18.5, -4) — walk east, stop west of it
  async (s) => {
    await s.walk(['d'], 4000); await s.walk(['w'], 1200);
    // Face east toward building
    await s.rot(-180, -130); await s.shot('08_midright_face');
    await s.rot(0, 0); await s.shot('09_midright_north');
  },
  // 5: Bottom-right building (18.5, -11.75)
  async (s) => {
    await s.walk(['d'], 4000); await s.walk(['s'], 2000);
    await s.rot(-180, -130); await s.shot('10_bottomright_face');
    await s.rot(0, 0); await s.shot('11_bottomright_north');
  },
  // 6: Arena (18.75, -12) — walk east+south
  async (s) => {
    await s.walk(['d'], 4000); await s.walk(['s'], 2000);
    // We're near arena — face it
    await s.rot(160, -130); await s.shot('12_arena_face');
    await s.rot(-20, 0); await s.shot('13_arena_side');
  },
  // 7: Parts shop (6, -12) — walk east+south
  async (s) => {
    await s.walk(['d'], 2000); await s.walk(['s'], 2000);
    await s.rot(160, -130); await s.shot('14_parts_face');
    await s.rot(-20, 0); await s.shot('15_parts_side');
  },
  // 8: Workshop (-6, -11.8) — walk west+south
  async (s) => {
    await s.walk(['a'], 2000); await s.walk(['s'], 2000);
    await s.rot(-160, -130); await s.shot('16_workshop_face');
    await s.rot(20, 0); await s.shot('17_workshop_side');
  },
  // 9: Apartment (-6, -3.5) — stay far south, face north
  async (s) => {
    await s.walk(['a'], 1500); await s.walk(['s'], 500);
    await s.rot(0, -130); await s.shot('18_apt_face');
  },
  // 10: Lake (6, -4) — walk east
  async (s) => {
    await s.walk(['d'], 2000);
    await s.rot(0, -130); await s.shot('20_lake_face');
  },
  // 11: Road view — center of map
  async (s) => {
    await s.walk(['s'], 1000);
    await s.rot(-160, -130); await s.shot('21_road_west');
    await s.rot(320, 0); await s.shot('22_road_east');
  },
];

(async () => {
  log(`Running ${scenes.length} scenes with horizontal camera angles`);
  for (let i = 0; i < scenes.length; i++) {
    log(`\nScene ${i + 1}/${scenes.length}`);
    await runScene(i + 1, scenes[i]);
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
  log(`${files.length} screenshots, ${totalKB} KB total`);
})().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });
