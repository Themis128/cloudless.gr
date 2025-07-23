const { test, expect } = require('@playwright/test')

// Test configuration
const BASE_URL = 'http://192.168.0.23:3001'
const TEST_TIMEOUT = 30000

// Test data
const TEST_USERS = {
  admin: {
    email: 'admin@cloudless.gr',
    password: 'Admin123!',
    name: 'Admin User'
  },
  developer: {
    email: 'developer@cloudless.gr',
    password: 'Dev123!',
    name: 'Developer User'
  },
  user: {
    email: 'user@cloudless.gr',
    password: 'User123!',
    name: 'Regular User'
  }
}

// Utility functions for debugging
const debugLog = (message, data = null) => {
  const timestamp = new Date().toISOString()
  const logMessage = `[${timestamp}] DEBUG: ${message}`
  console.log(logMessage)
  if (data) {
    console.log(JSON.stringify(data, null, 2))
  }
}

const captureScreenshot = async (page, name) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  await page.screenshot({ 
    path: `test-results/screenshots/${name}-${timestamp}.png`,
    fullPage: true 
  })
  debugLog(`Screenshot captured: ${name}`)
}

const captureNetworkLogs = async (page, name) => {
  const logs = []
  page.on('request', request => {
    logs.push({
      type: 'request',
      url: request.url(),
      method: request.method(),
      headers: request.headers()
    })
  })
  
  page.on('response', response => {
    logs.push({
      type: 'response',
      url: response.url(),
      status: response.status(),
      headers: response.headers()
    })
  })
  
  return logs
}

