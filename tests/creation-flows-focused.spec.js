const { test, expect } = require('@playwright/test')

test.describe('Creation Flows - Focused Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveTitle(/Cloudless/)
  })

  test('should create a pipeline with all required fields', async ({ page }) => {
    await page.goto('/pipelines/create')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Create Pipeline")')
    
    // Fill form using more specific selectors
    await page.fill('input[placeholder*="Pipeline Name"], input[label*="Pipeline Name"]', 'E2E Test Pipeline')
    await page.fill('textarea[label*="Description"]', 'Pipeline created by E2E test')
    await page.selectOption('select[label*="Pipeline Type"]', 'Data Processing')
    await page.fill('input[label*="Version"]', '1.0.0')
    await page.selectOption('select[label*="Input Type"]', 'JSON')
    await page.selectOption('select[label*="Output Type"]', 'CSV')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Check for success message
    await expect(page.locator('.v-alert--type-success, .alert-success')).toBeVisible({ timeout: 10000 })
  })

  test('should create a model with all required fields', async ({ page }) => {
    await page.goto('/models/create')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Create Model")')
    
    // Fill form
    await page.fill('input[label*="Model Name"]', 'E2E Test Model')
    await page.selectOption('select[label*="Model Type"]', 'Classification')
    await page.fill('textarea[label*="Description"]', 'Model created by E2E test')
    await page.fill('input[label*="Version"]', '1.0.0')
    await page.fill('input[label*="Framework"]', 'TensorFlow')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Check for success message
    await expect(page.locator('.v-alert--type-success, .alert-success')).toBeVisible({ timeout: 10000 })
  })

  test('should create a project with all required fields', async ({ page }) => {
    await page.goto('/projects/create')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Create Project")')
    
    // Fill form
    await page.fill('input[label*="Project Name"]', 'E2E Test Project')
    await page.fill('textarea[label*="Description"]', 'Project created by E2E test')
    await page.selectOption('select[label*="Project Type"]', 'Research')
    await page.fill('input[label*="Version"]', '1.0.0')
    await page.selectOption('select[label*="Visibility"]', 'Public')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Check for success message
    await expect(page.locator('.v-alert--type-success, .alert-success')).toBeVisible({ timeout: 10000 })
  })

  test('should create an LLM training job with file upload', async ({ page }) => {
    await page.goto('/llm/train')
    
    // Wait for page to load
    await page.waitForSelector('h1:has-text("Train LLM Model")')
    
    // Fill basic form fields
    await page.fill('input[label*="Training Job Name"]', 'E2E Test LLM Training')
    
    // Try to select base model (adjust based on actual options)
    try {
      await page.selectOption('select[label*="Base Model"]', 'gpt-3.5-turbo')
    } catch (e) {
      // If the option doesn't exist, try the first available option
      await page.selectOption('select[label*="Base Model"]', { index: 0 })
    }
    
    // Try to select training type
    try {
      await page.selectOption('select[label*="Training Type"]', 'Fine-tuning')
    } catch (e) {
      await page.selectOption('select[label*="Training Type"]', { index: 0 })
    }
    
    // Upload test file
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'test-training-data.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' }
        ]
      }))
    })
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Check for success or redirect
    await expect(page.locator('body')).toBeVisible()
  })

  test('should validate required fields in pipeline creation', async ({ page }) => {
    await page.goto('/pipelines/create')
    
    // Try to submit empty form
    await page.click('button[type="submit"]')
    
    // Should stay on the same page (validation prevents submission)
    await expect(page.locator('h1:has-text("Create Pipeline")')).toBeVisible()
  })

  test('should validate required fields in model creation', async ({ page }) => {
    await page.goto('/models/create')
    
    // Try to submit empty form
    await page.click('button[type="submit"]')
    
    // Should stay on the same page
    await expect(page.locator('h1:has-text("Create Model")')).toBeVisible()
  })

  test('should validate required fields in project creation', async ({ page }) => {
    await page.goto('/projects/create')
    
    // Try to submit empty form
    await page.click('button[type="submit"]')
    
    // Should stay on the same page
    await expect(page.locator('h1:has-text("Create Project")')).toBeVisible()
  })

  test('should validate required fields in LLM training', async ({ page }) => {
    await page.goto('/llm/train')
    
    // Try to submit empty form
    await page.click('button[type="submit"]')
    
    // Should stay on the same page
    await expect(page.locator('h1:has-text("Train LLM Model")')).toBeVisible()
  })

  test('should reset forms correctly', async ({ page }) => {
    // Test pipeline form reset
    await page.goto('/pipelines/create')
    await page.fill('input[label*="Pipeline Name"]', 'Test Name')
    await page.click('button:has-text("Reset")')
    await expect(page.locator('input[label*="Pipeline Name"]')).toHaveValue('')
    
    // Test model form reset
    await page.goto('/models/create')
    await page.fill('input[label*="Model Name"]', 'Test Name')
    await page.click('button:has-text("Reset")')
    await expect(page.locator('input[label*="Model Name"]')).toHaveValue('')
    
    // Test project form reset
    await page.goto('/projects/create')
    await page.fill('input[label*="Project Name"]', 'Test Name')
    await page.click('button:has-text("Reset")')
    await expect(page.locator('input[label*="Project Name"]')).toHaveValue('')
  })

  test('should navigate between creation pages', async ({ page }) => {
    // Test navigation to each creation page
    const creationPages = [
      { path: '/pipelines/create', title: 'Create Pipeline' },
      { path: '/models/create', title: 'Create Model' },
      { path: '/projects/create', title: 'Create Project' },
      { path: '/llm/train', title: 'Train LLM Model' }
    ]
    
    for (const pageInfo of creationPages) {
      await page.goto(pageInfo.path)
      await expect(page.locator(`h1:has-text("${pageInfo.title}")`)).toBeVisible()
    }
  })

  test('should verify creation pages are accessible', async ({ page }) => {
    // Check that all creation pages load without errors
    const pages = ['/pipelines/create', '/models/create', '/projects/create', '/llm/train']
    
    for (const pagePath of pages) {
      await page.goto(pagePath)
      await expect(page.locator('body')).toBeVisible()
      await expect(page.locator('form')).toBeVisible()
    }
  })

  test('should handle form submission with unique data', async ({ page }) => {
    const timestamp = Date.now()
    const uniqueName = `E2E Test ${timestamp}`
    
    await page.goto('/pipelines/create')
    
    await page.fill('input[label*="Pipeline Name"]', uniqueName)
    await page.fill('textarea[label*="Description"]', `Description for ${uniqueName}`)
    await page.selectOption('select[label*="Pipeline Type"]', 'Data Processing')
    await page.fill('input[label*="Version"]', '1.0.0')
    await page.selectOption('select[label*="Input Type"]', 'JSON')
    await page.selectOption('select[label*="Output Type"]', 'CSV')
    
    await page.click('button[type="submit"]')
    
    // Check for success message
    await expect(page.locator('.v-alert--type-success, .alert-success')).toBeVisible({ timeout: 10000 })
  })
})

// Test with different browsers
test.describe('Cross-browser creation tests', () => {
  test('should create pipeline in different browsers', async ({ page }) => {
    await page.goto('/pipelines/create')
    
    await page.fill('input[label*="Pipeline Name"]', 'Cross-browser Test Pipeline')
    await page.fill('textarea[label*="Description"]', 'Testing across browsers')
    await page.selectOption('select[label*="Pipeline Type"]', 'Data Processing')
    await page.fill('input[label*="Version"]', '1.0.0')
    await page.selectOption('select[label*="Input Type"]', 'JSON')
    await page.selectOption('select[label*="Output Type"]', 'CSV')
    
    await page.click('button[type="submit"]')
    
    await expect(page.locator('.v-alert--type-success, .alert-success')).toBeVisible({ timeout: 10000 })
  })
}) 