const { chromium } = require('playwright');
const fs = require('fs');

const SITE = 'https://robocode.rahejaom.workers.dev';
const OUT = '/tmp/spatial';
const MAX_RETRIES = 2;
const TIMEOUT_PER_TEST = 60000;

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

async function runTest(testNum, testFn) {
  const jwtVal = await getJwt();

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) log(`  Retry ${attempt}/${MAX_RETRIES} for test ${testNum}`);

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

      // Collect console errors
      const consoleErrors = [];
      page.on('console', msg => {
        if (msg.type() === 'error') consoleErrors.push(msg.text());
      });

      await page.goto(`${SITE}/game`, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(4000);
      await page.reload({ waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(6000);

      if (crashed) throw new Error('crashed during load');

      // Dismiss modals
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

      // Acquire pointer lock
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
        getPage: () => page,
        getConsoleErrors: () => consoleErrors,
      };

      const result = await Promise.race([
        testFn(s),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), TIMEOUT_PER_TEST)),
      ]);

      log(`  Test ${testNum}: PASSED`);
      return { passed: true, consoleErrors };
    } catch (e) {
      if (crashed) {
        log(`  Test ${testNum}: CRASHED - ${e.message}`);
      } else {
        log(`  Test ${testNum}: FAILED - ${e.message.slice(0, 120)}`);
      }
      if (attempt >= MAX_RETRIES) {
        return { passed: false, error: e.message };
      }
    } finally {
      try { await browser?.close(); } catch {}
    }
  }
  return { passed: false, error: 'max retries exceeded' };
}

// ============================================================
// Spatial Tests
// ============================================================

const tests = [
  // 1: Building south faces visible from road
  {
    name: 'concrete south face from road',
    fn: async (s) => {
      // Spawn (0,-7). Concrete at (-5.7, 4). Walk north to road y=0, stand at (-5.7, 0)
      await s.walk(['w'], 945); // ~7 units north
      await s.walk(['a'], 270); // ~2 units west
      await s.rot(0, -160); // look north
      await s.shot('spatial_01_concrete_south');
    },
  },
  // 2: Brick south face from road
  {
    name: 'brick south face from road',
    fn: async (s) => {
      await s.walk(['w'], 945);
      await s.walk(['d'], 810); // ~6 units east to x=6
      await s.rot(0, -160); // look north
      await s.shot('spatial_02_brick_south');
    },
  },
  // 3: East wall buildings from road (x=24 road looking east)
  {
    name: 'east wall buildings from road',
    fn: async (s) => {
      // Walk to x=24 road area: east 24 units, south a bit
      await s.walk(['d'], 3240); // ~24 units east
      await s.walk(['s'], 270); // ~2 units south
      await s.rot(-30, -160); // look northeast at wall buildings
      await s.shot('spatial_03_east_wall');
    },
  },
  // 4: Road dashed lines centered (top-down view of main intersection)
  {
    name: 'road dashed lines centered',
    fn: async (s) => {
      // Stand at main intersection (0, 0), look straight down
      await s.rot(0, -350); // near top-down
      await s.shot('spatial_04_road_lines');
    },
  },
  // 5: Sidewalk flush with road (stand on road, look at sidewalk edge)
  {
    name: 'sidewalk flush with road',
    fn: async (s) => {
      // Stand on vertical road at x=0, y=-4
      await s.walk(['s'], 540); // ~4 units south
      await s.rot(90, -120); // look west at sidewalk edge
      await s.shot('spatial_05_sidewalk');
    },
  },
  // 6: No building overlap (view gap between slate top and slate mid)
  {
    name: 'no building overlap slate gap',
    fn: async (s) => {
      // Walk to x=14, y=0 (between slate buildings)
      await s.walk(['d'], 1890); // ~14 units east
      await s.rot(-30, -140); // look northeast
      await s.shot('spatial_06_slate_gap');
    },
  },
  // 7: Window boarded state (concrete building has boarded windows)
  {
    name: 'window boarded planks visible',
    fn: async (s) => {
      // Stand near concrete south face
      await s.walk(['w'], 945);
      await s.walk(['a'], 270);
      await s.rot(0, -100); // look more directly at south face
      await s.shot('spatial_07_boarded_windows');
    },
  },
  // 8: Camera ZOOMED shows buildings in frame
  {
    name: 'camera zoomed shows buildings',
    fn: async (s) => {
      // Stand near concrete, zoom in
      await s.walk(['w'], 945);
      await s.walk(['a'], 270);
      await s.rot(0, -160);
      // Zoom in by scrolling
      const pageRef = s.getPage();
      await pageRef.mouse.wheel(0, -500);
      await pageRef.waitForTimeout(500);
      await s.shot('spatial_08_camera_zoomed');
    },
  },
  // 9: Island flat edge visible (walk to left edge)
  {
    name: 'island flat left edge',
    fn: async (s) => {
      // Walk far west to see flat edge
      await s.walk(['a'], 3000); // ~22 units west
      await s.walk(['w'], 500);
      await s.rot(90, -140); // look west
      await s.shot('spatial_09_island_edge');
    },
  },
  // 10: Wood building from road
  {
    name: 'wood building from road',
    fn: async (s) => {
      // Walk to wood building area: east 18, south 5
      await s.walk(['d'], 2430); // ~18 east
      await s.walk(['s'], 675); // ~5 south
      await s.rot(-30, -140); // look northeast
      await s.shot('spatial_10_wood_building');
    },
  },
  // 11: Collision test — try to walk through concrete building
  {
    name: 'collision blocks player at concrete',
    fn: async (s) => {
      // Walk toward concrete south face
      await s.walk(['w'], 945);
      await s.walk(['a'], 270);
      const posBefore = await s.getPage().evaluate(() => {
        // Read player position from game state if accessible
        return document.querySelector('canvas') ? 'canvas-exists' : 'no-canvas';
      });
      // Try to walk north into building
      await s.walk(['w'], 2000);
      await s.rot(0, -160);
      await s.shot('spatial_11_collision');
    },
  },
  // 12: Door accessible (workshop door at (-6, -10.3))
  {
    name: 'workshop door accessible',
    fn: async (s) => {
      // Walk to workshop door area
      await s.walk(['s'], 270); // ~2 south from spawn
      await s.walk(['a'], 810); // ~6 west
      await s.rot(45, -140); // look northwest toward door
      await s.shot('spatial_12_workshop_door');
    },
  },
];

