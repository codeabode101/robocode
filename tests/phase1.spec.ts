import { test, expect } from '@playwright/test';

test.describe('Robocode Phase 1 - Core Functionality', () => {
  test('should redirect unauthenticated users to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('login page has sign in form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel('Email')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
    await expect(page.getByRole('button', { name: /Sign In/i })).toBeVisible();
  });

  test('can sign up and sign in', async ({ page }) => {
    const testEmail = `test${Date.now()}@example.com`;
    const testPassword = 'Test1234!';

    // Sign up
    await page.goto('/signup');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Name').fill('Test User');
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /Sign Up/i }).click();

    // Should redirect to /game
    await expect(page).toHaveURL(/.*\/game/);

    // Clear cookies and sign in
    await page.context().clearCookies();
    await page.goto('/login');
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Should be back in game
    await expect(page).toHaveURL(/.*\/game/);
  });

  test('tutorial page validates Java code correctly', async ({ page }) => {
    // Sign up first
    const email = `tutorial${Date.now()}@example.com`;
    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('Test1234!');
    await page.getByRole('button', { name: /Sign Up/i }).click();
    await expect(page).toHaveURL(/.*\/game/);

    // Go to tutorial page
    await page.goto('/tutorial');

    // Wait for page to load (wait for a known element)
    await page.waitForLoadState('networkidle');
    
    // Check tutorial page loaded - look for the textarea (coding challenge)
    const codeEditor = page.locator('textarea');
    await expect(codeEditor).toBeVisible({ timeout: 10000 });

    // Type correct answer
    await codeEditor.clear();
    await codeEditor.fill('String robotName = "Sparky";');

    // Submit
    await page.getByRole('button', { name: /Submit Answer/i }).click();

    // Should show success (look for success message)
    await expect(page.getByText(/Correct|Completed|✓/i)).toBeVisible({ timeout: 10000 });
  });
});
