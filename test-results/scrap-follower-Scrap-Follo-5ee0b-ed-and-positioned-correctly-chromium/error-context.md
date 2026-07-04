# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: scrap-follower.spec.ts >> Scrap Follower >> follower is created, activated, and positioned correctly
- Location: tests/scrap-follower.spec.ts:6:7

# Error details

```
Error: expect(received).not.toBeCloseTo(expected, precision)

Expected: not -5
Received:     -5.190578012305227

Expected precision:        0
Expected difference: not < 0.5
Received difference:       0.19057801230522742
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
    - generic [ref=e11]: $0
    - generic [ref=e12]: 🟢 Live island • 1 player
    - generic [ref=e13]:
      - generic [ref=e14]: Mission
      - generic [ref=e15]: Scrap is fully repaired!
    - generic [ref=e17]:
      - heading "How to play" [level=2] [ref=e18]
      - generic [ref=e19]:
        - generic [ref=e20]:
          - generic [ref=e21]: Arrow Keys
          - generic [ref=e22]:
            - generic [ref=e24]: ↑
            - generic [ref=e26]: ←
            - generic [ref=e27]: ↓
            - generic [ref=e28]: →
        - generic [ref=e29]:
          - generic [ref=e30]: WASD
          - generic [ref=e31]:
            - generic [ref=e33]: W
            - generic [ref=e35]: A
            - generic [ref=e36]: S
            - generic [ref=e37]: D
      - generic [ref=e38]:
        - img [ref=e39]
        - paragraph [ref=e41]: Move your mouse to look around
      - button "Got it!" [active] [ref=e43]
    - generic [ref=e45]:
      - img "scrap" [ref=e46]
      - generic [ref=e47]: "1"
  - alert [ref=e48]
  - generic [ref=e49]: label-build-20260510-0342 — 4:12:25 PM
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const BASE = 'https://robocode.rahejaom.workers.dev';
  4  | 
  5  | test.describe('Scrap Follower', () => {
  6  |   test('follower is created, activated, and positioned correctly', async ({ page }) => {
  7  |     const logs: string[] = [];
  8  |     page.on('console', (msg) => logs.push(msg.text()));
  9  | 
  10 |     const email = `scrap-${Date.now()}@test.com`;
  11 |     const signupRes = await page.request.post(`${BASE}/api/auth/signup`, {
  12 |       data: { email, password: 'TestPass123!', name: 'ScrapTest' },
  13 |     });
  14 |     expect(signupRes.status()).toBe(200);
  15 | 
  16 |     await page.request.post(`${BASE}/api/sync`, {
  17 |       data: {
  18 |         questStage: 'all-done',
  19 |         backpack: ['scrap'],
  20 |         cutsceneDone: true,
  21 |         batteryInstalled: true,
  22 |         pendingBatteryCutscene: false,
  23 |         position: { x: -9.6, y: -5.5, room: 'outside', rotation: 0 },
  24 |       },
  25 |     });
  26 | 
  27 |     await page.goto(`${BASE}/game`, { waitUntil: 'networkidle', timeout: 30000 });
  28 |     await expect(page.locator('canvas')).toBeVisible({ timeout: 20000 });
  29 |     await page.waitForTimeout(8000);
  30 | 
  31 |     // Follower was created and activated
  32 |     expect(logs.some((l) => l.includes('[scrap] FOLLOWER CREATED'))).toBeTruthy();
  33 |     expect(logs.some((l) => l.includes('[scrap] ACTIVATED'))).toBeTruthy();
  34 | 
  35 |     // Follower moved from its spawn point (-3.6, -5) toward the player
  36 |     const fx = await page.evaluate(() => (window as any).__scrapFollowerX);
  37 |     const fy = await page.evaluate(() => (window as any).__scrapFollowerY);
  38 |     expect(fx).not.toBeCloseTo(-3.6, 0);
> 39 |     expect(fy).not.toBeCloseTo(-5.0, 0);
     |                    ^ Error: expect(received).not.toBeCloseTo(expected, precision)
  40 | 
  41 |     // No backpack duplicate (dedup on profile load)
  42 |     expect(logs.filter((l) => l.includes('backpack')).length).toBeLessThanOrEqual(3);
  43 | 
  44 |     // No critical errors
  45 |     const criticalErrors = logs.filter(
  46 |       (e) => !e.includes('THREE') && !e.includes('WebGL') && !e.includes('404') && !e.includes('fetch')
  47 |     );
  48 |     expect(criticalErrors).toEqual([]);
  49 |   });
  50 | });
  51 | 
```