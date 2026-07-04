import { test } from '@playwright/test';

test('profile game performance', async ({ page, context }) => {
  test.setTimeout(60000);
  const results: number[] = [];

  // Sign in via API and set cookie
  const signinRes = await page.request.post('https://robocode.rahejaom.workers.dev/api/auth/signin', {
    data: { email: 'test-1778800120@test.com', password: 'test123' },
  });
  const setCookie = signinRes.headers()['set-cookie'];
  if (!setCookie) {
    console.log('No set-cookie header, trying signup...');
    const signupRes = await page.request.post('https://robocode.rahejaom.workers.dev/api/auth/signup', {
      data: { email: `perf-test-${Date.now()}@test.com`, password: 'test123', name: 'Perf' },
    });
    const sc = signupRes.headers()['set-cookie'];
    if (!sc) { console.log('Still no cookie, skipping'); return; }
    await context.addCookies([{ name: 'session', value: sc.split(';')[0].split('=')[1], domain: 'robocode.rahejaom.workers.dev', path: '/' }]);
  } else {
    await context.addCookies([{ name: 'session', value: setCookie.split(';')[0].split('=')[1], domain: 'robocode.rahejaom.workers.dev', path: '/' }]);
  }

  // Navigate to game
  await page.goto('https://robocode.rahejaom.workers.dev/game');

  // Wait for canvas
  await page.waitForSelector('canvas', { timeout: 20000 });
  console.log('Canvas loaded, collecting metrics...');

  // Inject FPS counter
  await page.evaluate(() => {
    let last = performance.now();
    const frames: number[] = [];
    (window as any).__frames = frames;

    const origRAF = window.requestAnimationFrame;
    window.requestAnimationFrame = (cb: FrameRequestCallback) => {
      const now = performance.now();
      const delta = now - last;
      if (delta > 1 && delta < 500) frames.push(delta);
      last = now;
      return origRAF(cb);
    };
  });

  // Collect idle data
  await page.waitForTimeout(8000);

  // Move right for 3 seconds
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(3000);
  await page.keyboard.up('ArrowRight');

  // Move down for 2 seconds
  await page.keyboard.down('ArrowDown');
  await page.waitForTimeout(2000);
  await page.keyboard.up('ArrowDown');

  // Idle again
  await page.waitForTimeout(5000);

  // Collect results
  const frameTimes: number[] = await page.evaluate(() => (window as any).__frames || []);

  const valid = frameTimes.filter(t => t > 0 && t < 200);

  if (valid.length < 10) {
    console.log(`Not enough frames collected: ${valid.length}`);
    return;
  }

  const avg = valid.reduce((a, b) => a + b, 0) / valid.length;
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const fps60 = valid.filter(t => t <= 16.67).length;
  const fps30 = valid.filter(t => t <= 33.34).length;
  const below30 = valid.filter(t => t > 33.34).length;

  console.log('');
  console.log('=== FRAME TIME RESULTS ===');
  console.log(`Total samples: ${valid.length}`);
  console.log(`Average: ${avg.toFixed(2)}ms (${(1000/avg).toFixed(1)} FPS)`);
  console.log(`Min: ${min.toFixed(2)}ms  Max: ${max.toFixed(2)}ms`);
  console.log(`≥60fps (≤16.67ms): ${fps60} (${(fps60/valid.length*100).toFixed(1)}%)`);
  console.log(`30-60fps (≤33.34ms): ${fps30 - fps60} (${((fps30-fps60)/valid.length*100).toFixed(1)}%)`);
  console.log(`<30fps (>33.34ms): ${below30} (${(below30/valid.length*100).toFixed(1)}%)`);
});
