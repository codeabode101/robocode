import { test, expect } from '@playwright/test';

test.describe('Homepage', () => {
  test('should have correct title and description', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Robocode/);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Learn Java. Battle friends. Build a world./);
  });

  test('should show login link', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('link', { name: /Sign in/i })).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Sign in/i }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: /Robocode/i })).toBeVisible();
  });
});

test.describe('Login Page', () => {
  test('should show form with email and password inputs', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('should show error on invalid credentials', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();
    await expect(page.getByText(/invalid credentials/i)).toBeVisible();
  });
});

test.describe('Signup Page', () => {
  test('should show form with email, password and name inputs', async ({ page }) => {
    await page.goto('/signup');
    await expect(page.getByLabel(/email/i)).toBeVisible();
    await expect(page.getByLabel(/password/i)).toBeVisible();
    await expect(page.getByLabel(/name/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /sign up/i })).toBeVisible();
  });
});
