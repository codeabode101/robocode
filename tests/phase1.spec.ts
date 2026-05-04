import { test, expect } from '@playwright/test';

test.describe('Robocode Phase 1 - Custom Auth Flow', () => {
  const testEmail = `test${Date.now()}@example.com`;
  const testPassword = 'Test1234!';

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
    // Go to signup
    await page.goto('/signup');
    await expect(page.getByLabel('Email')).toBeVisible();

    // Fill signup form
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Name').fill('Test User');
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /Sign Up/i }).click();

    // Should redirect to /game after signup
    await expect(page).toHaveURL(/.*\/game/);

    // Logout (we need a logout button, but for now just clear cookies)
    await page.context().clearCookies();
    await page.goto('/login');

    // Sign in with same credentials
    await page.getByLabel('Email').fill(testEmail);
    await page.getByLabel('Password').fill(testPassword);
    await page.getByRole('button', { name: /Sign In/i }).click();

    // Should be back in game
    await expect(page).toHaveURL(/.*\/game/);
  });
});
