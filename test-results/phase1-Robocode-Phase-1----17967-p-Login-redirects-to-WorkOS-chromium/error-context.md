# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase1.spec.ts >> Robocode Phase 1 - Auth Flow >> clicking Sign up / Login redirects to WorkOS
- Location: tests/phase1.spec.ts:15:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 30000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "https://robocode.rahejaom.workers.dev/api/auth/login"
============================================================
```

# Page snapshot

```yaml
- generic [ref=e2]: Internal Server Error
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Robocode Phase 1 - Auth Flow', () => {
  4  |   test('should redirect unauthenticated users to /login', async ({ page }) => {
  5  |     await page.goto('/');
  6  |     await expect(page).toHaveURL(/.*\/login/);
  7  |   });
  8  | 
  9  |   test('login page has Sign up / Login link', async ({ page }) => {
  10 |     await page.goto('/login');
  11 |     const link = page.getByRole('link', { name: /Sign up \/ Login/i });
  12 |     await expect(link).toBeVisible();
  13 |   });
  14 | 
  15 |   test('clicking Sign up / Login redirects to WorkOS', async ({ page }) => {
  16 |     await page.goto('/login');
  17 |     const link = page.getByRole('link', { name: /Sign up \/ Login/i });
  18 |     await link.click();
  19 |     // Wait for redirect to WorkOS auth
> 20 |     await page.waitForURL(/workos\.com|authkit/);
     |                ^ Error: page.waitForURL: Test timeout of 30000ms exceeded.
  21 |   });
  22 | });
  23 | 
```