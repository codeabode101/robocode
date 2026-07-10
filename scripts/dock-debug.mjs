import { chromium } from 'playwright';

const BASE = 'https://robocode.rahejaom.workers.dev';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

const email = `dck${Date.now()}@t.com`;
await page.goto(`${BASE}/game`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('input[type="email"]', { timeout: 10000 });
await page.fill('input[type="email"]', email);
await page.fill('input[type="password"]', 'password123');
await page.click('button[type="submit"]');
await page.waitForTimeout(3000);

await page.evaluate(() => {
  fetch('/api/sync', { method:'POST', headers:{'Content-Type':'application/json'}, credentials:'include',
    body: JSON.stringify({ questStage:'all-done', position:{ x:-12, y:-8, room:'outside', rotation:0 } })
  });
});
await page.waitForTimeout(500);
await page.reload({ waitUntil: 'networkidle', timeout: 60000 });
await page.waitForSelector('canvas', { timeout: 30000 });
await page.waitForTimeout(5000);
await page.screenshot({ path: 'dock-debug.png' });
console.log('SAVED dock-debug.png');

await browser.close();
