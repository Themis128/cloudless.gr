const { test, expect } = require('@playwright/test')

test.describe('🧩 Component Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://192.168.0.23:3000')
    await page.waitForLoadState('networkidle')
  })

  test('🎨 CardLayout Component - Renders correctly', async ({ page }) => {
    // Navigate to a page that uses CardLayout
    await page.goto('http://192.168.0.23:3000/pipelines/create')
    
    // Check if CardLayout component is present
    const cardLayout = page.locator('.v-card')
    await expect(cardLayout).toBeVisible()
    
    // Check for card title
    const cardTitle = page.locator('.v-card-title')
    await expect(cardTitle).toBeVisible()
    
    // Check for card content
    const cardContent = page.locator('.v-card-text')
    await expect(cardContent).toBeVisible()
  })

  test('📝 Form Components - Input validation', async ({ page }) => {
    await page.goto('http://192.168.0.23:3000/pipelines/create')
    
    // Test text input validation
    const nameInput = page.locator('input[aria-label="Pipeline Name"]')
    await nameInput.fill('')
    await nameInput.blur()
    
    // Check for validation error
    const errorMessage = page.locator('.v-messages__message')
    await expect(errorMessage).toBeVisible()
    
    // Fill with valid data
    await nameInput.fill('Valid Pipeline Name')
    await expect(errorMessage).not.toBeVisible()
  })

  test('🔽 Select Components - Dropdown functionality', async ({ page }) => {
    await page.goto('http://192.168.0.23:3000/pipelines/create')
    
    // Test select dropdown
    const pipelineTypeSelect = page.locator('.v-select:has-text("Pipeline Type")')
    await pipelineTypeSelect.click()
    
    // Wait for dropdown to open
    await page.waitForSelector('.v-list-item')
    
    // Select an option
    await page.click('.v-list-item:has-text("Data Processing")')
    
    // Verify selection
    await expect(pipelineTypeSelect).toContainText('Data Processing')
  })

  test('📤 File Upload Component', async ({ page }) => {
    await page.goto('http://192.168.0.23:3000/llm/train')
    
    // Test file upload
    const fileInput = page.locator('input[type="file"]')
    
    // Create a test file
    const testFile = {
      name: 'test-training-data.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      }))
    }
    
    await fileInput.setInputFiles(testFile)
    
    // Verify file was uploaded
    const fileName = page.locator('.v-file-input__text')
    await expect(fileName).toContainText('test-training-data.json')
  })

  test('🔘 Button Components - States and interactions', async ({ page }) => {
    await page.goto('http://192.168.0.23:3000/pipelines/create')
    
    // Test submit button
    const submitButton = page.locator('button[type="submit"]')
    await expect(submitButton).toBeVisible()
    await expect(submitButton).toBeEnabled()
    
    // Test reset button
    const resetButton = page.locator('button:has-text("Reset")')
    await expect(resetButton).toBeVisible()
    await expect(resetButton).toBeEnabled()
    
    // Fill form and test button states
    await page.fill('input[aria-label="Pipeline Name"]', 'Test Pipeline')
    await page.fill('textarea[aria-label="Description"]', 'Test Description')
    
    // Submit button should still be enabled
    await expect(submitButton).toBeEnabled()
  })

  test('📱 Responsive Design - Mobile viewport', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    await page.goto('http://192.168.0.23:3000/pipelines/create')
    
    // Check if form is responsive
    const form = page.locator('.v-form')
    await expect(form).toBeVisible()
    
    // Check if buttons stack vertically on mobile
    const formActions = page.locator('.form-actions')
    const computedStyle = await formActions.evaluate(el => 
      window.getComputedStyle(el).flexDirection
    )
    
    // Should be column on mobile
    expect(computedStyle).toBe('column')
  })

  test('♿ Accessibility - ARIA labels and keyboard navigation', async ({ page }) => {
    await page.goto('http://192.168.0.23:3000/pipelines/create')
    
    // Check for proper ARIA labels
    const nameInput = page.locator('input[aria-label="Pipeline Name"]')
    await expect(nameInput).toBeVisible()
    
    const descInput = page.locator('textarea[aria-label="Description"]')
    await expect(descInput).toBeVisible()
    
    // Test keyboard navigation
    await page.keyboard.press('Tab')
    await expect(nameInput).toBeFocused()
    
    await page.keyboard.press('Tab')
    await expect(descInput).toBeFocused()
  })
}) 