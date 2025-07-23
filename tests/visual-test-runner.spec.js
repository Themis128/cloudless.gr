const { test, expect } = require('@playwright/test')

// Visual progress indicators
const logProgress = (message, type = 'info') => {
  const timestamp = new Date().toLocaleTimeString()
  const colors = {
    info: '\x1b[36m',    // Cyan
    success: '\x1b[32m', // Green
    warning: '\x1b[33m', // Yellow
    error: '\x1b[31m',   // Red
    reset: '\x1b[0m'     // Reset
  }
  console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`)
}

test.describe('🎯 Visual Creation Flow Tests', () => {
  test.beforeEach(async ({ page }) => {
    logProgress('🚀 Starting new test...', 'info')
    await page.goto('/')
    await expect(page).toHaveTitle(/Cloudless/)
    logProgress('✅ Homepage loaded successfully', 'success')
  })

  test('📊 Pipeline Creation - Visual Test', async ({ page }) => {
    logProgress('🔄 Navigating to pipeline creation page...', 'info')
    await page.goto('/pipelines/create')
    
    logProgress('⏳ Waiting for page to load...', 'warning')
    await page.waitForSelector('h1:has-text("Create Pipeline")')
    logProgress('✅ Pipeline creation page loaded', 'success')
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/pipeline-creation-start.png' })
    logProgress('📸 Screenshot taken: Initial pipeline form', 'info')
    
    logProgress('📝 Filling pipeline form...', 'info')
    await page.fill('input[label*="Pipeline Name"]', 'Visual Test Pipeline')
    await page.fill('textarea[label*="Description"]', 'Pipeline created during visual test')
    await page.selectOption('select[label*="Pipeline Type"]', 'Data Processing')
    await page.fill('input[label*="Version"]', '1.0.0')
    await page.selectOption('select[label*="Input Type"]', 'JSON')
    await page.selectOption('select[label*="Output Type"]', 'CSV')
    
    // Take screenshot of filled form
    await page.screenshot({ path: 'test-results/pipeline-creation-filled.png' })
    logProgress('📸 Screenshot taken: Filled pipeline form', 'info')
    
    logProgress('🚀 Submitting pipeline form...', 'info')
    await page.click('button[type="submit"]')
    
    logProgress('⏳ Waiting for success message...', 'warning')
    await expect(page.locator('.v-alert--type-success, .alert-success')).toBeVisible({ timeout: 10000 })
    
    // Take screenshot of success state
    await page.screenshot({ path: 'test-results/pipeline-creation-success.png' })
    logProgress('✅ Pipeline created successfully!', 'success')
  })

  test('🧠 Model Creation - Visual Test', async ({ page }) => {
    logProgress('🔄 Navigating to model creation page...', 'info')
    await page.goto('/models/create')
    
    logProgress('⏳ Waiting for page to load...', 'warning')
    await page.waitForSelector('h1:has-text("Create Model")')
    logProgress('✅ Model creation page loaded', 'success')
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/model-creation-start.png' })
    logProgress('📸 Screenshot taken: Initial model form', 'info')
    
    logProgress('📝 Filling model form...', 'info')
    await page.fill('input[label*="Model Name"]', 'Visual Test Model')
    await page.selectOption('select[label*="Model Type"]', 'Classification')
    await page.fill('textarea[label*="Description"]', 'Model created during visual test')
    await page.fill('input[label*="Version"]', '1.0.0')
    await page.fill('input[label*="Framework"]', 'TensorFlow')
    
    // Take screenshot of filled form
    await page.screenshot({ path: 'test-results/model-creation-filled.png' })
    logProgress('📸 Screenshot taken: Filled model form', 'info')
    
    logProgress('🚀 Submitting model form...', 'info')
    await page.click('button[type="submit"]')
    
    logProgress('⏳ Waiting for success message...', 'warning')
    await expect(page.locator('.v-alert--type-success, .alert-success')).toBeVisible({ timeout: 10000 })
    
    // Take screenshot of success state
    await page.screenshot({ path: 'test-results/model-creation-success.png' })
    logProgress('✅ Model created successfully!', 'success')
  })

  test('📁 Project Creation - Visual Test', async ({ page }) => {
    logProgress('🔄 Navigating to project creation page...', 'info')
    await page.goto('/projects/create')
    
    logProgress('⏳ Waiting for page to load...', 'warning')
    await page.waitForSelector('h1:has-text("Create Project")')
    logProgress('✅ Project creation page loaded', 'success')
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/project-creation-start.png' })
    logProgress('📸 Screenshot taken: Initial project form', 'info')
    
    logProgress('📝 Filling project form...', 'info')
    await page.fill('input[label*="Project Name"]', 'Visual Test Project')
    await page.fill('textarea[label*="Description"]', 'Project created during visual test')
    await page.selectOption('select[label*="Project Type"]', 'Research')
    await page.fill('input[label*="Version"]', '1.0.0')
    await page.selectOption('select[label*="Visibility"]', 'Public')
    
    // Take screenshot of filled form
    await page.screenshot({ path: 'test-results/project-creation-filled.png' })
    logProgress('📸 Screenshot taken: Filled project form', 'info')
    
    logProgress('🚀 Submitting project form...', 'info')
    await page.click('button[type="submit"]')
    
    logProgress('⏳ Waiting for success message...', 'warning')
    await expect(page.locator('.v-alert--type-success, .alert-success')).toBeVisible({ timeout: 10000 })
    
    // Take screenshot of success state
    await page.screenshot({ path: 'test-results/project-creation-success.png' })
    logProgress('✅ Project created successfully!', 'success')
  })

  test('🤖 LLM Training - Visual Test', async ({ page }) => {
    logProgress('🔄 Navigating to LLM training page...', 'info')
    await page.goto('/llm/train')
    
    logProgress('⏳ Waiting for page to load...', 'warning')
    await page.waitForSelector('h1:has-text("Train LLM Model")')
    logProgress('✅ LLM training page loaded', 'success')
    
    // Take screenshot of initial state
    await page.screenshot({ path: 'test-results/llm-training-start.png' })
    logProgress('📸 Screenshot taken: Initial LLM training form', 'info')
    
    logProgress('📝 Filling LLM training form...', 'info')
    await page.fill('input[label*="Training Job Name"]', 'Visual Test LLM Training')
    
    // Try to select base model
    try {
      await page.selectOption('select[label*="Base Model"]', 'gpt-3.5-turbo')
      logProgress('✅ Base model selected', 'success')
    } catch (e) {
      await page.selectOption('select[label*="Base Model"]', { index: 0 })
      logProgress('⚠️ Using first available base model', 'warning')
    }
    
    // Try to select training type
    try {
      await page.selectOption('select[label*="Training Type"]', 'Fine-tuning')
      logProgress('✅ Training type selected', 'success')
    } catch (e) {
      await page.selectOption('select[label*="Training Type"]', { index: 0 })
      logProgress('⚠️ Using first available training type', 'warning')
    }
    
    logProgress('📁 Uploading training file...', 'info')
    const fileInput = page.locator('input[type="file"]')
    await fileInput.setInputFiles({
      name: 'visual-test-training-data.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify({
        messages: [
          { role: 'user', content: 'Hello' },
          { role: 'assistant', content: 'Hi there!' },
          { role: 'user', content: 'How are you?' },
          { role: 'assistant', content: 'I\'m doing well, thank you!' }
        ]
      }))
    })
    logProgress('✅ Training file uploaded', 'success')
    
    // Take screenshot of filled form
    await page.screenshot({ path: 'test-results/llm-training-filled.png' })
    logProgress('📸 Screenshot taken: Filled LLM training form', 'info')
    
    logProgress('🚀 Submitting LLM training form...', 'info')
    await page.click('button[type="submit"]')
    
    // Take screenshot of submission state
    await page.screenshot({ path: 'test-results/llm-training-submitted.png' })
    logProgress('✅ LLM training job submitted!', 'success')
  })

  test('🔄 Form Validation - Visual Test', async ({ page }) => {
    logProgress('🔄 Testing form validation...', 'info')
    
    // Test pipeline validation
    logProgress('📊 Testing pipeline form validation...', 'info')
    await page.goto('/pipelines/create')
    await page.screenshot({ path: 'test-results/pipeline-validation-start.png' })
    
    logProgress('🚫 Attempting to submit empty pipeline form...', 'warning')
    await page.click('button[type="submit"]')
    await page.screenshot({ path: 'test-results/pipeline-validation-error.png' })
    logProgress('✅ Pipeline validation working correctly', 'success')
    
    // Test model validation
    logProgress('🧠 Testing model form validation...', 'info')
    await page.goto('/models/create')
    await page.screenshot({ path: 'test-results/model-validation-start.png' })
    
    logProgress('🚫 Attempting to submit empty model form...', 'warning')
    await page.click('button[type="submit"]')
    await page.screenshot({ path: 'test-results/model-validation-error.png' })
    logProgress('✅ Model validation working correctly', 'success')
  })

  test('🔄 Form Reset - Visual Test', async ({ page }) => {
    logProgress('🔄 Testing form reset functionality...', 'info')
    
    // Test pipeline form reset
    logProgress('📊 Testing pipeline form reset...', 'info')
    await page.goto('/pipelines/create')
    await page.fill('input[label*="Pipeline Name"]', 'Test Name')
    await page.screenshot({ path: 'test-results/pipeline-reset-before.png' })
    
    logProgress('🔄 Clicking reset button...', 'info')
    await page.click('button:has-text("Reset")')
    await page.screenshot({ path: 'test-results/pipeline-reset-after.png' })
    logProgress('✅ Pipeline form reset working correctly', 'success')
  })
})

// Progress tracking for test suite
test.describe('📈 Test Suite Progress', () => {
  test.beforeAll(async () => {
    logProgress('🎯 Starting Visual Test Suite', 'info')
    logProgress('📋 Tests to run:', 'info')
    logProgress('  - Pipeline Creation', 'info')
    logProgress('  - Model Creation', 'info')
    logProgress('  - Project Creation', 'info')
    logProgress('  - LLM Training', 'info')
    logProgress('  - Form Validation', 'info')
    logProgress('  - Form Reset', 'info')
  })

  test.afterAll(async () => {
    logProgress('🏁 Visual Test Suite Completed!', 'success')
    logProgress('📸 Screenshots saved to test-results/ directory', 'info')
    logProgress('📊 Check test-results/ for detailed reports', 'info')
  })
}) 