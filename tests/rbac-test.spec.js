const { test, expect } = require('@playwright/test')

test.describe('RBAC System Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to login page
    await page.goto('/auth/login')
  })

  test('Admin user can access admin pages', async ({ page }) => {
    // Login as admin
    await page.fill('input[name="email"]', 'admin@cloudless.gr')
    await page.fill('input[name="password"]', 'admin123')
    await page.click('button[type="submit"]')

    // Wait for login to complete
    await page.waitForURL('/dashboard')

    // Try to access admin pages
    await page.goto('/admin/users')
    await expect(page).toHaveURL('/admin/users')
    
    await page.goto('/admin/redis-analytics')
    await expect(page).toHaveURL('/admin/redis-analytics')
  })

  test('Regular user cannot access admin pages', async ({ page }) => {
    // Login as regular user (if exists)
    await page.fill('input[name="email"]', 'test@cloudless.gr')
    await page.fill('input[name="password"]', 'test123')
    await page.click('button[type="submit"]')

    // Wait for login to complete
    await page.waitForURL('/dashboard')

    // Try to access admin pages - should be redirected
    await page.goto('/admin/users')
    await expect(page).not.toHaveURL('/admin/users')
  })

  test('RBAC API endpoints work correctly', async ({ request }) => {
    // Login to get token
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'admin@cloudless.gr',
        password: 'admin123'
      }
    })

    expect(loginResponse.ok()).toBeTruthy()
    const loginData = await loginResponse.json()
    expect(loginData.success).toBe(true)

    // Get user permissions
    const permissionsResponse = await request.get('/api/auth/permissions', {
      headers: {
        'Cookie': `auth-token=${loginData.data.token}`
      }
    })

    expect(permissionsResponse.ok()).toBeTruthy()
    const permissionsData = await permissionsResponse.json()
    expect(permissionsData.success).toBe(true)
    expect(Array.isArray(permissionsData.data)).toBe(true)

    // Get user roles
    const rolesResponse = await request.get('/api/auth/roles', {
      headers: {
        'Cookie': `auth-token=${loginData.data.token}`
      }
    })

    expect(rolesResponse.ok()).toBeTruthy()
    const rolesData = await rolesResponse.json()
    expect(rolesData.success).toBe(true)
    expect(Array.isArray(rolesData.data)).toBe(true)

    // Check if admin role exists
    const adminRole = rolesData.data.find(role => role.role.name === 'admin')
    expect(adminRole).toBeTruthy()
  })

  test('Protected API endpoints require proper permissions', async ({ request }) => {
    // Try to access admin endpoint without authentication
    const unauthorizedResponse = await request.get('/api/admin/roles')
    expect(unauthorizedResponse.status()).toBe(401)

    // Login as admin
    const loginResponse = await request.post('/api/auth/login', {
      data: {
        email: 'admin@cloudless.gr',
        password: 'admin123'
      }
    })

    const loginData = await loginResponse.json()
    
    // Access admin endpoint with authentication
    const authorizedResponse = await request.get('/api/admin/roles', {
      headers: {
        'Cookie': `auth-token=${loginData.data.token}`
      }
    })

    expect(authorizedResponse.ok()).toBeTruthy()
    const rolesData = await authorizedResponse.json()
    expect(rolesData.success).toBe(true)
  })
}) 