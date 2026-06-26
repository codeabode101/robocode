import { test, chromium } from '@playwright/test';

test('profile game frame timing', async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--use-gl=angle'] });
  const page = await browser.newPage();

  const perfLogs: string[] = [];
  const spikeLogs: string[] = [];
  page.on('console', msg => {
    const t = msg.text();
    if (t.startsWith('[PERF]')) perfLogs.push(t);
    if (t.startsWith('[PERF_SPIKE]')) spikeLogs.push(t);
  });

  const email = `perftest_${Date.now()}@test.com`;
  const res = await page.request.post('https://robocode.rahejaom.workers.dev/api/auth/signup', {
    data: { email, password: 'TestPass123!', name: 'PerfTest' }
  });
  console.log(`Signup: ${res.status()}`);

  await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  await page.waitForTimeout(3000);

  // Walk around to simulate gameplay
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(3000);
  await page.keyboard.up('KeyW');
  await page.keyboard.down('KeyD');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyD');
  await page.keyboard.down('KeyS');
  await page.waitForTimeout(2000);
  await page.keyboard.up('KeyS');
  await page.waitForTimeout(5000);

  console.log(`\n=== PERF REPORTS: ${perfLogs.length} ===`);
  for (const log of perfLogs) {
    console.log(log);
  }

  console.log(`\n=== RENDER SPIKES (>50ms): ${spikeLogs.length} ===`);
  for (const log of spikeLogs.slice(0, 50)) {
    console.log(log);
  }
  if (spikeLogs.length > 50) {
    console.log(`... and ${spikeLogs.length - 50} more`);
  }

  // Aggregate histograms
  const histograms: { rDist: Record<string, number>, lDist: Record<string, number> }[] = [];
  const renderRanges = ['0-8', '8-16', '16-33', '33-50', '50-100', '>100'];
  const logicRanges = ['0-1', '1-5', '>5'];
  
  for (const log of perfLogs) {
    const rMatch = log.match(/rDist:\[([^\]]+)\]/);
    const lMatch = log.match(/lDist:\[([^\]]+)\]/);
    if (rMatch && lMatch) {
      const rParts = rMatch[1].split('|');
      const lParts = lMatch[1].split('|');
      const rDist: Record<string, number> = {};
      const lDist: Record<string, number> = {};
      let totalR = 0;
      let totalL = 0;
      for (const p of rParts) {
        const [k, v] = p.split('=');
        rDist[k] = parseInt(v);
        totalR += parseInt(v);
      }
      for (const p of lParts) {
        const [k, v] = p.split('=');
        lDist[k] = parseInt(v);
        totalL += parseInt(v);
      }
      histograms.push({ rDist, lDist });
    }
  }

  if (histograms.length > 0) {
    const summedRD: Record<string, number> = {};
    const summedLD: Record<string, number> = {};
    let totalFrames = 0;
    
    for (const h of histograms) {
      for (const [k, v] of Object.entries(h.rDist)) {
        summedRD[k] = (summedRD[k] || 0) + v;
      }
      for (const [k, v] of Object.entries(h.lDist)) {
        summedLD[k] = (summedLD[k] || 0) + v;
      }
      totalFrames += 60;
    }

    console.log(`\n=== AGGREGATED (${totalFrames} frames) ===`);
    console.log('Render time distribution:');
    for (const r of renderRanges) {
      const val = summedRD[r] || 0;
      const pct = (val / totalFrames * 100).toFixed(1);
      const bar = '█'.repeat(Math.round(val / totalFrames * 100 / 2));
      console.log(`  ${r}ms: ${val} (${pct}%) ${bar}`);
    }
    console.log('Logic time distribution:');
    for (const r of logicRanges) {
      const val = summedLD[r] || 0;
      const pct = (val / totalFrames * 100).toFixed(1);
      console.log(`  ${r}ms: ${val} (${pct}%)`);
    }
  }

  await browser.close();
});
