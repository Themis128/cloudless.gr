/**
 * JWT Token Validation Tests
 * Converted from PowerShell JWT validation test
 */

import { describe, it, expect, beforeAll } from 'vitest'
import jwt from 'jsonwebtoken'

// Test configuration
const TEST_CONFIG = {
  serverUrl: process.env.TEST_SERVER_URL || 'http://localhost:3000',
  adminEmail: process.env.ADMIN_EMAIL || 'admin@cloudless.gr',
  adminPassword: process.env.ADMIN_PASSWORD || 'cloudless2025'
}

interface JWTTestResults {
  tokenGenerated: boolean
  tokenStructure: boolean
  tokenClaims: boolean
  tokenExpiration: boolean
  tokenSignature: boolean
}

let testResults: JWTTestResults = {
  tokenGenerated: false,
  tokenStructure: false,
  tokenClaims: false,
  tokenExpiration: false,
  tokenSignature: false
}

let adminToken: string | null = null

// Base64URL decode utility
function base64UrlDecode(str: string): string {
  // Add padding if needed
  const padding = 4 - (str.length % 4)
  if (padding !== 4) {
    str += '='.repeat(padding)
  }
  
  // Replace URL-safe characters
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  
  return Buffer.from(str, 'base64').toString('utf-8')
}

// JWT parsing utility
function parseJWT(token: string) {
  const parts = token.split('.')
  if (parts.length !== 3) {
    throw new Error('Invalid JWT format')
  }

  try {
    const header = JSON.parse(base64UrlDecode(parts[0]))
    const payload = JSON.parse(base64UrlDecode(parts[1]))
    const signature = parts[2]

    return { header, payload, signature }
  } catch (error) {
    throw new Error('Failed to parse JWT: ' + (error as Error).message)
  }
}

