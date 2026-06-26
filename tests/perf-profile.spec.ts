import { test, chromium } from '@playwright/test';

test('diagnose animation loop stoppage', async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--use-gl=angle'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  const allLogs: string[] = [];
  page.on('console', msg => allLogs.push(`${msg.type()}: ${msg.text().substring(0, 300)}`));

  const email = `perftest_${Date.now()}@test.com`;
  const res = await page.request.post('https://robocode.rahejaom.workers.dev/api/auth/signup', {
    data: { email, password: 'TestPass123!', name: 'PerfTest' }
  });
  console.log(`Signup: ${res.status()}`);

  // Set interval to check document.hidden every 500ms
  await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });

  // Check initial hidden state
  let hidden = await page.evaluate(() => document.hidden);
  console.log(`Initial document.hidden: ${hidden}`);

  // Monitor hidden over time and check for visibility change listener
  for (let i = 0; i < 25; i++) {
    const state = await page.evaluate(() => ({
      hidden: document.hidden,
      frameCount2: (window as any).__pfx_frameCount2 || 0,
      batch: (window as any).__pfx_batches || 0,
      lastFrameTime: (window as any).__pfx_lastFrameTime || 0,
    }));
    console.log(`t=${i+1}s: hidden=${state.hidden} frameCount2=${state.frameCount2} batches=${state.batch}`);
    await page.waitForTimeout(1000);
  }

  console.log(`\n=== All console logs (${allLogs.length}) ===`);
  for (const l of allLogs) console.log(l);

  await browser.close();
});
