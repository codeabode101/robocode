import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { BASE_URL, OUTPUT_DIR, FRAMES_DIR } from './config';

interface QaPhase {
  name: string;
  frame: number;
  timer: number;
  camera: { x: number; y: number; z: number };
  player: { x: number; y: number };
  sparky?: { x: number; y: number; z: number };
  scrap?: { x: number; y: number; z: number };
}

interface QaState {
  lastPhase: string | null;
  phases: QaPhase[];
  cutsceneName: string;
}

interface CaptureFrame {
  phaseIndex: number;
  phaseName: string;
  screenshotPath: string;
  metadata: QaPhase;
}

async function apiPost(pathname: string, data: unknown, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (cookie) headers['Cookie'] = `session=${cookie}`;
  return fetch(`${BASE_URL}${pathname}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(data),
  });
}

async function apiGet(pathname: string, cookie?: string): Promise<Response> {
  const headers: Record<string, string> = {};
  if (cookie) headers['Cookie'] = `session=${cookie}`;
  return fetch(`${BASE_URL}${pathname}`, { headers });
}

async function main() {
  const cutsceneName = process.argv[2] || 'battery-install';
  const outDir = path.join(OUTPUT_DIR, cutsceneName);
  const framesDir = path.join(outDir, 'frames');
  fs.mkdirSync(framesDir, { recursive: true });

  const email = `qa-${Date.now()}@test.com`;
  const password = 'TestPass123!';
  const name = 'QATest';

  console.log(`[capture] Starting capture for cutscene: ${cutsceneName}`);
  console.log(`[capture] Base URL: ${BASE_URL}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });

  try {
    // Sign up via API using Node fetch (not Playwright's context.request which has IPv6 issues)
    console.log('[capture] Signing up test user...');
    const signupRes = await apiPost('/api/auth/signup', { email, password, name });
    if (signupRes.status !== 200) {
      const body = await signupRes.text();
      throw new Error(`Signup failed: ${signupRes.status} ${body}`);
    }
    const cookieHeader = signupRes.headers.get('set-cookie') || '';
    const cookie = cookieHeader.split(';')[0].split('=')[1];
    if (!cookie) throw new Error('No session cookie received');
    console.log('[capture] Signed in, cookie obtained');

    // Add session cookie to browser context
    const baseUrlObj = new URL(BASE_URL);
    await context.addCookies([{
      name: 'session', value: cookie,
      domain: baseUrlObj.hostname, path: '/',
    }]);

    // Set up game state for battery install cutscene using Node fetch
    console.log('[capture] Setting up game state...');
    const setRes1 = await apiPost('/api/profile/money', { amount: 0 }, cookie);
    if (setRes1.status !== 200) console.warn(`[capture] money API: ${setRes1.status}`);
    const setRes2 = await apiPost('/api/profile/inventory', { items: ['battery'] }, cookie);
    if (setRes2.status !== 200) console.warn(`[capture] inventory API: ${setRes2.status}`);
    const setRes3 = await apiPost('/api/profile/quest', { stage: 'unit1-done' }, cookie);
    if (setRes3.status !== 200) console.warn(`[capture] quest API: ${setRes3.status}`);
    const setRes4 = await apiPost('/api/sync', { cutsceneDone: true, position: { x: 0, y: -1.5, room: 'apartment', rotation: 0 } }, cookie);
    if (setRes4.status !== 200) console.warn(`[capture] sync API: ${setRes4.status}`);

    // Verify state
    const profileRes = await apiGet('/api/profile', cookie);
    const profile = await profileRes.json();
    console.log('[capture] Profile state:', JSON.stringify({
      questStage: profile.questStage, backpack: profile.backpack,
      cutsceneDone: profile.cutsceneDone, position: profile.position?.room,
    }));

    const page = await context.newPage();

    // Set up QA state before any page script executes
    await page.addInitScript(() => {
      (window as any).__qaEnabled = true;
      (window as any).__qaState = {
        lastPhase: null,
        phases: [],
        cutsceneName: '',
      };
    });

    // Collect console errors
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    // Navigate to game
    console.log('[capture] Loading game...');
    await page.goto(`${BASE_URL}/game`, { waitUntil: 'load', timeout: 30000 });

    // Debug: check what page loaded
    const pageTitle = await page.title();
    const pageUrl = page.url();
    const hasCanvas = await page.evaluate(() => !!document.querySelector('canvas'));
    const bodyLen = await page.evaluate(() => document.body?.innerHTML?.length || 0);
    console.log(`[capture] Page title: "${pageTitle}", URL: ${pageUrl}, canvas: ${hasCanvas}, bodyLen: ${bodyLen}`);
    // Dismiss any overlay modal by pressing Enter on window
    await page.evaluate(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    });

    // Wait for canvas
    await page.waitForSelector('canvas', { timeout: 20000 });
    console.log('[capture] Canvas visible');

    // Wait for game initialization (Three.js scene setup, animation loop start)
    await page.waitForTimeout(8000);

    // Dismiss any overlay modals by pressing Enter multiple times
    for (let i = 0; i < 5; i++) {
      await page.keyboard.press('Enter');
      await page.waitForTimeout(300);
    }

    // Wait for cutscene to start — need time for profile load, scene setup, pending cutscene detection
    await page.waitForTimeout(5000);

    // Poll for phase changes and capture screenshots
    const capturedFrames: CaptureFrame[] = [];
    let lastPhaseCount = 0;
    const startTime = Date.now();
    const timeout = 90000; // 90 seconds max
    let cutsceneComplete = false;

    console.log('[capture] Polling for cutscene phases...');

    while (Date.now() - startTime < timeout && !cutsceneComplete) {
      await page.waitForTimeout(500);

      const qaData = await page.evaluate(() => {
        const s = (window as any).__qaState as QaState | undefined;
        if (!s) return null;
        return {
          phaseCount: s.phases.length,
          phases: s.phases.map(p => ({ ...p })),
          cutsceneName: s.cutsceneName,
        };
      });

      if (!qaData) { console.log('[capture] No qaData yet...'); continue; }

      // Log status every 5 seconds
      if (Math.floor((Date.now() - startTime) / 5000) > Math.floor(((Date.now() - startTime) - 500) / 5000)) {
        console.log(`[capture] Polling... ${qaData.phaseCount} phases so far, last: ${qaData.phases[qaData.phaseCount-1]?.name || 'none'}, cutscene: ${qaData.cutsceneName}`);
        // Debug: check page for any visible text clues
        const pageState = await page.evaluate(() => {
          const pre = document.querySelector('pre');
          return pre ? pre.textContent?.slice(0, 200) : 'no <pre>';
        }).catch(() => 'err');
        console.log(`[capture] Page state text: ${pageState}`);
      }

      // Check for new phases
      if (qaData.phaseCount > lastPhaseCount) {
        const newPhases = qaData.phases.slice(lastPhaseCount);
        for (const phase of newPhases) {
          // Wait a frame for the scene to render with new phase
          await page.waitForTimeout(100);

          const filename = `${String(phase.frame).padStart(5, '0')}-${phase.name}.png`;
          const screenshotPath = path.join(framesDir, filename);
          await page.screenshot({ path: screenshotPath, fullPage: false });

          capturedFrames.push({
            phaseIndex: lastPhaseCount + capturedFrames.length,
            phaseName: phase.name,
            screenshotPath: filename,
            metadata: phase,
          });

          console.log(`[capture] Phase ${phase.name} (frame ${phase.frame}) → ${filename}`);

          // Wait for scene to fully render with this phase
          await page.waitForTimeout(500);

          // Check if cutscene is done (phase === 'done' or null after 'done')
          if (phase.name === 'done') {
            // Wait for endCinematicCutscene() to flip camera back to player-follow mode
            await page.waitForTimeout(2000);
            // Read actual post-cutscene state from fresh evaluation
            const postState = await page.evaluate(() => {
              const c = (window as any).__threeCamera?.position;
              const p = (window as any).__playerPos;
              const s = (window as any).__sparkyPos;
              return c && p ? {
                camera: { x: c.x, y: c.y, z: c.z },
                player: { x: p.x, y: p.y },
                sparky: s ? { x: s.x, y: s.y, z: s.z } : undefined,
              } : null;
            }).catch(() => null);
            if (postState) {
              const filename = `post-cutscene.png`;
              const screenshotPath = path.join(framesDir, filename);
              await page.screenshot({ path: screenshotPath, fullPage: false });
              capturedFrames.push({
                phaseIndex: capturedFrames.length,
                phaseName: 'post-cutscene',
                screenshotPath: filename,
                metadata: {
                  name: 'post-cutscene', frame: 0, timer: 0,
                  camera: postState.camera,
                  player: postState.player,
                  sparky: postState.sparky,
                },
              });
              console.log(`[capture] Post-cutscene state → ${filename}`);
            } else {
              // Fallback: just screenshot without metadata
              const filename = `post-cutscene.png`;
              await page.screenshot({ path: path.join(framesDir, filename), fullPage: false });
              console.log(`[capture] Post-cutscene screenshot (no metadata)`);
            }
            cutsceneComplete = true;
            break;
          }
        }
        lastPhaseCount = qaData.phaseCount;
      }
    }

    // Save metadata
    const metadata = {
      cutscene: cutsceneName,
      email,
      capturedAt: new Date().toISOString(),
      totalPhases: capturedFrames.length,
      frames: capturedFrames,
      consoleErrors: consoleErrors.filter(
        (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404')
          && !e.includes('fetch') && !e.includes('Retry') && !e.includes('ResizeObserver')
          && !e.includes('AbortError')
      ),
    };

    const metadataPath = path.join(outDir, 'metadata.json');
    fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));
    console.log(`[capture] Metadata saved to ${metadataPath}`);
    console.log(`[capture] Captured ${capturedFrames.length} phases`);
    console.log(`[capture] Cutscene complete: ${cutsceneComplete}`);

  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('[capture] Fatal error:', err);
  process.exit(1);
});
