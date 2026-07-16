import { test } from '@playwright/test';

const SITE = 'https://robocode.rahejaom.workers.dev';

async function setupGame(page: import('@playwright/test').Page) {
  const email = `bldg${Date.now()}@test.com`;
  await page.request.post(`${SITE}/api/auth/signup`, {
    data: { email, password: 'TestPass123!', name: 'BuildTest' },
  });
  await page.goto(`${SITE}/game`, { waitUntil: 'networkidle', timeout: 30000 });
  await page.locator('canvas').waitFor({ timeout: 20000 });
  await page.waitForTimeout(5000);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button'))
      if (b.textContent?.includes('Got it')) { b.click(); break; }
  });
  await page.waitForTimeout(500);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    for (const b of document.querySelectorAll('button'))
      if (b.textContent?.includes('\u00d7')) b.click();
  });
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (c && !document.pointerLockElement) c.requestPointerLock();
  });
  await page.waitForTimeout(300);
}

async function rotateCamera(page: import('@playwright/test').Page, mx: number, my: number) {
  const steps = 10;
  for (let i = 0; i < steps; i++) {
    await page.evaluate(({ a, b }) => {
      const c = document.querySelector('canvas');
      if (c) c.dispatchEvent(new PointerEvent('pointermove', { movementX: a, movementY: b, bubbles: true }));
    }, { a: Math.round(mx / steps), b: Math.round(my / steps) });
    await page.waitForTimeout(20);
  }
  await page.waitForTimeout(500);
}

async function walkTo(page: import('@playwright/test').Page, targetX: number, targetY: number) {
  const spawnX = 0, spawnY = -7;
  const dx = targetX - spawnX;
  const dy = targetY - spawnY;
  const msPerUnit = 135;
  if (Math.abs(dy) > 0.5) {
    const key = dy > 0 ? 'w' : 's';
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.abs(dy) * msPerUnit);
    await page.keyboard.up(key);
    await page.waitForTimeout(100);
  }
  if (Math.abs(dx) > 0.5) {
    const key = dx > 0 ? 'd' : 'a';
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.abs(dx) * msPerUnit);
    await page.keyboard.up(key);
    await page.waitForTimeout(100);
  }
  await page.waitForTimeout(500);
}

/*
 * Building layout (all on grass blocks, roads between):
 *   Concrete (-5.7, 4)  h=5.5
 *   Brick    (6, 4)     h=4.0
 *   Slate    (18.5, 4)  h=6.0
 *   Slate mid(18.5,-4)  h=3.5
 *   Wood     (18.5,-11.75) h=4.5
 *
 * Key: stay FAR from buildings (>5 units from footprint edge)
 * so computeCameraZoom doesn't zoom in.
 * ZOOM_RANGE=3, so if minDist > 3.3 → t=0 → full camDist=2.2
 */

// Walk far south to y=-14 (on the road below all buildings)
// then look north — should see ALL buildings from far away
test('Far south looking north — all buildings visible', async ({ page }) => {
  test.setTimeout(120000);
  await setupGame(page);

  // Walk to (6, -14): east 6u, south 7u
  await walkTo(page, 6, -14);

  // movementY=-130 → horizontal view, looking north
  await rotateCamera(page, 0, -130);
  await page.screenshot({ path: '/tmp/far_south_look_north.png' });

  // movementY=-160 → looking up slightly
  await rotateCamera(page, 0, -160);
  await page.screenshot({ path: '/tmp/far_south_look_north_up.png' });
});

// Walk to (-5, 8) — north of concrete/brick, look south
test('Far north looking south — buildings from behind', async ({ page }) => {
  test.setTimeout(120000);
  await setupGame(page);

  // Walk to (-5, 8): west 5u, north 15u
  await walkTo(page, -5, 8);

  await rotateCamera(page, 160, -130);
  await page.screenshot({ path: '/tmp/far_north_look_south.png' });

  await rotateCamera(page, 160, -160);
  await page.screenshot({ path: '/tmp/far_north_look_south_up.png' });
});

// Walk to (12, 7) — northeast of concrete, northwest of slate
// Look southwest toward concrete, then southeast toward slate
test('Road between buildings — look at each', async ({ page }) => {
  test.setTimeout(120000);
  await setupGame(page);

  await walkTo(page, 12, 7);

  // Look southwest toward concrete building
  await rotateCamera(page, 120, -130);
  await page.screenshot({ path: '/tmp/road_look_sw_concrete.png' });

  // Look southeast toward slate building
  await rotateCamera(page, -120, -130);
  await page.screenshot({ path: '/tmp/road_look_se_slate.png' });

  // Look south toward wood building in distance
  await rotateCamera(page, -200, -130);
  await page.screenshot({ path: '/tmp/road_look_south_wood.png' });
});
