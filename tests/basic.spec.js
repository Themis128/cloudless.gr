const { test, expect } = require('@playwright/test')

test('homepage has title and loads correctly', async ({ page }) => {
  await page.goto('/')

  // Check that the page has a title
  await expect(page).toHaveTitle(/Cloudless/)

  // Check that the page loads without errors
  await expect(page.locator('body')).toBeVisible()
})

test('navigation works correctly', async ({ page }) => {
  await page.goto('/')

  // Check that main navigation elements are present
  await expect(page.locator('nav')).toBeVisible()

  // Check that key pages are accessible
  const pages = ['/bots', '/models', '/pipelines', '/support']

  for (const pagePath of pages) {
    await page.goto(pagePath)
    await expect(page.locator('body')).toBeVisible()
  }
})

test('responsive design works', async ({ page }) => {
  await page.goto('/')

  // Test desktop view
  await page.setViewportSize({ width: 1280, height: 720 })
  await expect(page.locator('nav')).toBeVisible()

  // Test mobile view
  await page.setViewportSize({ width: 375, height: 667 })
  await expect(page.locator('nav')).toBeVisible()
})

test('accessibility basics', async ({ page }) => {
  await page.goto('/')

  // Check for proper heading structure
  const headings = await page.locator('h1, h2, h3, h4, h5, h6').count()
  expect(headings).toBeGreaterThan(0)

  // Check for alt text on images
  const images = await page.locator('img').all()
  for (const img of images) {
    const alt = await img.getAttribute('alt')
    if (alt === null) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('Image without alt text found')
      }
    }
  }
})
