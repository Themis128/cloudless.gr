const { test, expect } = require('@playwright/test')

test.describe('🔐 Admin Authentication & Access Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto('http://192.168.0.23:3001')
  })

  test('should redirect unauthenticated users to login when accessing admin routes', async ({ page }) => {
    // Try to access admin route directly
    await page.goto('http://192.168.0.23:3001/admin/users')
    
    // Should be redirected to login page
    await expect(page).toHaveURL(/.*\/auth\/login/)
    
    // Should see login form
    await expect(page.locator('text=Login')).toBeVisible()
  })

  test('should allow admin user to login and access admin routes', async ({ page }) => {
    // Navigate to login page
    await page.goto('http://192.168.0.23:3001/auth/login')
    
    // Fill login form with admin credentials
    await page.fill('input[type="email"]', 'admin@cloudless.gr')
    await page.fill('input[type="password"]', 'admin123')
    
    // Submit form
    await page.click('button[type="submit"]')
    
    // Wait for redirect to dashboard or admin page
    await page.waitForURL(/.*\/dashboard|.*\/admin/)
    
    // Verify we're logged in by checking for user info or logout button
    await expect(page.locator('text=Admin User, text=admin@cloudless.gr, text=Logout').first()).toBeVisible({ timeout: 10000 })
  })

  test('should allow admin to access /admin/users endpoint', async ({ page }) => {
    // First login
    await page.goto('http://192.168.0.23:3001/auth/login')
    await page.fill('input[type="email"]', 'admin@cloudless.gr')
    await page.fill('input[type="password"]', 'admin123')
    await page.click('button[type="submit"]')
    
    // Wait for login to complete
    await page.waitForURL(/.*\/dashboard|.*\/admin/, { timeout: 10000 })
    
    // Now try to access admin users page
    await page.goto('http://192.168.0.23:3001/admin/users')
    
    // Should be able to access the page (not redirected)
    await expect(page).toHaveURL('http://192.168.0.23:3001/admin/users')
    
    // Should see admin content
    await expect(page.locator('text=Users, text=Admin, text=User Management').first()).toBeVisible({ timeout: 10000 })
  })

  test('should allow admin to access Redis analytics', async ({ page }) => {
    // First login
    await page.goto('http://192.168.0.23:3001/auth/login')
    await page.fill('input[type="email"]', 'admin@cloudless.gr')
    await page.fill('input[type="password"]', 'admin123')
    await page.click('button[type="submit"]')
    
    // Wait for login to complete
    await page.waitForURL(/.*\/dashboard|.*\/admin/, { timeout: 10000 })
    
    // Try to access Redis analytics page
    await page.goto('http://192.168.0.23:3001/admin/redis-analytics')
    
    // Should be able to access the page
    await expect(page).toHaveURL('http://192.168.0.23:3001/admin/redis-analytics')
    
    // Should see Redis analytics content
    await expect(page.locator('text=Users, text=Admin, text=User Management').first()).toBeVisible({ timeout: 10000 })
  })

  test('should prevent regular users from accessing admin routes', async ({ page, request }) => {
    // First register a regular user
    await page.goto('http://192.168.0.23:3001/auth/register')
    
    const testEmail = `testuser${Date.now()}@example.com`
    const testPassword = 'testpassword123'
    
    await page.fill('input[placeholder*="Name"], input[label*="Name"]', 'Test User')
    await page.fill('input[type="email"]', testEmail)
    await page.fill('input[type="password"]', testPassword)
    await page.fill('input[placeholder*="Confirm"], input[label*="Confirm"]', testPassword)
    
    await page.click('button[type="submit"]')
    
    // Wait for registration to complete
    await page.waitForURL(/.*\/dashboard/, { timeout: 10000 })
    
    // Now try to access admin route
    await page.goto('http://192.168.0.23:3001/admin/users')
    
    // Should be redirected or see access denied
    const currentUrl = page.url()
    if (currentUrl.includes('/auth/login')) {
      // Redirected to login (expected for non-admin users)
      await expect(page).toHaveURL(/.*\/auth\/login/)
    } else if (currentUrl.includes('/admin/users')) {
      // If we can access the page, should see access denied message
      await expect(page.locator('text=403, text=Forbidden, text=Insufficient permissions').first()).toBeVisible({ timeout: 5000 })
    }
  })

  test('should test API endpoint protection', async ({ request }) => {
    // Test admin endpoint without authentication
    const response = await request.get('http://192.168.0.23:3000/api/admin/users')
    expect(response.status()).toBe(401) // Should return unauthorized
    
    // Test with invalid token
    const responseWithInvalidToken = await request.get('http://192.168.0.23:3000/api/admin/users', {
      headers: {
        'Authorization': 'Bearer invalid-token'
      }
    })
    expect(responseWithInvalidToken.status()).toBe(401)
  })
}) 