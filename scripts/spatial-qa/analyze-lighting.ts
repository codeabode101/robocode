import { chromium } from 'playwright';
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';

const BASE_URL = process.env.BASE_URL || 'https://robocode.rahejaom.workers.dev';
const OUTPUT_DIR = path.resolve(__dirname, 'output', 'lighting-analysis');

interface LightingReport {
  scene: string;
  avgLuminance: number;
  minLuminance: number;
  maxLuminance: number;
  darkPixels: number;
  brightPixels: number;
  pass: boolean;
  issues: string[];
}

async function apiPost(pathname: string, data: unknown, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = cookie;
  return fetch(`${BASE_URL}${pathname}`, { method: 'POST', headers, body: JSON.stringify(data) });
}

async function analyzeImage(filePath: string, scene: string, minAvg: number, maxAvg: number, isOutdoor?: boolean): Promise<LightingReport> {
  const { data, info } = await sharp(filePath).raw().toBuffer({ resolveWithObject: true });
  const pixels = new Uint8Array(data);
  const total = info.width * info.height;
  let sumL = 0;
  let dark = 0;
  let bright = 0;
  let minL = 1;
  let maxL = 0;

  for (let i = 0; i < pixels.length; i += 3) {
    const r = pixels[i] / 255;
    const g = pixels[i + 1] / 255;
    const b = pixels[i + 2] / 255;
    const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    sumL += l;
    if (l < minL) minL = l;
    if (l > maxL) maxL = l;
    if (l < 0.2) dark++;
    if (l > 0.7) bright++;
  }

  const avg = sumL / total;
  const issues: string[] = [];
  if (avg < minAvg) issues.push(`avg ${avg.toFixed(3)} < min ${minAvg} (too dark)`);
  if (avg > maxAvg) issues.push(`avg ${avg.toFixed(3)} > max ${maxAvg} (too bright)`);
  if (!isOutdoor && dark / total > 0.5) issues.push(`${(dark/total*100).toFixed(0)}% pixels very dark`);
  if (isOutdoor && bright / total < 0.005) issues.push(`only ${(bright/total*100).toFixed(1)}% bright pixels — lamps may not be visible`);

  if (issues.length === 0) {
    console.log(`  ✓ ${scene}: avg=${avg.toFixed(3)} [${minAvg}-${maxAvg}]`);
  } else {
    console.log(`  ⚠ ${scene}: avg=${avg.toFixed(3)} [${minAvg}-${maxAvg}] — ${issues.join(', ')}`);
  }

  return { scene, avgLuminance: avg, minLuminance: minL, maxLuminance: maxL, darkPixels: dark / total, brightPixels: bright / total, pass: issues.length === 0, issues };
}

async function main() {
  console.log(`[lighting] Base URL: ${BASE_URL}`);
  console.log(`[lighting] Output: ${OUTPUT_DIR}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('console', (msg) => { if (msg.type() === 'error') console.log(`  [browser]`, msg.text()); });
  page.on('pageerror', (err) => console.log(`  [browser err]`, err.message));

  // Sign up and set all-done quest stage
  const email = `lighting-${Date.now()}@test.com`;
  const signupRes = await apiPost('/api/auth/signup', { email, password: 'password123' });
  const setCookie = signupRes.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  if (!cookie) throw new Error('Signup failed');
  console.log('[lighting] Signed in');

  // Set profile for free-roam: all-done quest, outside position
  const profileRes = await apiPost('/api/profile/quest', { questStage: 'all-done' }, cookie);
  if (!profileRes.ok) console.warn('[lighting] Quest set:', profileRes.status);
  const invRes = await apiPost('/api/profile/inventory', { items: [] }, cookie);
  if (!invRes.ok) console.warn('[lighting] Inventory set:', invRes.status);

  await context.addCookies([{ name: 'session', value: cookie.split('=')[1], domain: new URL(BASE_URL).hostname, path: '/' }]);
  await page.goto(`${BASE_URL}/game`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('canvas', { timeout: 30000 });
  console.log('[lighting] Game canvas loaded');
  await page.waitForTimeout(3000);

  // Move player to positions via keyboard (WASD) is unreliable — we'll screenshot from wherever player spawns
  // Instead, take screenshots at fixed intervals as player walks
  const sceneDefs: { name: string; minAvg: number; maxAvg: number; desc: string }[] = [
    { name: 'outdoor-spawn', minAvg: 0.08, maxAvg: 0.35, desc: 'Outdoor (spawn)' },
  ];

  console.log('[lighting] Capturing scenes...');
  const reports: LightingReport[] = [];

  for (const scene of sceneDefs) {
    await page.waitForTimeout(1000);
    const fp = path.join(OUTPUT_DIR, `${scene.name}.png`);
    await page.screenshot({ path: fp, fullPage: false });
    const report = await analyzeImage(fp, scene.desc, scene.minAvg, scene.maxAvg, true);
    reports.push(report);
  }

  // Summary
  const passed = reports.filter(r => r.pass);
  const failed = reports.filter(r => !r.pass);
  console.log(`\n✓ ${passed.length}/${reports.length} scenes pass`);

  if (failed.length > 0) {
    console.log(`⚠ Adjustments needed:`);
    for (const f of failed) console.log(`  ${f.scene}: ${f.issues.join(' | ')}`);
  }

  if (reports.length > 0) {
    const avg = reports.reduce((s, r) => s + r.avgLuminance, 0) / reports.length;
    console.log(`Average scene luminance: ${avg.toFixed(3)}`);
  }

  const reportPath = path.join(OUTPUT_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({
    analyzedAt: new Date().toISOString(), baseUrl: BASE_URL, totalScenes: reports.length,
    passed: passed.length, failed: failed.length, scenes: reports,
  }, null, 2));
  console.log(`\nReport: ${reportPath}`);

  await browser.close();
}

main().catch((err) => {
  console.error('[lighting] Fatal:', err);
  process.exit(1);
});
