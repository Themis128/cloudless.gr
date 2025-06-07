/**
 * Authentication Tests
 * Converted from PowerShell test files
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { resolve } from 'path'

// Test configuration
const TEST_CONFIG = {
  serverUrl: process.env.TEST_SERVER_URL || 'http://localhost:3000',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@cloudless.gr',
  adminPassword: process.env.ADMIN_PASSWORD || 'cloudless2025',
  maxRetries: 20,
  retryDelay: 3000
}

// Global test state
interface TestResults {
  serverAvailability: boolean
  adminLoginValid: boolean
  adminLoginInvalid: boolean
  adminLogout: boolean
  adminPageAccess: boolean
  adminDashboard: boolean
  contactSubmissions: boolean
  middlewareProtection: boolean
  sessionPersistence: boolean
}

let testResults: TestResults = {
  serverAvailability: false,
  adminLoginValid: false,
  adminLoginInvalid: false,
  adminLogout: false,
  adminPageAccess: false,
  adminDashboard: false,
  contactSubmissions: false,
  middlewareProtection: false,
  sessionPersistence: false
}

let adminSession: any = null

describe('Authentication System', () => {
  describe('File Structure Validation', () => {
    it('should have all required middleware files', () => {
      const middlewareFiles = [
        'middleware/admin-required.ts',
        'middleware/auth-required.ts',
        'middleware/auth.global.ts',
        'middleware/admin-login-redirect.global.ts',
        'middleware/static-assets.global.ts'
      ]

      const missingFiles: string[] = []
      
      middlewareFiles.forEach(file => {
        const fullPath = resolve(process.cwd(), file)
        if (existsSync(fullPath)) {
          console.log(`✅ ${file}`)
        } else {
          console.log(`❌ ${file}`)
          missingFiles.push(file)
        }
      })

      expect(missingFiles).toHaveLength(0)
    })

    it('should have all required admin pages', () => {
      const adminPages = [
        'pages/admin.vue',
        'pages/admin/dashboard.vue',
        'pages/admin/contact-submissions.vue',
        'pages/auth/admin-login.vue'
      ]

      const missingPages: string[] = []
      
      adminPages.forEach(page => {
        const fullPath = resolve(process.cwd(), page)
        if (existsSync(fullPath)) {
          console.log(`✅ ${page}`)
        } else {
          console.log(`❌ ${page}`)
          missingPages.push(page)
        }
      })

      expect(missingPages).toHaveLength(0)
    })

    it('should have middleware protection in admin pages', async () => {
      const adminPagePath = resolve(process.cwd(), 'pages/admin.vue')
      
      if (existsSync(adminPagePath)) {
        const content = await readFile(adminPagePath, 'utf-8')
        
        // Check for middleware definition
        const hasMiddleware = content.includes('middleware:') || 
                             content.includes('definePageMeta') ||
                             content.includes('requiresAdmin')
        
        expect(hasMiddleware).toBe(true)
      }
    })
  })

  describe('Server Availability', () => {
    it('should have server running and accessible', async () => {
      let serverReachable = false
      let attempts = 0
        while (attempts < TEST_CONFIG.maxRetries && !serverReachable) {
        try {
          const controller = new AbortController()
          const timeoutId = setTimeout(() => controller.abort(), 5000)
          
          const response = await fetch(TEST_CONFIG.serverUrl, {
            method: 'HEAD',
            signal: controller.signal
          })
          
          clearTimeout(timeoutId)
          
          if (response.ok || response.status < 500) {
            serverReachable = true
            testResults.serverAvailability = true
            console.log(`✅ Server reachable at ${TEST_CONFIG.serverUrl}`)
          }
        } catch (error) {
          attempts++
          console.log(`⏳ Attempt ${attempts}/${TEST_CONFIG.maxRetries}: Server not ready, retrying...`)
          if (attempts < TEST_CONFIG.maxRetries) {
            await new Promise(resolve => setTimeout(resolve, TEST_CONFIG.retryDelay))
          }
        }
      }
      
      expect(serverReachable).toBe(true)
    }, 60000) // 60 second timeout
  })

  describe('Admin Authentication', () => {
    it('should successfully login with valid admin credentials', async () => {
      const loginData = {
        email: TEST_CONFIG.adminEmail,
        password: TEST_CONFIG.adminPassword
      }

      try {
        const response = await fetch(`${TEST_CONFIG.serverUrl}/api/auth/admin-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(loginData)
        })

        const data = await response.json()
        
        expect(response.status).toBe(200)
        expect(data).toHaveProperty('token')
        expect(data).toHaveProperty('user')
        expect(data.user).toHaveProperty('isAdmin', true)
        
        // Store session for subsequent tests
        adminSession = {
          token: data.token,
          user: data.user,
          cookies: response.headers.get('set-cookie')
        }
        
        testResults.adminLoginValid = true
        console.log('✅ Admin login successful')
      } catch (error) {
        console.error('❌ Admin login failed:', error)
        throw error
      }
    })

    it('should reject login with invalid credentials', async () => {
      const invalidData = {
        email: 'hacker@evil.com',
        password: 'wrongpassword'
      }

      try {
        const response = await fetch(`${TEST_CONFIG.serverUrl}/api/auth/admin-login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(invalidData)
        })

        expect(response.status).toBe(401)
        
        const data = await response.json()
        expect(data).toHaveProperty('error')
        
        testResults.adminLoginInvalid = true
        console.log('✅ Invalid login properly rejected')
      } catch (error) {
        console.error('❌ Invalid login test failed:', error)
        throw error
      }
    })

    it('should successfully logout admin user', async () => {
      if (!adminSession?.token) {
        throw new Error('No admin session available for logout test')
      }

      try {
        const response = await fetch(`${TEST_CONFIG.serverUrl}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${adminSession.token}`,
            'Content-Type': 'application/json',
          }
        })

        expect(response.status).toBe(200)
        
        testResults.adminLogout = true
        console.log('✅ Admin logout successful')
      } catch (error) {
        console.error('❌ Admin logout failed:', error)
        throw error
      }
    })
  })

  describe('Page Access Control', () => {
    beforeEach(async () => {
      // Re-establish admin session for each test
      if (!adminSession?.token) {
        const loginData = {
          email: TEST_CONFIG.adminEmail,
          password: TEST_CONFIG.adminPassword
        }

        const response = await fetch(`${TEST_CONFIG.serverUrl}/api/auth/admin-login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(loginData)
        })

        const data = await response.json()
        adminSession = {
          token: data.token,
          user: data.user,
          cookies: response.headers.get('set-cookie')
        }
      }
    })

    it('should allow access to admin pages with valid session', async () => {
      try {
        const response = await fetch(`${TEST_CONFIG.serverUrl}/admin`, {
          headers: {
            'Authorization': `Bearer ${adminSession.token}`,
            'Cookie': adminSession.cookies || ''
          }
        })

        expect(response.status).toBeLessThan(400)
        testResults.adminPageAccess = true
        console.log('✅ Admin page access allowed')
      } catch (error) {
        console.error('❌ Admin page access failed:', error)
        throw error
      }
    })

    it('should allow access to admin dashboard', async () => {
      try {
        const response = await fetch(`${TEST_CONFIG.serverUrl}/admin/dashboard`, {
          headers: {
            'Authorization': `Bearer ${adminSession.token}`,
            'Cookie': adminSession.cookies || ''
          }
        })

        expect(response.status).toBeLessThan(400)
        testResults.adminDashboard = true
        console.log('✅ Admin dashboard access allowed')
      } catch (error) {
        console.error('❌ Admin dashboard access failed:', error)
        throw error
      }
    })

    it('should allow access to contact submissions', async () => {
      try {
        const response = await fetch(`${TEST_CONFIG.serverUrl}/admin/contact-submissions`, {
          headers: {
            'Authorization': `Bearer ${adminSession.token}`,
            'Cookie': adminSession.cookies || ''
          }
        })

        expect(response.status).toBeLessThan(400)
        testResults.contactSubmissions = true
        console.log('✅ Contact submissions access allowed')
      } catch (error) {
        console.error('❌ Contact submissions access failed:', error)
        throw error
      }
    })

    it('should block access to admin pages without authentication', async () => {
      try {
        const response = await fetch(`${TEST_CONFIG.serverUrl}/admin`)
        
        // Should redirect or return 401/403
        expect([401, 403, 302]).toContain(response.status)
        testResults.middlewareProtection = true
        console.log('✅ Middleware protection working')
      } catch (error) {
        console.error('❌ Middleware protection test failed:', error)
        throw error
      }
    })
  })

  describe('Test Results Summary', () => {
    it('should report all test results', () => {
      console.log('\n🔐 Authentication Test Results Summary')
      console.log('=====================================')
      
      const results = [
        { name: 'Server Availability', passed: testResults.serverAvailability },
        { name: 'Admin Login (Valid)', passed: testResults.adminLoginValid },
        { name: 'Admin Login (Invalid)', passed: testResults.adminLoginInvalid },
        { name: 'Admin Logout', passed: testResults.adminLogout },
        { name: 'Admin Page Access', passed: testResults.adminPageAccess },
        { name: 'Admin Dashboard', passed: testResults.adminDashboard },
        { name: 'Contact Submissions', passed: testResults.contactSubmissions },
        { name: 'Middleware Protection', passed: testResults.middlewareProtection }
      ]
      
      let passedCount = 0
      results.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL'
        console.log(`${status} ${result.name}`)
        if (result.passed) passedCount++
      })
      
      console.log(`\nResults: ${passedCount}/${results.length} tests passed`)
      
      // Expect at least 75% of tests to pass
      expect(passedCount / results.length).toBeGreaterThanOrEqual(0.75)
    })
  })
})
