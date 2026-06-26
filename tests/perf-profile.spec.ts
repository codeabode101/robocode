import { test, chromium } from '@playwright/test';

test('capture slow logic frames', async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--use-gl=angle'] });
  const page = await browser.newPage();

  const email = `perftest_${Date.now()}@test.com`;
  const res = await page.request.post('https://robocode.rahejaom.workers.dev/api/auth/signup', {
    data: { email, password: 'TestPass123!', name: 'PerfTest' }
  });
  console.log(`Signup: ${res.status()}`);

  await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.keyboard.press('F3');
  await page.waitForTimeout(1000);

  // Monitor every 3 seconds
  for (let i = 0; i < 10; i++) {
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => (window as any).__perfStats?.report());
    if (r) {
      console.log(`t=${(i+1)*3}s: frames=${r.frames} maxL=${r.maxLogic}ms slowL=${r.slowLogic} slowR=${r.slowRender}`);
      if (r.lastSlowLogic && r.lastSlowLogic.length > 0) {
        for (const d of r.lastSlowLogic) {
          console.log(`  SLOW LOGIC: frame=${d.frame} logic=${d.logicMs}ms render=${d.renderMs}ms room=${d.room} moving=${d.moving}`);
        }
      }
    }
  }

  // Walk around
  console.log('\n=== WALKING ===');
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(3000);
    const r = await page.evaluate(() => (window as any).__perfStats?.report());
    if (r) {
      console.log(`walk ${i+1}: frames=${r.frames} maxL=${r.maxLogic}ms slowL=${r.slowLogic}`);
      if (r.lastSlowLogic && r.lastSlowLogic.length > 0) {
        for (const d of r.lastSlowLogic) {
          console.log(`  SLOW LOGIC: frame=${d.frame} logic=${d.logicMs}ms render=${d.renderMs}ms room=${d.room} moving=${d.moving}`);
        }
      }
    }
  }
  await page.keyboard.up('KeyW');

  // Final report
  const final = await page.evaluate(() => (window as any).__perfStats?.report());
  console.log(`\nFINAL:`);
  console.log(`  frames=${final.frames} fps=${final.fps}`);
  console.log(`  avgLogic=${final.avgLogic}ms maxLogic=${final.maxLogic}ms`);
  console.log(`  avgRender=${final.avgRender}ms maxRender=${final.maxRender}ms`);
  console.log(`  draws=${final.drawCalls} tris=${final.triangles}`);
  console.log(`  reactRenders=${final.reactRenders}`);
  console.log(`  slowLogic=${final.slowLogic} slowRender=${final.slowRender}`);
  if (final.lastSlowLogic && final.lastSlowLogic.length > 0) {
    console.log(`  Slow logic details:`);
    for (const d of final.lastSlowLogic) {
      console.log(`    frame=${d.frame} logic=${d.logicMs}ms render=${d.renderMs}ms room=${d.room} moving=${d.moving}`);
    }
  }

  await browser.close();
});
