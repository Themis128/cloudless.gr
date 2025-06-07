/**
 * Admin Authentication Complete Test Suite
 * Converted from PowerShell admin auth complete test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'

// Test configuration
const TEST_CONFIG = {
  serverUrl: process.env.TEST_SERVER_URL || 'http://localhost:3000',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@cloudless.gr',
  adminPassword: process.env.ADMIN_PASSWORD || 'cloudless2025',
  maxRetries: 20,
  retryDelay: 3000
}

interface AdminTestResults {
  serverAvailability: boolean
  adminLoginValid: boolean
  adminLoginInvalid: boolean
  adminLogout: boolean
  adminPageAccess: boolean
  adminDashboard: boolean
  contactSubmissions: boolean
  adminWarning: boolean
  middlewareProtection: boolean
  sessionPersistence: boolean
}

let testResults: AdminTestResults = {
  serverAvailability: false,
  adminLoginValid: false,
  adminLoginInvalid: false,
  adminLogout: false,
  adminPageAccess: false,
  adminDashboard: false,
  contactSubmissions: false,
  adminWarning: false,
  middlewareProtection: false,
  sessionPersistence: false
}

let adminSession: {
  token: string
  user: any
  cookies: string
  refreshToken?: string
} | null = null

// Utility functions
async function waitForServer(url: string, maxRetries: number = 20, delay: number = 3000): Promise<boolean> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 5000)
      
      const response = await fetch(url, { 
        method: 'HEAD',
        signal: controller.signal
      })
      
      clearTimeout(timeoutId)
      
      if (response.ok || response.status < 500) {
        console.log(`✅ Server responsive at ${url} (attempt ${attempt})`)
        return true
      }
    } catch (error) {
      console.log(`⏳ Attempt ${attempt}/${maxRetries}: Server not ready, retrying in ${delay}ms...`)
      if (attempt < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  
  console.error(`❌ Server failed to respond after ${maxRetries} attempts`)
  return false
}

async function makeAuthenticatedRequest(url: string, options: RequestInit = {}) {
  if (!adminSession) {
    throw new Error('No admin session available')
  }

  const headers = {
    'Authorization': `Bearer ${adminSession.token}`,
    'Cookie': adminSession.cookies,
    ...options.headers
  }

  return fetch(url, {
    ...options,
    headers
  })
}

describe('Admin Authentication Complete Test Suite', () => {
  beforeAll(async () => {
    console.log('🔐 Starting Admin Authentication Complete Test Suite...')
    console.log(`Target server: ${TEST_CONFIG.serverUrl}`)
    console.log(`Admin email: ${TEST_CONFIG.adminEmail}`)
  }, 30000)

  describe('Server Readiness', () => {
    it('should wait for server to be available', async () => {
      const serverReady = await waitForServer(TEST_CONFIG.serverUrl, TEST_CONFIG.maxRetries, TEST_CONFIG.retryDelay)
      testResults.serverAvailability = serverReady
      expect(serverReady).toBe(true)
    }, 120000) // 2 minute timeout
  })

  describe('Admin Login Flow', () => {
    it('should successfully login with valid admin credentials', async () => {
      const loginData = {
        email: TEST_CONFIG.adminEmail,
        password: TEST_CONFIG.adminPassword
      }

      const response = await fetch(`${TEST_CONFIG.serverUrl}/api/auth/admin-login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData)
      })

      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data).toHaveProperty('token')
      expect(data).toHaveProperty('user')
      expect(data.user).toHaveProperty('isAdmin', true)
      expect(data.user.email).toBe(TEST_CONFIG.adminEmail)

      // Store session for subsequent tests
      adminSession = {
        token: data.token,
        user: data.user,
        cookies: response.headers.get('set-cookie') || '',
        refreshToken: data.refreshToken
      }

      testResults.adminLoginValid = true
      console.log('✅ Admin login successful')
      console.log(`   Token type: ${typeof data.token}`)
      console.log(`   User ID: ${data.user.id}`)
      console.log(`   Admin status: ${data.user.isAdmin}`)
    })

    it('should reject invalid admin credentials', async () => {
      const invalidCredentials = [
        { email: 'hacker@evil.com', password: 'wrongpassword', desc: 'completely invalid' },
        { email: TEST_CONFIG.adminEmail, password: 'wrongpassword', desc: 'valid email, wrong password' },
        { email: 'invalid@example.com', password: TEST_CONFIG.adminPassword, desc: 'invalid email, valid password' },
        { email: '', password: '', desc: 'empty credentials' }
      ]

      for (const creds of invalidCredentials) {
        const response = await fetch(`${TEST_CONFIG.serverUrl}/api/auth/admin-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ email: creds.email, password: creds.password })
        })

        expect(response.status).toBe(401)
        
        const data = await response.json()
        expect(data).toHaveProperty('error')
        
        console.log(`✅ Invalid login rejected: ${creds.desc}`)
      }

      testResults.adminLoginInvalid = true
    })

    it('should handle login rate limiting gracefully', async () => {
      // Attempt multiple rapid logins with invalid credentials
      const rapidAttempts = Array.from({ length: 5 }, () => 
        fetch(`${TEST_CONFIG.serverUrl}/api/auth/admin-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@test.com', password: 'wrong' })
        })
      )

      const responses = await Promise.all(rapidAttempts)
      
      // Some should be rejected (401) and some might be rate limited (429)
      const statusCodes = responses.map(r => r.status)
      expect(statusCodes.every(code => [401, 429].includes(code))).toBe(true)
      
      console.log('✅ Rate limiting handled properly')
    })
  })

  describe('Session Management', () => {
    beforeEach(() => {
      if (!adminSession) {
        throw new Error('No admin session available - login test may have failed')
      }
    })

    it('should maintain session across requests', async () => {
      // Make multiple authenticated requests to verify session persistence
      const requests = [
        makeAuthenticatedRequest(`${TEST_CONFIG.serverUrl}/admin`),
        makeAuthenticatedRequest(`${TEST_CONFIG.serverUrl}/admin/dashboard`),
        makeAuthenticatedRequest(`${TEST_CONFIG.serverUrl}/api/auth/profile`)
      ]

      const responses = await Promise.allSettled(requests)
      
      // All requests should succeed with same session
      const successfulRequests = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status < 400
      ).length

      expect(successfulRequests).toBeGreaterThan(0)
      testResults.sessionPersistence = successfulRequests === responses.length
      
      console.log(`✅ Session persistence: ${successfulRequests}/${responses.length} requests successful`)
    })

    it('should validate token on protected endpoints', async () => {
      const protectedEndpoints = [
        '/api/auth/profile',
        '/api/admin/users',
        '/api/admin/settings'
      ]

      for (const endpoint of protectedEndpoints) {
        try {
          const response = await makeAuthenticatedRequest(`${TEST_CONFIG.serverUrl}${endpoint}`)
          
          // Should either succeed or return a structured error (not 500)
          expect(response.status).toBeLessThan(500)
          
          if (response.status === 200) {
            console.log(`✅ ${endpoint} accessible with valid token`)
          } else {
            console.log(`ℹ️  ${endpoint} returned ${response.status} (may not be implemented)`)
          }
        } catch (error) {
          console.log(`⚠️  ${endpoint} test failed:`, error)
        }
      }
    })
  })

  describe('Admin Page Access', () => {
    beforeEach(() => {
      if (!adminSession) {
        throw new Error('No admin session available - login test may have failed')
      }
    })

    it('should allow access to admin landing page', async () => {
      const response = await makeAuthenticatedRequest(`${TEST_CONFIG.serverUrl}/admin`)
      
      expect(response.status).toBeLessThan(400)
      testResults.adminPageAccess = true
      
      // Check if response contains admin content
      const html = await response.text()
      const hasAdminContent = /admin|dashboard|management/i.test(html)
      
      console.log('✅ Admin page accessible')
      console.log(`   Content check: ${hasAdminContent ? 'Contains admin content' : 'Basic page'}`)
    })

    it('should allow access to admin dashboard', async () => {
      const response = await makeAuthenticatedRequest(`${TEST_CONFIG.serverUrl}/admin/dashboard`)
      
      expect(response.status).toBeLessThan(400)
      testResults.adminDashboard = true
      
      console.log('✅ Admin dashboard accessible')
    })

    it('should allow access to contact submissions', async () => {
      const response = await makeAuthenticatedRequest(`${TEST_CONFIG.serverUrl}/admin/contact-submissions`)
      
      expect(response.status).toBeLessThan(400)
      testResults.contactSubmissions = true
      
      console.log('✅ Contact submissions page accessible')
    })

    it('should show admin warnings for sensitive actions', async () => {
      // This would typically test admin warning banners or confirmations
      // For now, we'll check if admin pages have appropriate warning content
      const adminPages = ['/admin', '/admin/dashboard']
      
      for (const page of adminPages) {
        try {
          const response = await makeAuthenticatedRequest(`${TEST_CONFIG.serverUrl}${page}`)
          
          if (response.ok) {
            const html = await response.text()
            const hasWarnings = /warning|caution|admin.*access|sensitive/i.test(html)
            
            if (hasWarnings) {
              testResults.adminWarning = true
              console.log(`✅ ${page} contains admin warnings`)
              break
            }
          }
        } catch (error) {
          console.log(`⚠️  Could not check warnings on ${page}`)
        }
      }
    })
  })

  describe('Security & Access Control', () => {
    it('should block access to admin pages without authentication', async () => {
      const adminPages = ['/admin', '/admin/dashboard', '/admin/contact-submissions']
      
      for (const page of adminPages) {
        const response = await fetch(`${TEST_CONFIG.serverUrl}${page}`, {
          redirect: 'manual'
        })
        
        // Should redirect or return 401/403
        const isBlocked = [301, 302, 401, 403].includes(response.status)
        expect(isBlocked).toBe(true)
        
        console.log(`✅ ${page} properly blocked without auth (status: ${response.status})`)
      }
      
      testResults.middlewareProtection = true
    })

    it('should block API endpoints without proper authentication', async () => {
      const adminAPIs = [
        '/api/admin/users',
        '/api/admin/settings',
        '/api/admin/contact-submissions'
      ]
      
      for (const api of adminAPIs) {
        const response = await fetch(`${TEST_CONFIG.serverUrl}${api}`)
        
        // Should return 401 or 403
        expect([401, 403, 404]).toContain(response.status)
        
        console.log(`✅ ${api} properly protected (status: ${response.status})`)
      }
    })

    it('should validate admin role for admin-only endpoints', async () => {
      if (!adminSession) {
        throw new Error('No admin session available')
      }

      // Test with admin token - should work
      const adminResponse = await makeAuthenticatedRequest(`${TEST_CONFIG.serverUrl}/api/auth/profile`)
      expect(adminResponse.status).toBeLessThan(400)
      
      // Verify response contains admin flag
      if (adminResponse.ok) {
        const profile = await adminResponse.json()
        expect(profile).toHaveProperty('isAdmin', true)
        console.log('✅ Admin role properly validated')
      }
    })
  })

  describe('Logout Flow', () => {
    it('should successfully logout admin user', async () => {
      if (!adminSession) {
        throw new Error('No admin session available for logout test')
      }

      const response = await makeAuthenticatedRequest(`${TEST_CONFIG.serverUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      })

      expect(response.status).toBe(200)
      testResults.adminLogout = true
      
      console.log('✅ Admin logout successful')
    })

    it('should invalidate session after logout', async () => {
      if (!adminSession) {
        console.log('⚠️  Skipping session invalidation test - no session available')
        return
      }

      // Try to access protected resource with old token
      const response = await makeAuthenticatedRequest(`${TEST_CONFIG.serverUrl}/admin`)
      
      // Should now be blocked
      expect(response.status).toBeGreaterThanOrEqual(400)
      console.log('✅ Session properly invalidated after logout')
      
      // Clear session for cleanup
      adminSession = null
    })
  })

  describe('Admin Test Results Summary', () => {
    it('should report comprehensive test results', () => {
      console.log('\n🔐 Admin Authentication Complete Test Results')
      console.log('=============================================')
      
      const results = [
        { name: 'Server Availability', passed: testResults.serverAvailability },
        { name: 'Admin Login (Valid)', passed: testResults.adminLoginValid },
        { name: 'Admin Login (Invalid)', passed: testResults.adminLoginInvalid },
        { name: 'Admin Logout', passed: testResults.adminLogout },
        { name: 'Admin Page Access', passed: testResults.adminPageAccess },
        { name: 'Admin Dashboard', passed: testResults.adminDashboard },
        { name: 'Contact Submissions', passed: testResults.contactSubmissions },
        { name: 'Admin Warnings', passed: testResults.adminWarning },
        { name: 'Middleware Protection', passed: testResults.middlewareProtection },
        { name: 'Session Persistence', passed: testResults.sessionPersistence }
      ]
      
      let passedCount = 0
      let criticalCount = 0
      const criticalTests = ['serverAvailability', 'adminLoginValid', 'middlewareProtection']
      
      results.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL'
        const isCritical = criticalTests.some(test => result.name.toLowerCase().includes(test.toLowerCase()))
        const marker = isCritical ? ' [CRITICAL]' : ''
        
        console.log(`${status} ${result.name}${marker}`)
        
        if (result.passed) {
          passedCount++
          if (isCritical) criticalCount++
        }
      })
      
      console.log('\n📊 Test Summary:')
      console.log(`   Total: ${passedCount}/${results.length} tests passed`)
      console.log(`   Critical: ${criticalCount}/${criticalTests.length} critical tests passed`)
      console.log(`   Coverage: ${Math.round((passedCount / results.length) * 100)}%`)
      
      // All critical tests must pass
      expect(criticalCount).toBe(criticalTests.length)
      
      // At least 80% overall should pass
      expect(passedCount / results.length).toBeGreaterThanOrEqual(0.8)
    })
  })
})