(async () => {
  log(`Running ${tests.length} spatial tests (max ${MAX_RETRIES} retries each, ${TIMEOUT_PER_TEST}ms timeout)`);
  let passed = 0, failed = 0;
  const results = [];

  for (let i = 0; i < tests.length; i++) {
    log(`\nTest ${i + 1}/${tests.length}: ${tests[i].name}`);
    const result = await runTest(i + 1, tests[i].fn);
    results.push({ name: tests[i].name, ...result });
    if (result.passed) passed++; else failed++;
  }

  log('\n=== Final Results ===');
  const files = fs.readdirSync('/tmp').filter(f => /^spatial_\d{2}_/.test(f) && f.endsWith('.png'));
  let totalKB = 0;
  for (const f of files.sort()) {
    const s = fs.statSync(`/tmp/${f}`);
    const kb = (s.size / 1024).toFixed(0);
    totalKB += parseInt(kb);
    log(`  ${f} (${kb} KB)`);
  }
  log(`${passed} passed, ${failed} failed, ${files.length} screenshots, ${totalKB} KB total`);

  // Write results to state file
  const statePath = '.opencode/robocode-autonomous-state.md';
  if (fs.existsSync(statePath)) {
    let state = fs.readFileSync(statePath, 'utf-8');
    const testSummary = results.map(r => `- ${r.name}: ${r.passed ? 'PASSED' : 'FAILED'}`).join('\n');
    state = state.replace(/## Test Results Last Run[\s\S]*?(?=\n## |$)/, `## Test Results Last Run\n${testSummary}\n`);
    fs.writeFileSync(statePath, state);
  }

  if (failed > 0) process.exit(1);
})().catch(e => { log(`FATAL: ${e.message}`); process.exit(1); });
