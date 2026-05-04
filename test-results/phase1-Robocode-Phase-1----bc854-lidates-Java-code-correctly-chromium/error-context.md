# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: phase1.spec.ts >> Robocode Phase 1 - Core Functionality >> tutorial page validates Java code correctly
- Location: tests/phase1.spec.ts:41:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText(/Correct|Completed|✓/i)
Expected: visible
Error: strict mode violation: getByText(/Correct|Completed|✓/i) resolved to 2 elements:
    1) <button disabled class="px-6 py-2 rounded font-semibold bg-green-600 cursor-not-allowed">✓ Completed!</button> aka getByRole('button', { name: '✓ Completed!' })
    2) <div class="p-4 rounded-lg bg-green-900 text-green-200">✅ Correct! You declared a String variable named r…</div> aka getByText('✅ Correct! You declared a')

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for getByText(/Correct|Completed|✓/i)

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - generic [ref=e3]:
    - 'heading "Java Tutorial: Variables" [level=1] [ref=e4]'
    - generic [ref=e5]:
      - 'heading "Challenge: Declare a String variable" [level=2] [ref=e6]'
      - paragraph [ref=e7]: "In Java, you can declare a String variable like this:"
      - code [ref=e9]: String variableName = "value";
      - paragraph [ref=e10]:
        - text: "Your task: Declare a String variable named"
        - code [ref=e11]: robotName
        - text: with the value
        - code [ref=e12]: "\"Sparky\""
    - generic [ref=e13]:
      - generic [ref=e14]:
        - heading "Code Editor" [level=3] [ref=e15]
        - generic [ref=e16]: Java
      - textbox [ref=e17]: String robotName = "Sparky";
      - button "✓ Completed!" [disabled] [ref=e18]
    - generic [ref=e19]: ✅ Correct! You declared a String variable named robotName with value "Sparky"!
  - alert [ref=e20]
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Robocode Phase 1 - Core Functionality', () => {
  4  |   test('should redirect unauthenticated users to /login', async ({ page }) => {
  5  |     await page.goto('/');
  6  |     await expect(page).toHaveURL(/.*\/login/);
  7  |   });
  8  | 
  9  |   test('login page has sign in form', async ({ page }) => {
  10 |     await page.goto('/login');
  11 |     await expect(page.getByLabel('Email')).toBeVisible();
  12 |     await expect(page.getByLabel('Password')).toBeVisible();
  13 |     await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  14 |   });
  15 | 
  16 |   test('can sign up and sign in', async ({ page }) => {
  17 |     const testEmail = `test${Date.now()}@example.com`;
  18 |     const testPassword = 'Test1234!';
  19 | 
  20 |     // Sign up
  21 |     await page.goto('/signup');
  22 |     await page.getByLabel('Email').fill(testEmail);
  23 |     await page.getByLabel('Name').fill('Test User');
  24 |     await page.getByLabel('Password').fill(testPassword);
  25 |     await page.getByRole('button', { name: /Sign Up/i }).click();
  26 | 
  27 |     // Should redirect to /game
  28 |     await expect(page).toHaveURL(/.*\/game/);
  29 | 
  30 |     // Clear cookies and sign in
  31 |     await page.context().clearCookies();
  32 |     await page.goto('/login');
  33 |     await page.getByLabel('Email').fill(testEmail);
  34 |     await page.getByLabel('Password').fill(testPassword);
  35 |     await page.getByRole('button', { name: /Sign In/i }).click();
  36 | 
  37 |     // Should be back in game
  38 |     await expect(page).toHaveURL(/.*\/game/);
  39 |   });
  40 | 
  41 |   test('tutorial page validates Java code correctly', async ({ page }) => {
  42 |     // Sign up first
  43 |     const email = `tutorial${Date.now()}@example.com`;
  44 |     await page.goto('/signup');
  45 |     await page.getByLabel('Email').fill(email);
  46 |     await page.getByLabel('Password').fill('Test1234!');
  47 |     await page.getByRole('button', { name: /Sign Up/i }).click();
  48 |     await expect(page).toHaveURL(/.*\/game/);
  49 | 
  50 |     // Go to tutorial page
  51 |     await page.goto('/tutorial');
  52 | 
  53 |     // Wait for page to load (wait for a known element)
  54 |     await page.waitForLoadState('networkidle');
  55 |     
  56 |     // Check tutorial page loaded - look for the textarea (coding challenge)
  57 |     const codeEditor = page.locator('textarea');
  58 |     await expect(codeEditor).toBeVisible({ timeout: 10000 });
  59 | 
  60 |     // Type correct answer
  61 |     await codeEditor.clear();
  62 |     await codeEditor.fill('String robotName = "Sparky";');
  63 | 
  64 |     // Submit
  65 |     await page.getByRole('button', { name: /Submit Answer/i }).click();
  66 | 
  67 |     // Should show success (look for success message)
> 68 |     await expect(page.getByText(/Correct|Completed|✓/i)).toBeVisible({ timeout: 10000 });
     |                                                          ^ Error: expect(locator).toBeVisible() failed
  69 |   });
  70 | });
  71 | 
```