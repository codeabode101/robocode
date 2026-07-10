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

async function analyzeImage(filePath: string, scene: string, minAvg: number, maxAvg: number): Promise<LightingReport> {
  // Crop to center 25% to focus on immediate game geometry
  const w = 1280, h = 720;
  const { data, info } = await sharp(filePath).extract({ left: Math.round(w*0.375), top: Math.round(h*0.375), width: Math.round(w*0.25), height: Math.round(h*0.25) }).raw().toBuffer({ resolveWithObject: true });
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
  if (avg < minAvg) issues.push(`avg ${avg.toFixed(3)} < ${minAvg} (too dark)`);
  if (avg > maxAvg) issues.push(`avg ${avg.toFixed(3)} > ${maxAvg} (too bright)`);
  if (scene.startsWith('indoor') && dark / total > 0.8) issues.push(`${(dark/total*100).toFixed(0)}% dark — room may be underlit`);

  const icon = issues.length === 0 ? '✓' : '⚠';
  console.log(`  ${icon} ${scene}: avg=${avg.toFixed(3)} max=${maxL.toFixed(2)} [${minAvg}-${maxAvg}] ${issues.length ? '— ' + issues.join(', ') : ''}`);

  return { scene, avgLuminance: avg, minLuminance: minL, maxLuminance: maxL, darkPixels: dark / total, brightPixels: bright / total, pass: issues.length === 0, issues };
}

async function captureScene(page: any, scene: string, cookie: string, syncData: Record<string, unknown>): Promise<string> {
  // Teleport player via /api/sync, then reload
  await apiPost('/api/sync', syncData, cookie);
  await page.goto(`${BASE_URL}/game`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForSelector('canvas', { timeout: 30000 });
  await page.waitForTimeout(4000);
  const fp = path.join(OUTPUT_DIR, `${scene}.png`);
  await page.screenshot({ path: fp, fullPage: false });
  return fp;
}

async function main() {
  console.log(`[lighting] Base URL: ${BASE_URL}`);
  console.log(`[lighting] Output: ${OUTPUT_DIR}`);
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();

  page.on('pageerror', (err: Error) => console.log(`  [err] ${err.message}`));

  const email = `lighting-${Date.now()}@test.com`;
  const signupRes = await apiPost('/api/auth/signup', { email, password: 'password123' });
  const setCookie = signupRes.headers.get('set-cookie') || '';
  const cookie = setCookie.split(';')[0];
  if (!cookie) throw new Error('Signup failed');
  console.log('[lighting] Signed in');

  await context.addCookies([{ name: 'session', value: cookie.split('=')[1], domain: new URL(BASE_URL).hostname, path: '/' }]);

  const reports: LightingReport[] = [];

  // Scene definitions: name, sync data for teleport, minAvg, maxAvg
  const scenes: { name: string; sync: Record<string, unknown>; minAvg: number; maxAvg: number }[] = [
    { name: 'outdoor-spawn', sync: { questStage: 'all-done', position: { x: 0, y: -7, room: 'outside', rotation: 0 } }, minAvg: 0.05, maxAvg: 0.35 },
    { name: 'outdoor-plaza', sync: { questStage: 'all-done', position: { x: -2, y: 0, room: 'outside', rotation: 0 } }, minAvg: 0.05, maxAvg: 0.35 },
    { name: 'indoor-apartment', sync: { questStage: 'all-done', position: { x: 0, y: -1.5, room: 'apartment', rotation: 0 } }, minAvg: 0.06, maxAvg: 0.75 },
    { name: 'indoor-workshop', sync: { questStage: 'all-done', position: { x: 0, y: -3.7, room: 'workshop', rotation: 0 } }, minAvg: 0.06, maxAvg: 0.75 },
    { name: 'indoor-shop', sync: { questStage: 'all-done', position: { x: 0, y: 1.2, room: 'shop', rotation: 0 } }, minAvg: 0.06, maxAvg: 0.75 },
    { name: 'indoor-arena', sync: { questStage: 'all-done', position: { x: 0, y: 0, room: 'arena', rotation: 0 } }, minAvg: 0.06, maxAvg: 0.75 },
  ];

  for (const s of scenes) {
    console.log(`[lighting] Capturing ${s.name}...`);
    const fp = await captureScene(page, s.name, cookie, s.sync);
    const r = await analyzeImage(fp, s.name, s.minAvg, s.maxAvg);
    reports.push(r);
  }

  const passed = reports.filter(r => r.pass);
  const failed = reports.filter(r => !r.pass);
  console.log(`\n[lighting] ========== SUMMARY ==========`);
  console.log(`Passed: ${passed.length}/${reports.length}`);
  for (const r of reports) {
    console.log(`  ${r.pass ? '✓' : '⚠'} ${r.scene}: avg=${r.avgLuminance.toFixed(3)}`);
  }

  // Contrast ratio: avg indoor / avg outdoor
  const outdoorAvgs = reports.filter(r => r.scene.startsWith('outdoor')).map(r => r.avgLuminance);
  const indoorAvgs = reports.filter(r => r.scene.startsWith('indoor')).map(r => r.avgLuminance);
  if (outdoorAvgs.length && indoorAvgs.length) {
    const outdoor = outdoorAvgs.reduce((a, b) => a + b, 0) / outdoorAvgs.length;
    const indoor = indoorAvgs.reduce((a, b) => a + b, 0) / indoorAvgs.length;
    const ratio = indoor / outdoor;
    console.log(`\nContrast: outdoor=${outdoor.toFixed(3)} indoor=${indoor.toFixed(3)} ratio=${ratio.toFixed(1)}:1 ${ratio >= 2 ? '✓' : '⚠ < 2:1'}`);
  }

  const reportPath = path.join(OUTPUT_DIR, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify({ baseUrl: BASE_URL, analyzedAt: new Date().toISOString(), scenes: reports }, null, 2));
  console.log(`\nReport: ${reportPath}`);

  await browser.close();
}

main().catch((err) => {
  console.error('[lighting] Fatal:', err);
  process.exit(1);
});
