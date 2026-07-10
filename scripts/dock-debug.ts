import { chromium } from 'playwright';
const BASE = 'https://robocode.rahejaom.workers.dev';

async function apiPost(path: string, data: unknown, cookie?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  return fetch(`${BASE}${path}`, { method: 'POST', headers, body: JSON.stringify(data) });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

  const email = `dck${Date.now()}@t.com`;
  const signupRes = await apiPost('/api/auth/signup', { email, password: 'password123' });
  const cookie = (signupRes.headers.get('set-cookie') || '').split(';')[0];
  console.log('cookie:', cookie?.substring(0, 30));

  await apiPost('/api/sync', { questStage: 'all-done', position: { x: -12, y: -8, room: 'outside', rotation: 0 } }, cookie);
  
  const hostname = new URL(BASE).hostname;
  await page.context().addCookies([{ name: 'session', value: cookie.split('=')[1], domain: hostname, path: '/' }]);
  await page.goto(`${BASE}/game`, { waitUntil: 'networkidle', timeout: 60000 });
  
  try {
    await page.waitForSelector('canvas', { timeout: 30000 });
  } catch (e) {
    console.log('Canvas not found, taking error screenshot');
    await page.screenshot({ path: '/home/dev/robocode/dock-error.png' });
    const html = await page.content();
    console.log('Page title:', await page.title());
    console.log('Body text (first 500):', (await page.evaluate(() => document.body?.innerText || '')).substring(0, 500));
    await browser.close();
    return;
  }
  
  await page.waitForTimeout(4000);
  await page.screenshot({ path: '/home/dev/robocode/dock-debug.png' });
  console.log('Captured dock-debug.png');
  await browser.close();
}
main().catch(e => { console.error(e); process.exit(1); });
