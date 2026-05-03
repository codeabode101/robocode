import { test, expect } from '@playwright/test'

test('homepage has styled hero section', async ({ page }) => {
  await page.goto('https://robocode.rahejaom.workers.dev')

  // Title visible with gradient
  await expect(page.getByText('ROBOCODE')).toBeVisible()
  const title = page.locator('h1 span')
  await expect(title).toHaveClass(/bg-gradient-to-r/)

  // Feature cards visible
  await expect(page.getByRole('heading', { name: 'Battle' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Learn' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Compete' })).toBeVisible()

  // CTA button styled
  const button = page.locator('button', { hasText: 'Enter the Dojo' })
  await expect(button).toBeVisible()
  const classes = await button.getAttribute('class')
  expect(classes).toContain('bg-emerald-500')
})

test('onboarding has styled welcome screen', async ({ page }) => {
  await page.goto('https://robocode.rahejaom.workers.dev/onboarding')

  await expect(page.getByText('Welcome to Robocode!')).toBeVisible({ timeout: 5000 })
  await expect(page.getByText('Start Your Journey')).toBeVisible()
  await expect(page.getByText('🤖').first()).toBeVisible()
})

test('Enter the Dojo button navigates to onboarding', async ({ page }) => {
  await page.goto('https://robocode.rahejaom.workers.dev')
  await page.getByText('Enter the Dojo').click()
  await expect(page).toHaveURL(/onboarding/)
  await expect(page.getByText('Welcome to Robocode!')).toBeVisible({ timeout: 5000 })
})
