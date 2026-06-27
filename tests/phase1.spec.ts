import { test, expect } from '@playwright/test';

test.describe('Robocode Phase 1 - Core Functionality', () => {
  test('should show homepage title', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('h1')).toHaveText(/Robocode/i);
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

  test('tutorial page loads with code editor', async ({ page }) => {
    const email = `tutorial${Date.now()}@example.com`;
    await page.goto('/signup');
    await page.getByLabel('Email').fill(email);
    await page.getByLabel('Password').fill('Test1234!');
    await page.getByRole('button', { name: /Sign Up/i }).click();
    await expect(page).toHaveURL(/.*\/game/);

    await page.goto('/tutorial');
    await page.waitForLoadState('networkidle');

    const codeEditor = page.locator('textarea');
    await expect(codeEditor).toBeVisible({ timeout: 10000 });

    // Verify default answer is pre-filled
    const value = await codeEditor.inputValue();
    expect(value.length).toBeGreaterThan(5);
  });
});
