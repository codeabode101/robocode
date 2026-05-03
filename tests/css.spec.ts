import { test, expect } from '@playwright/test'

const URL = 'https://robocode.rahejaom.workers.dev'

test('homepage background has correct layers', async ({ page }) => {
  await page.goto(URL)

  const main = page.locator('main')
  const bgClass = await main.getAttribute('class')
  expect(bgClass).toContain('bg-[#050510]')
  expect(bgClass).toContain('overflow-hidden')
})

test('grid pattern overlay exists with inline style', async ({ page }) => {
  await page.goto(URL)

  const gridOverlay = page.locator('div[class*="opacity-20"]').first()
  await expect(gridOverlay).toHaveAttribute('class', /opacity-20/)
  const style = await gridOverlay.evaluate((el) => el.getAttribute('style'))
  expect(style).toContain('linear-gradient')
})

test('title uses gradient text', async ({ page }) => {
  await page.goto(URL)

  const title = page.locator('h1 span')
  const classes = await title.getAttribute('class')
  expect(classes).toContain('bg-gradient-to-r')
  expect(classes).toContain('from-emerald-400')
  expect(classes).toContain('bg-clip-text')
  expect(classes).toContain('text-transparent')
})

test('feature cards have proper styling', async ({ page }) => {
  await page.goto(URL)

  const cards = page.locator('div[class*="rounded-xl"][class*="backdrop-blur"]')
  await expect(cards).toHaveCount(3)

  const firstCard = cards.first()
  const cardClass = await firstCard.getAttribute('class')
  expect(cardClass).toContain('border-emerald-500/20')
  expect(cardClass).toContain('backdrop-blur-sm')
})

test('CTA button has hover effects defined in classes', async ({ page }) => {
  await page.goto(URL)

  const button = page.locator('button', { hasText: 'Enter the Dojo' })
  const classes = await button.getAttribute('class')

  expect(classes).toContain('bg-emerald-500')
  expect(classes).toContain('hover:bg-emerald-400')
  expect(classes).toContain('hover:scale-105')
  expect(classes).toContain('active:scale-95')
  expect(classes).toContain('hover:shadow-')
})

test('page layout is centered vertically and horizontally', async ({ page }) => {
  await page.goto(URL)

  const content = page.locator('div.relative.z-10')
  const box = await content.boundingBox()
  expect(box).not.toBeNull()

  const viewport = page.viewportSize()
  expect(viewport).not.toBeNull()

  const centerY = box!.y + box!.height / 2
  const centerDiff = Math.abs(centerY - viewport!.height / 2)
  expect(centerDiff).toBeLessThan(100)
})

test('beta badge has ping animation class', async ({ page }) => {
  await page.goto(URL)

  const pingDot = page.locator('span[class*="animate-ping"]')
  await expect(pingDot).toHaveCount(1)
  const classes = await pingDot.getAttribute('class')
  expect(classes).toContain('animate-ping')
  expect(classes).toContain('rounded-full')
})

test('font families are set via Tailwind classes', async ({ page }) => {
  await page.goto(URL)

  // Check that the h1 has the font-display class applied
  const title = page.locator('h1')
  const classes = await title.getAttribute('class')
  expect(classes).toContain('font-display')

  // Check that subtitle has font-mono class
  const subtitle = page.locator('p.font-mono')
  await expect(subtitle).toHaveCount(1)
})

test('footer line uses gradient spans', async ({ page }) => {
  await page.goto(URL)

  // Find the footer div by its unique text
  const footer = page.locator('div:has-text("Code · Fight · Learn")').last()

  // Get the h-px spans specifically (footer line decorations)
  const lineSpans = footer.locator('span.h-px')
  await expect(lineSpans).toHaveCount(2)

  const firstClass = await lineSpans.first().getAttribute('class')
  expect(firstClass).toContain('bg-gradient-to-r')

  const lastClass = await lineSpans.last().getAttribute('class')
  expect(lastClass).toContain('bg-gradient-to-l')
})

test('robot icon container has backdrop blur and shadow', async ({ page }) => {
  await page.goto(URL)

  const iconContainer = page.locator('div[class*="shadow-"]').first()
  const classes = await iconContainer.getAttribute('class')
  expect(classes).toContain('backdrop-blur-sm')
  expect(classes).toContain('rounded-2xl')
})
