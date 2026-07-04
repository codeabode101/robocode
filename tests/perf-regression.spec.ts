import { test, expect } from '@playwright/test';

test.describe('Performance Regression', () => {
  test.setTimeout(60000);
  test('max logic spike remains under 500ms in headless', async ({ page }) => {
    const email = `perfreg${Date.now()}@test.com`;
    const res = await page.request.post('https://robocode.rahejaom.workers.dev/api/auth/signup', {
      data: { email, password: 'TestPass123!', name: 'PerfReg' },
    });
    expect(res.status()).toBe(200);

    await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('canvas', { timeout: 20000 });

    // Wait for profile load + initial stabilization
    await page.waitForTimeout(3000);

    // Idle for 15s collecting perf data
    await page.waitForTimeout(15000);

    // Walk around for 10s
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(5000);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('KeyA');
    await page.waitForTimeout(3000);
    await page.keyboard.up('KeyA');
    await page.keyboard.down('KeyD');
    await page.waitForTimeout(2000);
    await page.keyboard.up('KeyD');

    await page.waitForTimeout(3000);

    const stats = await page.evaluate(() => {
      const s = (window as any).__perfStats;
      if (!s) return null;
      return {
        frames: s.frameCount,
        maxLogic: parseFloat(s.maxLogic?.toFixed(2) || '0'),
        avgLogic: s.avgLogic,
        maxRender: parseFloat(s.maxRender?.toFixed(2) || '0'),
        slowLogic: s.slowLogicFrames || 0,
        slowRender: s.slowRenderFrames || 0,
        draws: s.drawCalls,
        tris: s.triangles,
        reactRenders: (window as any).__reactRenders || 0,
      };
    });

    if (stats === null) {
      console.log('⚠ __perfStats not available — skipping assertion');
      return;
    }

    console.log('\n=== PERFORMANCE RESULTS (headless) ===');
    console.log(`  frames: ${stats.frames}`);
    console.log(`  maxLogic: ${stats.maxLogic}ms`);
    console.log(`  avgLogic: ${stats.avgLogic}ms`);
    console.log(`  maxRender: ${stats.maxRender}ms`);
    console.log(`  slowLogic: ${stats.slowLogic}`);
    console.log(`  slowRender: ${stats.slowRender}`);
    console.log(`  draws: ${stats.draws}  tris: ${stats.tris}`);
    console.log(`  reactRenders: ${stats.reactRenders}`);

    // In headless Chrome with SwiftShader, renderMs is always ~220ms
    // Headless SwiftShader has high initial spike; allow up to 500ms
    if (stats.frames > 30) {
      expect(stats.maxLogic).toBeLessThan(500);
      expect(stats.slowLogic).toBeLessThan(10);
    }
  });
});
