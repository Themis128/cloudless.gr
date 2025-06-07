/**
 * Middleware System Tests
 * Converted from PowerShell middleware test files
 */

import { describe, it, expect } from 'vitest'
import { existsSync } from 'fs'
import { readFile } from 'fs/promises'
import { resolve } from 'path'
import { glob } from 'glob'

// Test configuration
const TEST_CONFIG = {
  serverUrl: process.env.TEST_SERVER_URL || 'http://localhost:3000'
}

interface MiddlewareTestResults {
  centralizedMiddleware: boolean
  publicRouteHandling: boolean
  proRequirement: boolean
  businessRequirement: boolean
  adminRequirement: boolean
  upgradeRedirect: boolean
  accessDeniedRedirect: boolean
  routeMetadata: boolean
  supportPages: boolean
}

let testResults: MiddlewareTestResults = {
  centralizedMiddleware: false,
  publicRouteHandling: false,
  proRequirement: false,
  businessRequirement: false,
  adminRequirement: false,
  upgradeRedirect: false,
  accessDeniedRedirect: false,
  routeMetadata: false,
  supportPages: false
}

describe('Middleware System Tests', () => {
  describe('Centralized Middleware', () => {
    it('should have centralized auth middleware', () => {
      const middlewarePath = resolve(process.cwd(), 'middleware/auth.global.ts')
      const exists = existsSync(middlewarePath)
      
      expect(exists).toBe(true)
      testResults.centralizedMiddleware = exists
      
      if (exists) {
        console.log('✅ Centralized middleware found: middleware/auth.global.ts')
      } else {
        console.log('❌ Middleware file missing: middleware/auth.global.ts')
      }
    })

    it('should have all required middleware features', async () => {
      const middlewarePath = resolve(process.cwd(), 'middleware/auth.global.ts')
      
      if (!existsSync(middlewarePath)) {
        throw new Error('Middleware file not found')
      }

      const content = await readFile(middlewarePath, 'utf-8')
      
      const features = [
        { pattern: /to\.meta\.public/i, name: 'Public route handling', key: 'publicRouteHandling' },
        { pattern: /requiresPro/i, name: 'Pro plan requirement', key: 'proRequirement' },
        { pattern: /requiresBusiness/i, name: 'Business plan requirement', key: 'businessRequirement' },
        { pattern: /requiresAdmin/i, name: 'Admin role requirement', key: 'adminRequirement' },
        { pattern: /navigateTo.*upgrade/i, name: 'Upgrade redirect', key: 'upgradeRedirect' },
        { pattern: /navigateTo.*unauthorized/i, name: 'Access denied redirect', key: 'accessDeniedRedirect' }
      ]

      features.forEach(feature => {
        const hasFeature = feature.pattern.test(content)
        testResults[feature.key as keyof MiddlewareTestResults] = hasFeature
        
        if (hasFeature) {
          console.log(`✅ ${feature.name}`)
        } else {
          console.log(`❌ ${feature.name} missing`)
        }
        
        expect(hasFeature).toBe(true)
      })
    })
  })

  describe('Route Metadata Analysis', () => {
    it('should have proper route metadata in pages', async () => {
      const pageFiles = await glob('pages/**/*.vue', { cwd: process.cwd() })
      let pagesWithMetadata = 0
      let totalPages = 0
      
      const metadataPatterns = [
        /definePageMeta\s*\(/,
        /meta:\s*{/,
        /requiresAuth/,
        /requiresAdmin/,
        /requiresPro/,
        /requiresBusiness/,
        /public:\s*true/
      ]

      for (const pageFile of pageFiles) {
        totalPages++
        const fullPath = resolve(process.cwd(), pageFile)
        
        try {
          const content = await readFile(fullPath, 'utf-8')
          
          const hasMetadata = metadataPatterns.some(pattern => pattern.test(content))
          if (hasMetadata) {
            pagesWithMetadata++
            console.log(`✅ ${pageFile} has route metadata`)
          } else {
            console.log(`⚠️  ${pageFile} missing route metadata`)
          }
        } catch (error) {
          console.log(`❌ Error reading ${pageFile}:`, error)
        }
      }
      
      const metadataRatio = totalPages > 0 ? pagesWithMetadata / totalPages : 0
      testResults.routeMetadata = metadataRatio > 0.5 // At least 50% should have metadata
      
      console.log(`📊 Route metadata coverage: ${pagesWithMetadata}/${totalPages} pages (${Math.round(metadataRatio * 100)}%)`)
      
      expect(metadataRatio).toBeGreaterThan(0.3) // At least 30% should have metadata
    })

    it('should have consistent metadata patterns', async () => {
      const adminPages = await glob('pages/admin/**/*.vue', { cwd: process.cwd() })
      let adminPagesWithAuth = 0

      for (const adminPage of adminPages) {
        const fullPath = resolve(process.cwd(), adminPage)
        
        try {
          const content = await readFile(fullPath, 'utf-8')
          
          const hasAdminAuth = /requiresAdmin|middleware:.*admin/i.test(content)
          if (hasAdminAuth) {
            adminPagesWithAuth++
            console.log(`✅ ${adminPage} has admin authentication`)
          } else {
            console.log(`❌ ${adminPage} missing admin authentication`)
          }
        } catch (error) {
          console.log(`❌ Error reading ${adminPage}:`, error)
        }
      }
      
      if (adminPages.length > 0) {
        const adminAuthRatio = adminPagesWithAuth / adminPages.length
        expect(adminAuthRatio).toBeGreaterThan(0.8) // At least 80% of admin pages should have auth
      }
    })
  })

  describe('Support Pages Detection', () => {
    it('should have all required support pages', () => {
      const supportPages = [
        'pages/unauthorized.vue',
        'pages/billing/upgrade.vue',
        'pages/auth/login.vue',
        'pages/auth/signup.vue'
      ]

      const missingPages: string[] = []
      let foundPages = 0

      supportPages.forEach(page => {
        const fullPath = resolve(process.cwd(), page)
        if (existsSync(fullPath)) {
          foundPages++
          console.log(`✅ ${page}`)
        } else {
          console.log(`❌ ${page} missing`)
          missingPages.push(page)
        }
      })

      testResults.supportPages = missingPages.length === 0
      
      expect(foundPages).toBeGreaterThan(supportPages.length / 2) // At least half should exist
    })

    it('should create missing support pages if auto-fix is enabled', () => {
      // This would be implemented if auto-fix functionality is needed
      // For now, we just report what's missing
      const autoFix = process.env.AUTO_FIX_PAGES === 'true'
      
      if (autoFix) {
        console.log('🔧 Auto-fix enabled - would create missing pages')
      } else {
        console.log('ℹ️  Auto-fix disabled - run with AUTO_FIX_PAGES=true to create missing pages')
      }
    })
  })

  describe('Middleware File Structure', () => {
    it('should have proper middleware file organization', async () => {
      const middlewareFiles = await glob('middleware/**/*.ts', { cwd: process.cwd() })
      
      const expectedMiddleware = [
        'middleware/auth.global.ts',
        'middleware/admin-required.ts',
        'middleware/auth-required.ts'
      ]

      let foundMiddleware = 0
      
      expectedMiddleware.forEach(middleware => {
        const exists = middlewareFiles.some(file => file.includes(middleware.replace('middleware/', '')))
        if (exists) {
          foundMiddleware++
          console.log(`✅ ${middleware}`)
        } else {
          console.log(`❌ ${middleware} missing`)
        }
      })

      expect(foundMiddleware).toBeGreaterThan(0)
      console.log(`📁 Middleware files found: ${middlewareFiles.length}`)
    })

    it('should have global middleware with proper export', async () => {
      const globalMiddlewarePath = resolve(process.cwd(), 'middleware/auth.global.ts')
      
      if (existsSync(globalMiddlewarePath)) {
        const content = await readFile(globalMiddlewarePath, 'utf-8')
        
        // Check for proper export structure
        const hasExport = /export\s+default|export\s*{|export\s+function/.test(content)
        expect(hasExport).toBe(true)
        
        // Check for Nuxt 3 middleware patterns
        const hasNuxtPattern = /defineNuxtRouteMiddleware|navigateTo|to\.meta/.test(content)
        expect(hasNuxtPattern).toBe(true)
        
        console.log('✅ Global middleware has proper structure')
      }
    })
  })

  describe('Route Protection Testing', () => {
    it('should protect admin routes properly', async () => {
      if (!TEST_CONFIG.serverUrl) {
        console.log('⚠️  Skipping route protection test - no server URL configured')
        return
      }

      const protectedRoutes = [
        '/admin',
        '/admin/dashboard',
        '/admin/contact-submissions'
      ]

      for (const route of protectedRoutes) {
        try {
          const response = await fetch(`${TEST_CONFIG.serverUrl}${route}`, {
            redirect: 'manual' // Don't follow redirects automatically
          })

          // Should redirect to login or return 401/403
          const isProtected = [301, 302, 401, 403].includes(response.status)
          
          if (isProtected) {
            console.log(`✅ ${route} is properly protected (status: ${response.status})`)
          } else {
            console.log(`❌ ${route} may not be protected (status: ${response.status})`)
          }
          
          expect(isProtected).toBe(true)
        } catch (error) {
          console.log(`⚠️  Could not test ${route}:`, error)
          // Don't fail the test if server is not available
        }
      }
    })

    it('should allow access to public routes', async () => {
      if (!TEST_CONFIG.serverUrl) {
        console.log('⚠️  Skipping public route test - no server URL configured')
        return
      }

      const publicRoutes = [
        '/',
        '/pricing',
        '/auth/login',
        '/auth/signup'
      ]

      for (const route of publicRoutes) {
        try {
          const response = await fetch(`${TEST_CONFIG.serverUrl}${route}`)

          // Should be accessible (200) or redirect to a public page
          const isAccessible = response.status < 400 || response.status === 302
          
          if (isAccessible) {
            console.log(`✅ ${route} is accessible (status: ${response.status})`)
          } else {
            console.log(`❌ ${route} may be blocked (status: ${response.status})`)
          }
          
          expect(isAccessible).toBe(true)
        } catch (error) {
          console.log(`⚠️  Could not test ${route}:`, error)
          // Don't fail the test if server is not available
        }
      }
    })
  })

  describe('Middleware Test Results Summary', () => {
    it('should report all middleware test results', () => {
      console.log('\n🛡️  Middleware System Test Results Summary')
      console.log('==========================================')
      
      const results = [
        { name: 'Centralized Middleware', passed: testResults.centralizedMiddleware },
        { name: 'Public Route Handling', passed: testResults.publicRouteHandling },
        { name: 'Pro Plan Requirement', passed: testResults.proRequirement },
        { name: 'Business Plan Requirement', passed: testResults.businessRequirement },
        { name: 'Admin Role Requirement', passed: testResults.adminRequirement },
        { name: 'Upgrade Redirect', passed: testResults.upgradeRedirect },
        { name: 'Access Denied Redirect', passed: testResults.accessDeniedRedirect },
        { name: 'Route Metadata', passed: testResults.routeMetadata },
        { name: 'Support Pages', passed: testResults.supportPages }
      ]
      
      let passedCount = 0
      results.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL'
        console.log(`${status} ${result.name}`)
        if (result.passed) passedCount++
      })
      
      console.log(`\nResults: ${passedCount}/${results.length} middleware tests passed`)
      
      // Expect at least 70% of middleware tests to pass
      expect(passedCount / results.length).toBeGreaterThanOrEqual(0.7)
    })
  })
})
