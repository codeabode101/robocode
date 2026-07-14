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
      rot: async (mx, my) => {
        if (crashed) throw new Error('crashed');
        for (let i = 0; i < 4; i++) {
          await page.evaluate(({ a, b }) => {
            const c = document.querySelector('canvas');
            if (c) c.dispatchEvent(new PointerEvent('pointermove', { movementX: a, movementY: b, bubbles: true }));
          }, { a: Math.round(mx / 4), b: Math.round(my / 4) });
          await page.waitForTimeout(25);
        }
        await page.waitForTimeout(100);
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

const scenes = [
  // 1: Spawn + top-left building (-5.7, 4)
  async (s) => {
    await s.shot('01_spawn');
    await s.walk(['w'], 3000); await s.walk(['a'], 2000);
    await s.rot(-160, -30); await s.shot('02_topleft_east');
    await s.rot(100, 10);   await s.shot('03_topleft_south');
    await s.rot(-40, -20);  await s.shot('04_topleft_close');
  },
  // 2: Top-center building (6, 4)
  async (s) => {
    await s.walk(['w'], 3000); await s.walk(['d'], 2000);
    await s.rot(0, -40);    await s.shot('05_topcenter_south');
    await s.rot(-130, -20); await s.shot('06_topcenter_east');
    await s.rot(130, -10);  await s.shot('07_topcenter_west');
  },
  // 3: Top-right building (18.5, 4)
  async (s) => {
    await s.walk(['w'], 3000); await s.walk(['d'], 4000);
    await s.rot(0, -30);    await s.shot('08_topright_south');
    await s.rot(-150, -20); await s.shot('09_topright_east');
    await s.rot(150, -10);  await s.shot('10_topright_west');
  },
  // 4: Mid-right building (18.5, -4)
  async (s) => {
    await s.walk(['d'], 4000); await s.walk(['w'], 800);
    await s.rot(0, 15);     await s.shot('11_midright_north');
    await s.rot(-140, 10);  await s.shot('12_midright_east');
    await s.rot(140, 0);    await s.shot('13_midright_west');
  },
  // 5: Bottom-right building (18.5, -11.75)
  async (s) => {
    await s.walk(['d'], 4000); await s.walk(['s'], 2000);
    await s.rot(0, 25);     await s.shot('14_bottomright_north');
    await s.rot(-140, 10);  await s.shot('15_bottomright_east');
    await s.rot(140, 10);   await s.shot('16_bottomright_west');
  },
  // 6: Arena (18.75, -12)
  async (s) => {
    await s.walk(['d'], 4000); await s.walk(['s'], 2000);
    await s.rot(180, 0);    await s.shot('17_arena_south');
    await s.rot(-80, -15);  await s.shot('18_arena_east');
    await s.rot(80, -10);   await s.shot('19_arena_west');
  },
  // 7: Parts shop (6, -12)
  async (s) => {
    await s.walk(['d'], 2000); await s.walk(['s'], 2000);
    await s.rot(180, 10);   await s.shot('20_parts_south');
    await s.rot(-80, -10);  await s.shot('21_parts_east');
  },
  // 8: Workshop (-6, -11.8)
  async (s) => {
    await s.walk(['a'], 2000); await s.walk(['s'], 2000);
    await s.rot(180, 10);   await s.shot('22_workshop_south');
    await s.rot(80, -10);   await s.shot('23_workshop_east');
  },
  // 9: Apartment (-6, -3.5)
  async (s) => {
    await s.walk(['a'], 2000); await s.walk(['w'], 800);
    await s.rot(0, -15);    await s.shot('24_apt_south');
    await s.rot(-80, -10);  await s.shot('25_apt_east');
  },
  // 10: Lake (6, -4)
  async (s) => {
    await s.walk(['d'], 2000); await s.walk(['w'], 800);
    await s.rot(0, -10);    await s.shot('26_lake_south');
    await s.rot(-90, -20);  await s.shot('27_lake_east');
  },
  // 11: Bazaar + road
  async (s) => {
    await s.walk(['d'], 2000); await s.walk(['s'], 1000);
    await s.rot(0, 10);     await s.shot('28_bazaar_south');
    await s.rot(-120, -10); await s.shot('29_bazaar_east');
    await s.rot(150, -10);  await s.shot('30_road_view');
  },
];

(async () => {
  log(`Running ${scenes.length} scenes (2 shots each, fresh browser per scene)`);
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
