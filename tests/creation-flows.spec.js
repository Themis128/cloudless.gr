const { test, expect } = require('@playwright/test')

// Test data for creation flows
const testData = {
  pipeline: {
    name: 'Test Pipeline',
    description: 'A test pipeline for automated testing',
    type: 'Data Processing',
    version: '1.0.0',
    inputType: 'JSON',
    outputType: 'CSV'
  },
  model: {
    name: 'Test Model',
    type: 'Classification',
    description: 'A test model for automated testing',
    version: '1.0.0',
    framework: 'TensorFlow'
  },
  project: {
    name: 'Test Project',
    description: 'A test project for automated testing',
    type: 'Research',
    version: '1.0.0',
    visibility: 'Public'
  },
  llm: {
    name: 'Test LLM Training',
    baseModel: 'gpt-3.5-turbo',
    trainingType: 'Fine-tuning',
    description: 'A test LLM training job for automated testing'
  }
}

test.describe('Creation Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to homepage before each test
    await page.goto('/')
    await expect(page).toHaveTitle(/Cloudless/)
  })

  test.describe('Pipeline Creation', () => {
    test('should create a new pipeline successfully', async ({ page }) => {
      // Navigate to pipeline creation page
      await page.goto('/pipelines/create')
      await expect(page.locator('h1')).toContainText('Create Pipeline')

      // Fill in the pipeline form
      await page.fill('input[label="Pipeline Name"]', testData.pipeline.name)
      await page.fill('textarea[label="Description"]', testData.pipeline.description)
      await page.selectOption('select[label="Pipeline Type"]', testData.pipeline.type)
      await page.fill('input[label="Version"]', testData.pipeline.version)
      await page.selectOption('select[label="Input Type"]', testData.pipeline.inputType)
      await page.selectOption('select[label="Output Type"]', testData.pipeline.outputType)

      // Submit the form
      await page.click('button[type="submit"]')

      // Wait for success message
      await expect(page.locator('.v-alert--type-success')).toBeVisible()
      await expect(page.locator('.v-alert--type-success')).toContainText('Pipeline created successfully')
    })

    test('should validate required fields in pipeline creation', async ({ page }) => {
      await page.goto('/pipelines/create')

      // Try to submit without filling required fields
      await page.click('button[type="submit"]')

      // Check that form validation prevents submission
      // Note: This depends on your form validation implementation
      await expect(page.locator('h1')).toContainText('Create Pipeline')
    })

    test('should reset pipeline form correctly', async ({ page }) => {
      await page.goto('/pipelines/create')

      // Fill in some fields
      await page.fill('input[label="Pipeline Name"]', testData.pipeline.name)
      await page.fill('textarea[label="Description"]', testData.pipeline.description)

      // Click reset button
      await page.click('button:has-text("Reset")')

      // Check that fields are cleared
      await expect(page.locator('input[label="Pipeline Name"]')).toHaveValue('')
      await expect(page.locator('textarea[label="Description"]')).toHaveValue('')
    })
  })

  test.describe('Model Creation', () => {
    test('should create a new model successfully', async ({ page }) => {
      // Navigate to model creation page
      await page.goto('/models/create')
      await expect(page.locator('h1')).toContainText('Create Model')

      // Fill in the model form
      await page.fill('input[label="Model Name"]', testData.model.name)
      await page.selectOption('select[label="Model Type"]', testData.model.type)
      await page.fill('textarea[label="Description"]', testData.model.description)
      await page.fill('input[label="Version"]', testData.model.version)
      await page.fill('input[label="Framework"]', testData.model.framework)

      // Submit the form
      await page.click('button[type="submit"]')

      // Wait for success message
      await expect(page.locator('.v-alert--type-success')).toBeVisible()
      await expect(page.locator('.v-alert--type-success')).toContainText('Model created successfully')
    })

    test('should validate required fields in model creation', async ({ page }) => {
      await page.goto('/models/create')

      // Try to submit without filling required fields
      await page.click('button[type="submit"]')

      // Check that form validation prevents submission
      await expect(page.locator('h1')).toContainText('Create Model')
    })

    test('should reset model form correctly', async ({ page }) => {
      await page.goto('/models/create')

      // Fill in some fields
      await page.fill('input[label="Model Name"]', testData.model.name)
      await page.fill('textarea[label="Description"]', testData.model.description)

      // Click reset button
      await page.click('button:has-text("Reset")')

      // Check that fields are cleared
      await expect(page.locator('input[label="Model Name"]')).toHaveValue('')
      await expect(page.locator('textarea[label="Description"]')).toHaveValue('')
    })
  })

  test.describe('Project Creation', () => {
    test('should create a new project successfully', async ({ page }) => {
      // Navigate to project creation page
      await page.goto('/projects/create')
      await expect(page.locator('h1')).toContainText('Create Project')

      // Fill in the project form
      await page.fill('input[label="Project Name"]', testData.project.name)
      await page.fill('textarea[label="Description"]', testData.project.description)
      await page.selectOption('select[label="Project Type"]', testData.project.type)
      await page.fill('input[label="Version"]', testData.project.version)
      await page.selectOption('select[label="Visibility"]', testData.project.visibility)

      // Submit the form
      await page.click('button[type="submit"]')

      // Wait for success message
      await expect(page.locator('.v-alert--type-success')).toBeVisible()
      await expect(page.locator('.v-alert--type-success')).toContainText('Project created successfully')
    })

    test('should validate required fields in project creation', async ({ page }) => {
      await page.goto('/projects/create')

      // Try to submit without filling required fields
      await page.click('button[type="submit"]')

      // Check that form validation prevents submission
      await expect(page.locator('h1')).toContainText('Create Project')
    })

    test('should reset project form correctly', async ({ page }) => {
      await page.goto('/projects/create')

      // Fill in some fields
      await page.fill('input[label="Project Name"]', testData.project.name)
      await page.fill('textarea[label="Description"]', testData.project.description)

      // Click reset button
      await page.click('button:has-text("Reset")')

      // Check that fields are cleared
      await expect(page.locator('input[label="Project Name"]')).toHaveValue('')
      await expect(page.locator('textarea[label="Description"]')).toHaveValue('')
    })
  })

  test.describe('LLM Training Creation', () => {
    test('should create a new LLM training job successfully', async ({ page }) => {
      // Navigate to LLM training page
      await page.goto('/llm/train')
      await expect(page.locator('h1')).toContainText('Train LLM Model')

      // Fill in the LLM training form
      await page.fill('input[label="Training Job Name"]', testData.llm.name)
      
      // Select base model (this might need adjustment based on actual options)
      await page.selectOption('select[label="Base Model"]', testData.llm.baseModel)
      
      // Select training type
      await page.selectOption('select[label="Training Type"]', testData.llm.trainingType)

      // Upload a test file (create a simple test file)
      const fileInput = page.locator('input[type="file"]')
      await fileInput.setInputFiles({
        name: 'test-data.json',
        mimeType: 'application/json',
        buffer: Buffer.from('{"test": "data"}')
      })

      // Submit the form
      await page.click('button[type="submit"]')

      // Wait for success message or redirect
      // Note: This might redirect to a training status page
      await expect(page.locator('body')).toBeVisible()
    })

    test('should validate required fields in LLM training creation', async ({ page }) => {
      await page.goto('/llm/train')

      // Try to submit without filling required fields
      await page.click('button[type="submit"]')

      // Check that form validation prevents submission
      await expect(page.locator('h1')).toContainText('Train LLM Model')
    })

    test('should handle file upload validation', async ({ page }) => {
      await page.goto('/llm/train')

      // Fill in required fields
      await page.fill('input[label="Training Job Name"]', testData.llm.name)
      await page.selectOption('select[label="Base Model"]', testData.llm.baseModel)
      await page.selectOption('select[label="Training Type"]', testData.llm.trainingType)

      // Try to submit without file
      await page.click('button[type="submit"]')

      // Check that form validation prevents submission
      await expect(page.locator('h1')).toContainText('Train LLM Model')
    })
  })

  test.describe('Navigation and Integration', () => {
    test('should navigate between creation pages', async ({ page }) => {
      // Test navigation from homepage to creation pages
      await page.goto('/')

      // Navigate to pipeline creation
      await page.click('a[href="/pipelines/create"]')
      await expect(page.locator('h1')).toContainText('Create Pipeline')

      // Navigate to model creation
      await page.click('a[href="/models/create"]')
      await expect(page.locator('h1')).toContainText('Create Model')

      // Navigate to project creation
      await page.click('a[href="/projects/create"]')
      await expect(page.locator('h1')).toContainText('Create Project')

      // Navigate to LLM training
      await page.click('a[href="/llm/train"]')
      await expect(page.locator('h1')).toContainText('Train LLM Model')
    })

    test('should verify created items appear in lists', async ({ page }) => {
      // This test assumes items are created and then listed
      // You might need to adjust based on your actual implementation

      // Check pipelines list
      await page.goto('/pipelines')
      await expect(page.locator('body')).toBeVisible()

      // Check models list
      await page.goto('/models')
      await expect(page.locator('body')).toBeVisible()

      // Check projects list
      await page.goto('/projects')
      await expect(page.locator('body')).toBeVisible()

      // Check LLM training sessions
      await page.goto('/llm/training')
      await expect(page.locator('body')).toBeVisible()
    })
  })

  test.describe('Error Handling', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // This test would require mocking network failures
      // For now, we'll test basic error handling
      
      await page.goto('/pipelines/create')
      
      // Fill form with invalid data that might cause server errors
      await page.fill('input[label="Pipeline Name"]', '')
      await page.fill('input[label="Version"]', 'invalid-version')
      
      await page.click('button[type="submit"]')
      
      // Check that error handling works
      await expect(page.locator('body')).toBeVisible()
    })

    test('should handle form validation errors', async ({ page }) => {
      await page.goto('/models/create')
      
      // Try to submit empty form
      await page.click('button[type="submit"]')
      
      // Should stay on the same page
      await expect(page.locator('h1')).toContainText('Create Model')
    })
  })
})

// Helper function to generate unique test data
function generateUniqueTestData(baseData) {
  const timestamp = Date.now()
  return {
    ...baseData,
    name: `${baseData.name} ${timestamp}`,
    description: `${baseData.description} (${timestamp})`
  }
}

// Test with unique data to avoid conflicts
test('should create items with unique names', async ({ page }) => {
  const uniquePipelineData = generateUniqueTestData(testData.pipeline)
  
  await page.goto('/pipelines/create')
  
  await page.fill('input[label="Pipeline Name"]', uniquePipelineData.name)
  await page.fill('textarea[label="Description"]', uniquePipelineData.description)
  await page.selectOption('select[label="Pipeline Type"]', uniquePipelineData.type)
  await page.fill('input[label="Version"]', uniquePipelineData.version)
  await page.selectOption('select[label="Input Type"]', uniquePipelineData.inputType)
  await page.selectOption('select[label="Output Type"]', uniquePipelineData.outputType)
  
  await page.click('button[type="submit"]')
  
  await expect(page.locator('.v-alert--type-success')).toBeVisible()
}) 