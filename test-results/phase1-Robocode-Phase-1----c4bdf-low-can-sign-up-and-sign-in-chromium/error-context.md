# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase1.spec.ts >> Robocode Phase 1 - Custom Auth Flow >> can sign up and sign in
- Location: tests/phase1.spec.ts:19:7

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: locator.fill: Test timeout of 60000ms exceeded.
Call log:
  - waiting for getByLabel('Name')

```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e3]:
    - heading "Robocode" [level=1] [ref=e4]
    - paragraph [ref=e5]: Learn Java. Battle friends. Build a world.
    - generic [ref=e6]:
      - generic [ref=e7]:
        - generic [ref=e8]: Email
        - textbox "Email" [active] [ref=e9]: test1777858077152@example.com
      - generic [ref=e10]:
        - generic [ref=e11]: Password
        - textbox "Password" [ref=e12]
      - button "Sign In" [ref=e13]
    - paragraph [ref=e14]:
      - text: Don't have an account?
      - link "Sign up" [ref=e15] [cursor=pointer]:
        - /url: /signup
  - alert [ref=e16]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Robocode Phase 1 - Custom Auth Flow', () => {
  4  |   const testEmail = `test${Date.now()}@example.com`;
  5  |   const testPassword = 'Test1234!';
  6  | 
  7  |   test('should redirect unauthenticated users to /login', async ({ page }) => {
  8  |     await page.goto('/');
  9  |     await expect(page).toHaveURL(/.*\/login/);
  10 |   });
  11 | 
  12 |   test('login page has sign in form', async ({ page }) => {
  13 |     await page.goto('/login');
  14 |     await expect(page.getByLabel('Email')).toBeVisible();
  15 |     await expect(page.getByLabel('Password')).toBeVisible();
  16 |     await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  17 |   });
  18 | 
  19 |   test('can sign up and sign in', async ({ page }) => {
  20 |     // Go to signup
  21 |     await page.goto('/signup');
  22 |     await expect(page.getByLabel('Email')).toBeVisible();
  23 | 
  24 |     // Fill signup form
  25 |     await page.getByLabel('Email').fill(testEmail);
> 26 |     await page.getByLabel('Name').fill('Test User');
     |                                   ^ Error: locator.fill: Test timeout of 60000ms exceeded.
  27 |     await page.getByLabel('Password').fill(testPassword);
  28 |     await page.getByRole('button', { name: /Sign Up/i }).click();
  29 | 
  30 |     // Should redirect to /game after signup
  31 |     await expect(page).toHaveURL(/.*\/game/);
  32 | 
  33 |     // Logout (we need a logout button, but for now just clear cookies)
  34 |     await page.context().clearCookies();
  35 |     await page.goto('/login');
  36 | 
  37 |     // Sign in with same credentials
  38 |     await page.getByLabel('Email').fill(testEmail);
  39 |     await page.getByLabel('Password').fill(testPassword);
  40 |     await page.getByRole('button', { name: /Sign In/i }).click();
  41 | 
  42 |     // Should be back in game
  43 |     await expect(page).toHaveURL(/.*\/game/);
  44 |   });
  45 | });
  46 | 
```