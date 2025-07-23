const { test, expect } = require('@playwright/test')

test.describe('📊 Data Flow Tests', () => {
  test('🔄 Complete Pipeline Workflow', async ({ page }) => {
    // 1. Create a pipeline
    await page.goto('http://192.168.0.23:3000/pipelines/create')
    await page.waitForLoadState('networkidle')
    
    const pipelineName = `Data Flow Test Pipeline ${Date.now()}`
    await page.fill('input[aria-label="Pipeline Name"]', pipelineName)
    await page.fill('textarea[aria-label="Description"]', 'Pipeline for data flow testing')
    
    // Select pipeline type
    await page.click('.v-select:has-text("Pipeline Type")')
    await page.click('.v-list-item:has-text("Data Processing")')
    
    await page.fill('input[aria-label="Version"]', '1.0.0')
    
    // Select input/output types
    await page.click('.v-select:has-text("Input Type")')
    await page.click('.v-list-item:has-text("JSON")')
    
    await page.click('.v-select:has-text("Output Type")')
    await page.click('.v-list-item:has-text("CSV")')
    
    // Submit the form
    await page.click('button[type="submit"]')
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 10000 })
    
    // 2. Verify pipeline was created by checking the pipeline list
    await page.goto('http://192.168.0.23:3000/pipelines')
    await page.waitForLoadState('networkidle')
    
    // Check if the pipeline appears in the list
    const pipelineInList = page.locator(`text=${pipelineName}`)
    await expect(pipelineInList).toBeVisible()
  })

  test('🔄 Complete Model Workflow', async ({ page }) => {
    // 1. Create a model
    await page.goto('http://192.168.0.23:3000/models/create')
    await page.waitForLoadState('networkidle')
    
    const modelName = `Data Flow Test Model ${Date.now()}`
    await page.fill('input[aria-label="Model Name"]', modelName)
    await page.fill('textarea[aria-label="Description"]', 'Model for data flow testing')
    
    // Select model type
    await page.click('.v-select:has-text("Model Type")')
    await page.click('.v-list-item:has-text("Classification")')
    
    await page.fill('input[aria-label="Version"]', '1.0.0')
    await page.fill('input[aria-label="Framework"]', 'TensorFlow')
    
    // Submit the form
    await page.click('button[type="submit"]')
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 10000 })
    
    // 2. Verify model was created
    await page.goto('http://192.168.0.23:3000/models')
    await page.waitForLoadState('networkidle')
    
    const modelInList = page.locator(`text=${modelName}`)
    await expect(modelInList).toBeVisible()
  })

  test('🔄 Complete Project Workflow', async ({ page }) => {
    // 1. Create a project
    await page.goto('http://192.168.0.23:3000/projects/create')
    await page.waitForLoadState('networkidle')
    
    const projectName = `Data Flow Test Project ${Date.now()}`
    await page.fill('input[aria-label="Project Name"]', projectName)
    await page.fill('textarea[aria-label="Description"]', 'Project for data flow testing')
    
    // Select project type
    await page.click('.v-select:has-text("Project Type")')
    await page.click('.v-list-item:has-text("Research")')
    
    await page.fill('input[aria-label="Version"]', '1.0.0')
    
    // Select visibility
    await page.click('.v-select:has-text("Visibility")')
    await page.click('.v-list-item:has-text("Public")')
    
    // Submit the form
    await page.click('button[type="submit"]')
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 10000 })
    
    // 2. Verify project was created
    await page.goto('http://192.168.0.23:3000/projects')
    await page.waitForLoadState('networkidle')
    
    const projectInList = page.locator(`text=${projectName}`)
    await expect(projectInList).toBeVisible()
  })

  test('🔄 Cross-Entity Data Relationships', async ({ page }) => {
    // Test that data created in one entity can be referenced in another
    const timestamp = Date.now()
    
    // 1. Create a project first
    await page.goto('http://192.168.0.23:3000/projects/create')
    await page.waitForLoadState('networkidle')
    
    const projectName = `Cross-Entity Project ${timestamp}`
    await page.fill('input[aria-label="Project Name"]', projectName)
    await page.fill('textarea[aria-label="Description"]', 'Project for cross-entity testing')
    
    await page.click('.v-select:has-text("Project Type")')
    await page.click('.v-list-item:has-text("Research")')
    await page.fill('input[aria-label="Version"]', '1.0.0')
    await page.click('.v-select:has-text("Visibility")')
    await page.click('.v-list-item:has-text("Public")')
    
    await page.click('button[type="submit"]')
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 10000 })
    
    // 2. Create a model that references the project
    await page.goto('http://192.168.0.23:3000/models/create')
    await page.waitForLoadState('networkidle')
    
    const modelName = `Cross-Entity Model ${timestamp}`
    await page.fill('input[aria-label="Model Name"]', modelName)
    await page.fill('textarea[aria-label="Description"]', `Model for project: ${projectName}`)
    
    await page.click('.v-select:has-text("Model Type")')
    await page.click('.v-list-item:has-text("Classification")')
    await page.fill('input[aria-label="Version"]', '1.0.0')
    await page.fill('input[aria-label="Framework"]', 'TensorFlow')
    
    await page.click('button[type="submit"]')
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 10000 })
    
    // 3. Verify both entities exist
    await page.goto('http://192.168.0.23:3000/projects')
    await page.waitForLoadState('networkidle')
    await expect(page.locator(`text=${projectName}`)).toBeVisible()
    
    await page.goto('http://192.168.0.23:3000/models')
    await page.waitForLoadState('networkidle')
    await expect(page.locator(`text=${modelName}`)).toBeVisible()
  })

  test('🔄 Data Persistence Across Sessions', async ({ page }) => {
    const testData = `Persistence Test ${Date.now()}`
    
    // 1. Create data in first session
    await page.goto('http://192.168.0.23:3000/pipelines/create')
    await page.waitForLoadState('networkidle')
    
    await page.fill('input[aria-label="Pipeline Name"]', testData)
    await page.fill('textarea[aria-label="Description"]', 'Testing data persistence')
    
    await page.click('.v-select:has-text("Pipeline Type")')
    await page.click('.v-list-item:has-text("Data Processing")')
    await page.fill('input[aria-label="Version"]', '1.0.0')
    await page.click('.v-select:has-text("Input Type")')
    await page.click('.v-list-item:has-text("JSON")')
    await page.click('.v-select:has-text("Output Type")')
    await page.click('.v-list-item:has-text("CSV")')
    
    await page.click('button[type="submit"]')
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 10000 })
    
    // 2. Navigate away and back
    await page.goto('http://192.168.0.23:3000')
    await page.waitForLoadState('networkidle')
    
    // 3. Check that data still exists
    await page.goto('http://192.168.0.23:3000/pipelines')
    await page.waitForLoadState('networkidle')
    
    await expect(page.locator(`text=${testData}`)).toBeVisible()
  })

  test('🔄 Error Recovery and Data Integrity', async ({ page }) => {
    // Test that the app handles errors gracefully and maintains data integrity
    
    // 1. Try to submit invalid data
    await page.goto('http://192.168.0.23:3000/pipelines/create')
    await page.waitForLoadState('networkidle')
    
    // Submit empty form
    await page.click('button[type="submit"]')
    
    // Should show validation errors
    const errorMessages = page.locator('.v-messages__message')
    await expect(errorMessages).toBeVisible()
    
    // 2. Fill form correctly and submit
    await page.fill('input[aria-label="Pipeline Name"]', 'Error Recovery Test')
    await page.fill('textarea[aria-label="Description"]', 'Testing error recovery')
    
    await page.click('.v-select:has-text("Pipeline Type")')
    await page.click('.v-list-item:has-text("Data Processing")')
    await page.fill('input[aria-label="Version"]', '1.0.0')
    await page.click('.v-select:has-text("Input Type")')
    await page.click('.v-list-item:has-text("JSON")')
    await page.click('.v-select:has-text("Output Type")')
    await page.click('.v-list-item:has-text("CSV")')
    
    await page.click('button[type="submit"]')
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 10000 })
    
    // 3. Verify successful submission
    await expect(page.locator('.v-alert--type-success')).toBeVisible()
  })
}) 