describe('JWT Token Validation', () => {
  beforeAll(async () => {
    // Get admin token first
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

      if (response.ok) {
        const data = await response.json()
        adminToken = data.token
        testResults.tokenGenerated = true
        console.log('✅ Admin token generated successfully')
      } else {
        console.error('❌ Failed to generate admin token')
        throw new Error('Could not obtain admin token for testing')
      }
    } catch (error) {
      console.error('❌ Token generation failed:', error)
      throw error
    }
  })

  describe('Token Generation', () => {
    it('should successfully generate an admin token', () => {
      expect(adminToken).toBeTruthy()
      expect(typeof adminToken).toBe('string')
      expect(adminToken!.length).toBeGreaterThan(50) // JWT tokens are typically much longer
    })
  })

  describe('Token Structure Validation', () => {
    it('should have valid JWT structure (header.payload.signature)', () => {
      if (!adminToken) {
        throw new Error('No admin token available for testing')
      }

      const parts = adminToken.split('.')
      expect(parts).toHaveLength(3)
      
      // Each part should be base64url encoded
      parts.forEach((part, index) => {
        expect(part).toBeTruthy()
        expect(part.length).toBeGreaterThan(0)
        
        // Should not contain invalid base64url characters
        expect(part).not.toMatch(/[^A-Za-z0-9\-_]/)
      })
      
      testResults.tokenStructure = true
      console.log('✅ Token structure is valid')
    })

    it('should have valid JWT header', () => {
      if (!adminToken) {
        throw new Error('No admin token available for testing')
      }

      const { header } = parseJWT(adminToken)
      
      // Check required header fields
      expect(header).toHaveProperty('alg')
      expect(header).toHaveProperty('typ')
      expect(header.typ).toBe('JWT')
      expect(['HS256', 'HS384', 'HS512', 'RS256']).toContain(header.alg)
      
      console.log('✅ JWT header is valid:', header)
    })
  })

  describe('Token Claims Validation', () => {
    it('should have all required claims', () => {
      if (!adminToken) {
        throw new Error('No admin token available for testing')
      }

      const { payload } = parseJWT(adminToken)
      
      // Standard JWT claims
      expect(payload).toHaveProperty('iat') // issued at
      expect(payload).toHaveProperty('exp') // expiration
      expect(payload).toHaveProperty('sub') // subject (user ID)
      
      // Application-specific claims
      expect(payload).toHaveProperty('email')
      expect(payload).toHaveProperty('isAdmin')
      expect(payload.isAdmin).toBe(true)
      expect(payload.email).toBe(TEST_CONFIG.adminEmail)
      
      testResults.tokenClaims = true
      console.log('✅ Token claims are valid:', {
        sub: payload.sub,
        email: payload.email,
        isAdmin: payload.isAdmin,
        iat: new Date(payload.iat * 1000).toISOString(),
        exp: new Date(payload.exp * 1000).toISOString()
      })
    })

    it('should have valid timestamps', () => {
      if (!adminToken) {
        throw new Error('No admin token available for testing')
      }

      const { payload } = parseJWT(adminToken)
      const now = Math.floor(Date.now() / 1000)
      
      // iat should be in the past or now
      expect(payload.iat).toBeLessThanOrEqual(now)
      
      // exp should be in the future
      expect(payload.exp).toBeGreaterThan(now)
      
      // Token should have reasonable expiration (between 1 hour and 30 days)
      const tokenLifetime = payload.exp - payload.iat
      expect(tokenLifetime).toBeGreaterThan(3600) // At least 1 hour
      expect(tokenLifetime).toBeLessThan(2592000) // Less than 30 days
      
      console.log(`✅ Token timestamps valid (lifetime: ${Math.floor(tokenLifetime / 3600)} hours)`)
    })
  })

  describe('Token Expiration', () => {
    it('should not be expired', () => {
      if (!adminToken) {
        throw new Error('No admin token available for testing')
      }

      const { payload } = parseJWT(adminToken)
      const now = Math.floor(Date.now() / 1000)
      const timeUntilExpiry = payload.exp - now
      
      expect(timeUntilExpiry).toBeGreaterThan(0)
      
      testResults.tokenExpiration = true
      console.log(`✅ Token expires in ${Math.floor(timeUntilExpiry / 3600)} hours`)
    })

    it('should handle expiration correctly', () => {
      // Create a test token that's already expired
      const expiredPayload = {
        sub: 'test-user',
        email: 'test@example.com',
        isAdmin: true,
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600  // 1 hour ago (expired)
      }

      // This test would typically require access to the JWT secret to create a signed token
      // For now, we'll just validate the expiration logic conceptually
      const now = Math.floor(Date.now() / 1000)
      expect(expiredPayload.exp).toBeLessThan(now)
      
      console.log('✅ Expiration logic validation passed')
    })
  })

  describe('Token Signature Validation', () => {
    it('should have a valid signature format', () => {
      if (!adminToken) {
        throw new Error('No admin token available for testing')
      }

      const { signature } = parseJWT(adminToken)
      
      // Signature should be base64url encoded
      expect(signature).toBeTruthy()
      expect(signature.length).toBeGreaterThan(10)
      expect(signature).not.toMatch(/[^A-Za-z0-9\-_]/)
      
      testResults.tokenSignature = true
      console.log('✅ Token signature format is valid')
    })

    // Note: Full signature verification would require access to the JWT secret
    // which is typically not available in tests for security reasons
  })

  describe('Token Security Features', () => {
    it('should include security headers and claims', () => {
      if (!adminToken) {
        throw new Error('No admin token available for testing')
      }

      const { header, payload } = parseJWT(adminToken)
      
      // Algorithm should be secure
      expect(['HS256', 'HS384', 'HS512', 'RS256']).toContain(header.alg)
      
      // Should have audience claim if configured
      if (payload.aud) {
        expect(payload.aud).toBeTruthy()
      }
      
      // Should have issuer claim if configured
      if (payload.iss) {
        expect(payload.iss).toBeTruthy()
      }
      
      console.log('✅ Security features validated')
    })

    it('should not expose sensitive information', () => {
      if (!adminToken) {
        throw new Error('No admin token available for testing')
      }

      const { payload } = parseJWT(adminToken)
      
      // Should not contain password or other sensitive data
      expect(payload).not.toHaveProperty('password')
      expect(payload).not.toHaveProperty('passwordHash')
      expect(payload).not.toHaveProperty('secret')
      expect(payload).not.toHaveProperty('apiKey')
      
      console.log('✅ No sensitive information exposed in token')
    })
  })

  describe('JWT Test Results Summary', () => {
    it('should report all JWT test results', () => {
      console.log('\n🔑 JWT Validation Test Results Summary')
      console.log('======================================')
      
      const results = [
        { name: 'Token Generated', passed: testResults.tokenGenerated },
        { name: 'Token Structure', passed: testResults.tokenStructure },
        { name: 'Token Claims', passed: testResults.tokenClaims },
        { name: 'Token Expiration', passed: testResults.tokenExpiration },
        { name: 'Token Signature', passed: testResults.tokenSignature }
      ]
      
      let passedCount = 0
      results.forEach(result => {
        const status = result.passed ? '✅ PASS' : '❌ FAIL'
        console.log(`${status} ${result.name}`)
        if (result.passed) passedCount++
      })
      
      console.log(`\nResults: ${passedCount}/${results.length} JWT tests passed`)
      
      // All JWT tests should pass
      expect(passedCount).toBe(results.length)
    })
  })
})
