import { test, chromium } from '@playwright/test';

test('perf with react render tracking', async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--use-gl=angle'] });
  const page = await browser.newPage();

  const email = `perftest_${Date.now()}@test.com`;
  const res = await page.request.post('https://robocode.rahejaom.workers.dev/api/auth/signup', {
    data: { email, password: 'TestPass123!', name: 'PerfTest' }
  });
  console.log(`Signup: ${res.status()}`);

  await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(2000);

  // Enable perf overlay (F3)
  await page.keyboard.press('F3');
  await page.waitForTimeout(500);

  // Poll every 2 seconds
  for (let i = 0; i < 15; i++) {
    await page.waitForTimeout(2000);
    const report = await page.evaluate(() => {
      const s = (window as any).__perfStats;
      return s ? {
        ...s.report(),
        overlayText: document.getElementById('perf-overlay')?.textContent,
      } : null;
    });
    if (report) {
      console.log(`t=${(i+1)*2}s: fps=${report.fps} avgL=${report.avgLogic}ms avgR=${report.avgRender}ms maxL=${report.maxLogic}ms maxR=${report.maxRender}ms draws=${report.drawCalls} tris=${report.triangles} renders=${report.reactRenders}`);
    }
  }

  // Walk around
  console.log('\n=== WALKING ===');
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(2000);
    const report = await page.evaluate(() => (window as any).__perfStats?.report());
    if (report) console.log(`walk ${i+1}: fps=${report.fps} maxL=${report.maxLogic} maxR=${report.maxRender} renders=${report.reactRenders}`);
  }
  await page.keyboard.up('KeyW');
  await page.waitForTimeout(2000);

  const final = await page.evaluate(() => (window as any).__perfStats?.report());
  console.log(`\nFINAL: ${JSON.stringify(final, null, 2)}`);

  await browser.close();
});
