const { test, expect } = require('@playwright/test')

test.describe('⚡ Performance Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Enable performance monitoring
    await page.addInitScript(() => {
      window.performanceMarks = []
      window.performanceMeasures = []
      
      const originalMark = performance.mark
      const originalMeasure = performance.measure
      
      performance.mark = function(name) {
        window.performanceMarks.push({ name, time: performance.now() })
        return originalMark.apply(this, arguments)
      }
      
      performance.measure = function(name, start, end) {
        window.performanceMeasures.push({ name, start, end })
        return originalMeasure.apply(this, arguments)
      }
    })
  })

  test('🚀 Homepage Load Performance', async ({ page }) => {
    const startTime = Date.now()
    
    await page.goto('http://192.168.0.23:3000', { 
      waitUntil: 'networkidle',
      timeout: 30000 
    })
    
    const loadTime = Date.now() - startTime
    
    // Homepage should load within 5 seconds
    expect(loadTime).toBeLessThan(5000)
    
    // Check for performance marks
    const marks = await page.evaluate(() => window.performanceMarks)
    console.log('Performance marks:', marks)
    
    // Verify critical elements load quickly
    await expect(page.locator('h1:has-text("Cloudless Wizard")')).toBeVisible()
  })

  test('📊 Form Submission Performance', async ({ page }) => {
    await page.goto('http://192.168.0.23:3000/pipelines/create')
    await page.waitForLoadState('networkidle')
    
    // Fill form quickly
    await page.fill('input[aria-label="Pipeline Name"]', 'Performance Test Pipeline')
    await page.fill('textarea[aria-label="Description"]', 'Performance test description')
    
    // Select pipeline type
    await page.click('.v-select:has-text("Pipeline Type")')
    await page.click('.v-list-item:has-text("Data Processing")')
    
    await page.fill('input[aria-label="Version"]', '1.0.0')
    
    // Measure submission time
    const startTime = Date.now()
    await page.click('button[type="submit"]')
    
    // Wait for submission to complete
    await page.waitForSelector('button[type="submit"]:not([disabled])', { timeout: 10000 })
    
    const submissionTime = Date.now() - startTime
    
    // Form submission should complete within 3 seconds
    expect(submissionTime).toBeLessThan(3000)
  })

  test('🔄 Page Navigation Performance', async ({ page }) => {
    await page.goto('http://192.168.0.23:3000')
    
    const pages = [
      '/pipelines/create',
      '/models/create', 
      '/projects/create',
      '/llm/train'
    ]
    
    for (const pagePath of pages) {
      const startTime = Date.now()
      
      await page.goto(`http://192.168.0.23:3000${pagePath}`, {
        waitUntil: 'networkidle',
        timeout: 10000
      })
      
      const navigationTime = Date.now() - startTime
      
      // Each page should load within 3 seconds
      expect(navigationTime).toBeLessThan(3000)
      
      console.log(`${pagePath} loaded in ${navigationTime}ms`)
    }
  })

  test('💾 Memory Usage - No Memory Leaks', async ({ page }) => {
    await page.goto('http://192.168.0.23:3000/pipelines/create')
    
    // Get initial memory usage
    const initialMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize
      }
      return 0
    })
    
    // Navigate between pages multiple times
    for (let i = 0; i < 5; i++) {
      await page.goto('http://192.168.0.23:3000/models/create')
      await page.goto('http://192.168.0.23:3000/projects/create')
      await page.goto('http://192.168.0.23:3000/pipelines/create')
    }
    
    // Get final memory usage
    const finalMemory = await page.evaluate(() => {
      if (performance.memory) {
        return performance.memory.usedJSHeapSize
      }
      return 0
    })
    
    // Memory usage should not increase significantly (allow 20% increase)
    const memoryIncrease = finalMemory - initialMemory
    const memoryIncreasePercent = (memoryIncrease / initialMemory) * 100
    
    if (initialMemory > 0) {
      expect(memoryIncreasePercent).toBeLessThan(20)
    }
    
    console.log(`Memory usage: ${initialMemory} -> ${finalMemory} (${memoryIncreasePercent.toFixed(2)}% increase)`)
  })

  test('📱 Mobile Performance', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    
    const startTime = Date.now()
    
    await page.goto('http://192.168.0.23:3000/pipelines/create', {
      waitUntil: 'networkidle',
      timeout: 15000
    })
    
    const mobileLoadTime = Date.now() - startTime
    
    // Mobile should load within 6 seconds (slower network)
    expect(mobileLoadTime).toBeLessThan(6000)
    
    // Test form interaction on mobile
    await page.fill('input[aria-label="Pipeline Name"]', 'Mobile Test')
    await page.fill('textarea[aria-label="Description"]', 'Mobile test description')
    
    // Form should be responsive
    const form = page.locator('.v-form')
    await expect(form).toBeVisible()
  })

  test('🔍 Network Efficiency - Minimal Requests', async ({ page }) => {
    const requests = []
    
    page.on('request', request => {
      requests.push({
        url: request.url(),
        method: request.method(),
        resourceType: request.resourceType()
      })
    })
    
    await page.goto('http://192.168.0.23:3000/pipelines/create', {
      waitUntil: 'networkidle'
    })
    
    // Count unnecessary requests
    const unnecessaryRequests = requests.filter(req => 
      req.resourceType() === 'image' && 
      req.url().includes('noise.png')
    )
    
    // Should have minimal unnecessary requests
    expect(unnecessaryRequests.length).toBeLessThan(10)
    
    console.log(`Total requests: ${requests.length}`)
    console.log(`Unnecessary requests: ${unnecessaryRequests.length}`)
  })
}) 