test.describe('RBAC Authentication System - Comprehensive Tests', () => {
  let browser, context, page

  test.beforeAll(async ({ browser: testBrowser }) => {
    browser = testBrowser
    debugLog('Starting comprehensive RBAC auth tests')
  })

  test.beforeEach(async () => {
    context = await browser.newContext({
      recordVideo: { dir: 'test-results/videos/' },
      recordHar: { path: 'test-results/hars/' }
    })
    page = await context.newPage()
    
    // Enable verbose logging
    page.on('console', msg => {
      debugLog(`Browser Console [${msg.type()}]: ${msg.text()}`)
    })
    
    page.on('pageerror', error => {
      debugLog(`Browser Error: ${error.message}`)
    })
    
    debugLog('New test context created')
  })

  test.afterEach(async () => {
    await captureScreenshot(page, 'test-end')
    await context.close()
    debugLog('Test context closed')
  })

  test.afterAll(async () => {
    await browser.close()
    debugLog('Browser closed, all tests completed')
  })

  test.describe('Authentication Flow Tests', () => {
    test('should display login page with proper form elements', async () => {
      debugLog('Testing login page display')
      
      await page.goto(`${BASE_URL}/login`)
      await page.waitForLoadState('networkidle')
      
      debugLog('Login page loaded')
      
      // Check page title
      await expect(page).toHaveTitle(/Login/)
      
      // Check form elements
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
      await expect(page.locator('button[type="submit"]')).toBeVisible()
      
      // Check social login buttons
      await expect(page.locator('text=Continue with Google')).toBeVisible()
      await expect(page.locator('text=Continue with GitHub')).toBeVisible()
      
      // Check links
      await expect(page.locator('a[href="/register"]')).toBeVisible()
      await expect(page.locator('a[href="/forgot-password"]')).toBeVisible()
      
      debugLog('Login page elements verified')
    })

    test('should display registration page with proper form elements', async () => {
      debugLog('Testing registration page display')
      
      await page.goto(`${BASE_URL}/register`)
      await page.waitForLoadState('networkidle')
      
      debugLog('Registration page loaded')
      
      // Check page title
      await expect(page).toHaveTitle(/Register/)
      
      // Check form elements
      await expect(page.locator('input[placeholder*="name"]')).toBeVisible()
      await expect(page.locator('input[type="email"]')).toBeVisible()
      await expect(page.locator('input[type="password"]')).toBeVisible()
      await expect(page.locator('input[placeholder*="Confirm"]')).toBeVisible()
      
      // Check password strength indicator
      await expect(page.locator('.password-strength')).toBeVisible()
      
      // Check terms checkbox
      await expect(page.locator('input[type="checkbox"]')).toBeVisible()
      
      debugLog('Registration page elements verified')
    })

    test('should validate registration form fields', async () => {
      debugLog('Testing registration form validation')
      
      await page.goto(`${BASE_URL}/register`)
      
      // Try to submit empty form
      await page.click('button[type="submit"]')
      
      // Check for validation messages
      await expect(page.locator('input[type="email"]')).toHaveAttribute('required')
      await expect(page.locator('input[type="password"]')).toHaveAttribute('required')
      
      debugLog('Form validation working')
    })

    test('should show password strength indicator', async () => {
      debugLog('Testing password strength indicator')
      
      await page.goto(`${BASE_URL}/register`)
      
      // Type weak password
      await page.fill('input[type="password"]', 'weak')
      await expect(page.locator('.strength-text.weak')).toBeVisible()
      
      // Type medium password
      await page.fill('input[type="password"]', 'MediumPass123')
      await expect(page.locator('.strength-text.medium')).toBeVisible()
      
      // Type strong password
      await page.fill('input[type="password"]', 'StrongPass123!@#')
      await expect(page.locator('.strength-text.strong')).toBeVisible()
      
      debugLog('Password strength indicator working')
    })
  })

  test.describe('User Registration Tests', () => {
    test('should successfully register a new user', async () => {
      debugLog('Testing user registration')
      
      const testEmail = `test-${Date.now()}@example.com`
      const testPassword = 'TestPass123!'
      
      await page.goto(`${BASE_URL}/register`)
      
      // Fill registration form
      await page.fill('input[placeholder*="name"]', 'Test User')
      await page.fill('input[type="email"]', testEmail)
      await page.fill('input[type="password"]', testPassword)
      await page.fill('input[placeholder*="Confirm"]', testPassword)
      await page.check('input[type="checkbox"]')
      
      debugLog('Registration form filled')
      
      // Submit form
      await page.click('button[type="submit"]')
      
      // Wait for redirect or success message
      await page.waitForURL(/dashboard|profile/, { timeout: 10000 })
      
      debugLog('User registration successful')
      
      // Verify user is logged in
      await expect(page.locator('text=Test User')).toBeVisible()
    })

    test('should show error for existing email', async () => {
      debugLog('Testing duplicate email registration')
      
      await page.goto(`${BASE_URL}/register`)
      
      // Fill form with existing email
      await page.fill('input[placeholder*="name"]', 'Test User')
      await page.fill('input[type="email"]', TEST_USERS.admin.email)
      await page.fill('input[type="password"]', 'TestPass123!')
      await page.fill('input[placeholder*="Confirm"]', 'TestPass123!')
      await page.check('input[type="checkbox"]')
      
      await page.click('button[type="submit"]')
      
      // Check for error message
      await expect(page.locator('.error-message')).toBeVisible()
      
      debugLog('Duplicate email error shown')
    })
  })

  test.describe('User Login Tests', () => {
    test('should successfully login with valid credentials', async () => {
      debugLog('Testing user login')
      
      await page.goto(`${BASE_URL}/login`)
      
      // Fill login form
      await page.fill('input[type="email"]', TEST_USERS.admin.email)
      await page.fill('input[type="password"]', TEST_USERS.admin.password)
      
      debugLog('Login form filled')
      
      // Submit form
      await page.click('button[type="submit"]')
      
      // Wait for redirect
      await page.waitForURL(/dashboard|admin/, { timeout: 10000 })
      
      debugLog('User login successful')
      
      // Verify user is logged in
      await expect(page.locator('text=Admin User')).toBeVisible()
    })

    test('should show error for invalid credentials', async () => {
      debugLog('Testing invalid login credentials')
      
      await page.goto(`${BASE_URL}/login`)
      
      // Fill form with invalid credentials
      await page.fill('input[type="email"]', 'invalid@example.com')
      await page.fill('input[type="password"]', 'wrongpassword')
      
      await page.click('button[type="submit"]')
      
      // Check for error message
      await expect(page.locator('.error-message')).toBeVisible()
      
      debugLog('Invalid credentials error shown')
    })

    test('should remember email when remember me is checked', async () => {
      debugLog('Testing remember me functionality')
      
      await page.goto(`${BASE_URL}/login`)
      
      // Check remember me and fill email
      await page.check('input[type="checkbox"]')
      await page.fill('input[type="email"]', 'test@example.com')
      
      // Navigate away and back
      await page.goto(`${BASE_URL}/register`)
      await page.goto(`${BASE_URL}/login`)
      
      // Check if email is remembered
      await expect(page.locator('input[type="email"]')).toHaveValue('test@example.com')
      await expect(page.locator('input[type="checkbox"]')).toBeChecked()
      
      debugLog('Remember me functionality working')
    })
  })

  test.describe('RBAC Permission Tests', () => {
    test('should show different navigation based on user role', async () => {
      debugLog('Testing role-based navigation')
      
      // Login as admin
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', TEST_USERS.admin.email)
      await page.fill('input[type="password"]', TEST_USERS.admin.password)
      await page.click('button[type="submit"]')
      
      await page.waitForURL(/dashboard|admin/, { timeout: 10000 })
      
      // Check admin navigation items
      await expect(page.locator('text=Administration')).toBeVisible()
      await expect(page.locator('text=Users')).toBeVisible()
      await expect(page.locator('text=Roles')).toBeVisible()
      
      debugLog('Admin navigation verified')
      
      // Logout
      await page.click('text=Logout')
      await page.waitForURL(/login/, { timeout: 5000 })
      
      // Login as regular user
      await page.fill('input[type="email"]', TEST_USERS.user.email)
      await page.fill('input[type="password"]', TEST_USERS.user.password)
      await page.click('button[type="submit"]')
      
      await page.waitForURL(/dashboard/, { timeout: 10000 })
      
      // Check user navigation (should not have admin items)
      await expect(page.locator('text=Administration')).not.toBeVisible()
      
      debugLog('User navigation verified')
    })

    test('should restrict access to admin pages for non-admin users', async () => {
      debugLog('Testing admin page access restrictions')
      
      // Login as regular user
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', TEST_USERS.user.email)
      await page.fill('input[type="password"]', TEST_USERS.user.password)
      await page.click('button[type="submit"]')
      
      await page.waitForURL(/dashboard/, { timeout: 10000 })
      
      // Try to access admin page
      await page.goto(`${BASE_URL}/admin/users`)
      
      // Should be redirected or show access denied
      await expect(page.locator('text=Access Denied,text=Insufficient permissions')).toBeVisible()
      
      debugLog('Admin page access properly restricted')
    })

    test('should allow admin access to admin pages', async () => {
      debugLog('Testing admin page access for admin users')
      
      // Login as admin
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', TEST_USERS.admin.email)
      await page.fill('input[type="password"]', TEST_USERS.admin.password)
      await page.click('button[type="submit"]')
      
      await page.waitForURL(/dashboard|admin/, { timeout: 10000 })
      
      // Access admin page
      await page.goto(`${BASE_URL}/admin/users`)
      
      // Should be able to access
      await expect(page.locator('text=User Management')).toBeVisible()
      
      debugLog('Admin page access verified for admin user')
    })
  })

  test.describe('User Profile Tests', () => {
    test('should display user profile information', async () => {
      debugLog('Testing user profile display')
      
      // Login as admin
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', TEST_USERS.admin.email)
      await page.fill('input[type="password"]', TEST_USERS.admin.password)
      await page.click('button[type="submit"]')
      
      await page.waitForURL(/dashboard|admin/, { timeout: 10000 })
      
      // Navigate to profile
      await page.goto(`${BASE_URL}/profile`)
      
      // Check profile information
      await expect(page.locator('text=Admin User')).toBeVisible()
      await expect(page.locator('text=admin@cloudless.gr')).toBeVisible()
      await expect(page.locator('text=admin')).toBeVisible()
      
      debugLog('User profile information displayed correctly')
    })

    test('should allow profile editing', async () => {
      debugLog('Testing profile editing')
      
      // Login as admin
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', TEST_USERS.admin.email)
      await page.fill('input[type="password"]', TEST_USERS.admin.password)
      await page.click('button[type="submit"]')
      
      await page.waitForURL(/dashboard|admin/, { timeout: 10000 })
      
      // Navigate to profile
      await page.goto(`${BASE_URL}/profile`)
      
      // Click edit profile
      await page.click('text=Edit Profile')
      
      // Check edit modal
      await expect(page.locator('text=Edit Profile')).toBeVisible()
      
      debugLog('Profile editing modal opened')
    })

    test('should allow password changing', async () => {
      debugLog('Testing password change functionality')
      
      // Login as admin
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', TEST_USERS.admin.email)
      await page.fill('input[type="password"]', TEST_USERS.admin.password)
      await page.click('button[type="submit"]')
      
      await page.waitForURL(/dashboard|admin/, { timeout: 10000 })
      
      // Navigate to profile
      await page.goto(`${BASE_URL}/profile`)
      
      // Click change password
      await page.click('text=Change Password')
      
      // Check password change modal
      await expect(page.locator('text=Change Password')).toBeVisible()
      
      debugLog('Password change modal opened')
    })
  })

  test.describe('API Endpoint Tests', () => {
    test('should return user permissions via API', async () => {
      debugLog('Testing permissions API endpoint')
      
      // Login first
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', TEST_USERS.admin.email)
      await page.fill('input[type="password"]', TEST_USERS.admin.password)
      await page.click('button[type="submit"]')
      
      await page.waitForURL(/dashboard|admin/, { timeout: 10000 })
      
      // Get auth token from localStorage
      const token = await page.evaluate(() => localStorage.getItem('auth_token'))
      debugLog('Auth token retrieved', { token: token ? 'present' : 'missing' })
      
      // Test permissions API
      const response = await page.request.get(`${BASE_URL}/api/auth/permissions`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      expect(response.status()).toBe(200)
      
      const data = await response.json()
      debugLog('Permissions API response', data)
      
      expect(data.success).toBe(true)
      expect(Array.isArray(data.permissions)).toBe(true)
      
      debugLog('Permissions API working correctly')
    })

    test('should return user roles via API', async () => {
      debugLog('Testing roles API endpoint')
      
      // Login first
      await page.goto(`${BASE_URL}/login`)
      await page.fill('input[type="email"]', TEST_USERS.admin.email)
      await page.fill('input[type="password"]', TEST_USERS.admin.password)
      await page.click('button[type="submit"]')
      
      await page.waitForURL(/dashboard|admin/, { timeout: 10000 })
      
      // Get auth token from localStorage
      const token = await page.evaluate(() => localStorage.getItem('auth_token'))
      
      // Test roles API
      const response = await page.request.get(`${BASE_URL}/api/auth/roles`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      })
      
      expect(response.status()).toBe(200)
      
      const data = await response.json()
      debugLog('Roles API response', data)
      
      expect(data.success).toBe(true)
      expect(Array.isArray(data.roles)).toBe(true)
      
      debugLog('Roles API working correctly')
    })

    test('should protect admin endpoints', async () => {
      debugLog('Testing admin endpoint protection')
      
      // Try to access admin endpoint without authentication
      const response = await page.request.get(`${BASE_URL}/api/admin/users`)
      
      expect(response.status()).toBe(401)
      
      debugLog('Admin endpoint properly protected')
    })
  })

  test.describe('Error Handling Tests', () => {
    test('should handle network errors gracefully', async () => {
      debugLog('Testing network error handling')
      
      // Disconnect network
      await page.route('**/*', route => route.abort())
      
      await page.goto(`${BASE_URL}/login`)
      
      // Try to login
      await page.fill('input[type="email"]', TEST_USERS.admin.email)
      await page.fill('input[type="password"]', TEST_USERS.admin.password)
      await page.click('button[type="submit"]')
      
      // Should show error message
      await expect(page.locator('.error-message')).toBeVisible()
      
      debugLog('Network error handled gracefully')
    })

    test('should handle invalid token gracefully', async () => {
      debugLog('Testing invalid token handling')
      
      // Set invalid token
      await page.goto(`${BASE_URL}/login`)
      await page.evaluate(() => {
        localStorage.setItem('auth_token', 'invalid-token')
      })
      
      // Try to access protected page
      await page.goto(`${BASE_URL}/profile`)
      
      // Should redirect to login
      await page.waitForURL(/login/, { timeout: 5000 })
      
      debugLog('Invalid token handled gracefully')
    })
  })

  test.describe('Performance Tests', () => {
    test('should load login page quickly', async () => {
      debugLog('Testing login page performance')
      
      const startTime = Date.now()
      await page.goto(`${BASE_URL}/login`)
      await page.waitForLoadState('networkidle')
      const loadTime = Date.now() - startTime
      
      debugLog(`Login page load time: ${loadTime}ms`)
      
      expect(loadTime).toBeLessThan(3000)
      
      debugLog('Login page performance acceptable')
    })

    test('should handle concurrent login attempts', async () => {
      debugLog('Testing concurrent login handling')
      
      // Create multiple contexts for concurrent requests
      const contexts = []
      const pages = []
      
      for (let i = 0; i < 3; i++) {
        const context = await browser.newContext()
        const page = await context.newPage()
        contexts.push(context)
        pages.push(page)
      }
      
      // Attempt concurrent logins
      const promises = pages.map(async (page, index) => {
        await page.goto(`${BASE_URL}/login`)
        await page.fill('input[type="email"]', TEST_USERS.admin.email)
        await page.fill('input[type="password"]', TEST_USERS.admin.password)
        return page.click('button[type="submit"]')
      })
      
      await Promise.all(promises)
      
      // Clean up
      for (const context of contexts) {
        await context.close()
      }
      
      debugLog('Concurrent login handling completed')
    })
  })

  test.describe('Accessibility Tests', () => {
    test('should have proper ARIA labels', async () => {
      debugLog('Testing accessibility features')
      
      await page.goto(`${BASE_URL}/login`)
      
      // Check for ARIA labels
      await expect(page.locator('input[type="email"]')).toHaveAttribute('aria-label')
      await expect(page.locator('input[type="password"]')).toHaveAttribute('aria-label')
      
      debugLog('ARIA labels present')
    })

    test('should be keyboard navigable', async () => {
      debugLog('Testing keyboard navigation')
      
      await page.goto(`${BASE_URL}/login`)
      
      // Tab through form elements
      await page.keyboard.press('Tab')
      await expect(page.locator('input[type="email"]')).toBeFocused()
      
      await page.keyboard.press('Tab')
      await expect(page.locator('input[type="password"]')).toBeFocused()
      
      debugLog('Keyboard navigation working')
    })
  })
}) 