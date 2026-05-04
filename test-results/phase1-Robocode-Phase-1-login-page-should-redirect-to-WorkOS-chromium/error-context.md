# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase1.spec.ts >> Robocode Phase 1 >> login page should redirect to WorkOS
- Location: tests/phase1.spec.ts:9:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "https://smooth-invention-41-staging.authkit.app/redirect-uri-invalid?invalid_redirect_uri=https%3A%2F%2Frobocode.rahejaom.workers.dev%2Fauth%2Fcallback&client_id=client_01KQQMJAVBPCT8T7EDQBFDM5P6"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e7]:
    - img [ref=e8]
    - heading "This is not a valid redirect URI" [level=1] [ref=e12]
    - generic [ref=e13]:
      - paragraph [ref=e14]:
        - text: Redirect URIs must match the values in the WorkOS
        - link "Redirects" [ref=e15] [cursor=pointer]:
          - /url: https://dashboard.workos.com/environment_01KQQMJA7K60BNVJHZ6W8FD5JA/redirects
        - text: for your environment.
      - paragraph [ref=e16]: Sigma (Staging)
      - paragraph [ref=e17]: https://robocode.rahejaom.workers.dev/auth/callback
  - alert [ref=e18]
```

# Test source

```ts
  1  | import { test, expect } from "@playwright/test";
  2  | 
  3  | test.describe("Robocode Phase 1", () => {
  4  |   test("homepage should load", async ({ page }) => {
  5  |     await page.goto("/");
  6  |     await expect(page).toHaveURL("https://robocode.rahejaom.workers.dev/");
  7  |   });
  8  | 
  9  |   test("login page should redirect to WorkOS", async ({ page }) => {
  10 |     await page.goto("/auth/login");
> 11 |     await page.waitForURL(/\/api\.workos\.com/);
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  12 |     const url = page.url();
  13 |     expect(url).toContain("client_id");
  14 |     expect(url).toContain("redirect_uri");
  15 |   });
  16 | 
  17 |   test("game page elements", async ({ page }) => {
  18 |     await page.goto("/");
  19 |     await expect(page.locator("canvas")).toBeVisible({ timeout: 10000 });
  20 |   });
  21 | });
  22 | 
```