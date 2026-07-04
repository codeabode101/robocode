# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: room-transition.spec.ts >> Room Transitions >> enters and exits workshop without crash
- Location: tests/room-transition.spec.ts:4:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForTimeout: Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - generic [ref=e6]:
      - button "⚔️" [ref=e7]
      - button "👥" [ref=e8]
      - button "👤" [ref=e9]
      - button "⚙️" [ref=e10]
    - generic [ref=e11]: Press space to interact with Transporter!
    - generic [ref=e12]: $0
    - generic [ref=e13]: 🟢 Live island • 1 player
    - generic [ref=e15]:
      - heading "How to play" [level=2] [ref=e16]
      - generic [ref=e17]:
        - generic [ref=e18]:
          - generic [ref=e19]: Arrow Keys
          - generic [ref=e20]:
            - generic [ref=e22]: ↑
            - generic [ref=e24]: ←
            - generic [ref=e25]: ↓
            - generic [ref=e26]: →
        - generic [ref=e27]:
          - generic [ref=e28]: WASD
          - generic [ref=e29]:
            - generic [ref=e31]: W
            - generic [ref=e33]: A
            - generic [ref=e34]: S
            - generic [ref=e35]: D
      - generic [ref=e36]:
        - img [ref=e37]
        - paragraph [ref=e39]: Move your mouse to look around
      - button "Got it!" [active] [ref=e41]
  - alert [ref=e42]
  - generic [ref=e43]: label-build-20260510-0342 — 4:18:28 PM
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Room Transitions', () => {
  4  |   test('enters and exits workshop without crash', async ({ page }) => {
  5  |     const consoleErrors: string[] = [];
  6  |     page.on('console', (msg) => {
  7  |       if (msg.type() === 'error') consoleErrors.push(msg.text());
  8  |     });
  9  | 
  10 |     const email = `room${Date.now()}@test.com`;
  11 |     const res = await page.request.post('https://robocode.rahejaom.workers.dev/api/auth/signup', {
  12 |       data: { email, password: 'TestPass123!', name: 'RoomTest' },
  13 |     });
  14 |     expect(res.status()).toBe(200);
  15 | 
  16 |     await page.goto('https://robocode.rahejaom.workers.dev/game', { waitUntil: 'networkidle', timeout: 30000 });
  17 |     const canvas = page.locator('canvas');
  18 |     await expect(canvas).toBeVisible({ timeout: 20000 });
  19 | 
  20 |     // Wait for scene to fully load
  21 |     await page.waitForTimeout(8000);
  22 | 
  23 |     // Walk toward workshop door at (-6, -10.3) from spawn (0, -7)
  24 |     // Need to walk south (S key = -Y) and west (A key = -X)
  25 |     // With default camera yaw=0: S moves toward -Y
  26 |     await page.keyboard.down('KeyA');
  27 |     await page.waitForTimeout(4000);
  28 |     await page.keyboard.up('KeyA');
  29 |     await page.keyboard.down('KeyS');
  30 |     await page.waitForTimeout(3000);
  31 |     await page.keyboard.up('KeyS');
  32 | 
  33 |     // Try entering workshop by walking into door area
  34 |     await page.keyboard.down('KeyW');
  35 |     await page.waitForTimeout(1000);
  36 |     await page.keyboard.up('KeyW');
  37 | 
  38 |     await page.waitForTimeout(1000);
  39 | 
  40 |     // Try to exit by walking south toward the door
  41 |     await page.keyboard.down('KeyS');
  42 |     await page.waitForTimeout(3000);
  43 |     await page.keyboard.up('KeyS');
  44 | 
> 45 |     await page.waitForTimeout(2000);
     |                ^ Error: page.waitForTimeout: Test timeout of 30000ms exceeded.
  46 | 
  47 |     await expect(canvas).toBeVisible();
  48 | 
  49 |     const criticalErrors = consoleErrors.filter(
  50 |       (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404') && !e.includes('fetch') && !e.includes('Retry')
  51 |     );
  52 |     expect(criticalErrors).toEqual([]);
  53 |   });
  54 | });
  55 | 
```