import { test, expect } from '@playwright/test';

test.describe('Robocode Phase 1 - Auth Flow', () => {
  test('should redirect unauthenticated users to /login', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/.*\/login/);
  });

  test('login page has Sign up / Login link', async ({ page }) => {
    await page.goto('/login');
    const link = page.getByRole('link', { name: /Sign up \/ Login/i });
    await expect(link).toBeVisible();
  });

  test('clicking Sign up / Login redirects to WorkOS', async ({ page }) => {
    await page.goto('/login');
    const link = page.getByRole('link', { name: /Sign up \/ Login/i });
    await link.click();
    // Wait for redirect to WorkOS auth
    await page.waitForURL(/workos\.com|authkit/);
  });
});
