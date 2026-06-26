import { test, chromium } from '@playwright/test';

test('count frames and capture perf data', async () => {
  const browser = await chromium.launch({ headless: true, args: ['--disable-gpu', '--use-gl=angle'] });
  const page = await browser.newPage();

  const consoleLogs: string[] = [];
  page.on('console', msg => consoleLogs.push(msg.text()));

  const email = `perftest_${Date.now()}@test.com`;
  const res = await page.request.post('https://robocode.rahejaom.workers.dev/api/auth/signup', {
    data: { email, password: 'TestPass123!', name: 'PerfTest' }
  });
  console.log(`Signup: ${res.status()}`);

  await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'networkidle', timeout: 30000 });
  await page.waitForSelector('canvas', { timeout: 20000 });
  
  // Now poll for frames
  for (let i = 0; i < 12; i++) {
    await page.waitForTimeout(1000);
    
    // Count how many [PERF] logs we have so far
    const perfCount = consoleLogs.filter(l => l.startsWith('[PERF]')).length;
    const slowCount = consoleLogs.filter(l => l.includes('[PERF_SLOW]')).length;
    const errorCount = consoleLogs.filter(l => l.includes('error') || l.includes('Error')).length;
    
    console.log(`t=${i+1}s: PERF=${perfCount} SLOW=${slowCount} ERRORS=${errorCount}`);
  }

  // Walk
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 5; i++) {
    await page.waitForTimeout(1000);
    const perfCount = consoleLogs.filter(l => l.startsWith('[PERF]')).length;
    const slowCount = consoleLogs.filter(l => l.includes('[PERF_SLOW]')).length;
    console.log(`walk t=${i+1}s: PERF=${perfCount} SLOW=${slowCount}`);
  }
  await page.keyboard.up('KeyW');

  // Print all perf logs
  const perfLogs = consoleLogs.filter(l => l.startsWith('[PERF]'));
  const slowLogs = consoleLogs.filter(l => l.includes('[PERF_SLOW]'));
  
  console.log(`\n=== ALL PERF LOGS (${perfLogs.length}) ===`);
  for (const l of perfLogs) console.log(l);
  
  console.log(`\n=== ALL SLOW FRAMES (${slowLogs.length}) ===`);
  for (const l of slowLogs) console.log(l);
  
  console.log(`\n=== TOTAL CONSOLE LOGS: ${consoleLogs.length} ===`);
  // Check for error logs
  const errors = consoleLogs.filter(l => l.toLowerCase().includes('error'));
  if (errors.length > 0) {
    console.log(`\n=== ERRORS ===`);
    for (const e of errors.slice(0, 10)) console.log(e.substring(0, 300));
  }

  await browser.close();
});
