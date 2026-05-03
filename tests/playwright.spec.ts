import { test, expect } from '@playwright/test'

const BASE_URL = 'https://robocode.rahejaom.workers.dev'

test('homepage loads successfully', async ({ page }) => {
  const response = await page.goto(BASE_URL)
  expect(response?.status()).toBe(200)
  await expect(page).toHaveTitle(/robocode/i)
})

test('battle page loads', async ({ page }) => {
  await page.goto(`${BASE_URL}/battle`)
  await expect(page.locator('body')).toBeVisible()
})

test('dashboard page loads', async ({ page }) => {
  await page.goto(`${BASE_URL}/dashboard`)
  await expect(page.locator('body')).toBeVisible()
})

test('shop page loads', async ({ page }) => {
  await page.goto(`${BASE_URL}/shop`)
  await expect(page.locator('body')).toBeVisible()
})

test('leaderboard page loads', async ({ page }) => {
  await page.goto(`${BASE_URL}/leaderboard`)
  await expect(page.locator('body')).toBeVisible()
})

test('story page loads', async ({ page }) => {
  await page.goto(`${BASE_URL}/story`)
  await expect(page.locator('body')).toBeVisible()
})

test('sandbox page loads', async ({ page }) => {
  await page.goto(`${BASE_URL}/sandbox`)
  await expect(page.locator('body')).toBeVisible()
})

test('404 page for non-existent route', async ({ page }) => {
  const response = await page.goto(`${BASE_URL}/nonexistent-route-12345`)
  expect(response?.status()).toBe(404)
})
