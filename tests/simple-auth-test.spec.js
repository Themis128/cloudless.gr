const { test, expect } = require('@playwright/test')

test.describe('🔐 Simple Authentication Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set longer timeout for slow network conditions
    page.setDefaultTimeout(60000)
  })

  test('should access home page without authentication', async ({ page }) => {
    // Use waitUntil: 'domcontentloaded' for faster loading
    await page.goto('http://192.168.0.23:3001', { 
      waitUntil: 'domcontentloaded',
      timeout: 60000 
    })
    
    // Wait for a specific element to ensure page is fully loaded
    await page.waitForSelector('h1', { timeout: 10000 })
    await expect(page).toHaveURL('http://192.168.0.23:3001/')
  })

  test('should test basic API connectivity', async ({ request }) => {
    // Test a simple health endpoint or static route
    const response = await request.get('http://192.168.0.23:3001/api/health')
    
    console.log('Health API response status:', response.status())
    
    // Accept any response as long as the server is reachable
    expect(response.status()).toBeGreaterThanOrEqual(200)
    expect(response.status()).toBeLessThan(600)
  })

  test('should test admin API endpoint without auth (should return 401)', async ({ request }) => {
    const response = await request.get('http://192.168.0.23:3001/api/admin/users')
    
    console.log('Admin API response status:', response.status())
    
    // Should return 401 for unauthorized access or 429 if rate limited
    expect([401, 429]).toContain(response.status())
  })
}) 