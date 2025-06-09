/**
 * Secure Redirect Test Suite
 * Tests the security and functionality of the redirect system
 */

import { describe, it, expect } from 'vitest'
import { 
  sanitizeRedirect, 
  getRedirectFromQuery, 
  isAllowedRedirectPath,
  createLoginRedirectUrl,
  getOAuthCallbackUrl,
  getMagicLinkCallbackUrl 
} from '~/utils/secureRedirect'

describe('Secure Redirect Utility', () => {
  describe('sanitizeRedirect', () => {
    it('should allow valid internal paths', () => {
      expect(sanitizeRedirect('/dashboard')).toBe('/dashboard')
      expect(sanitizeRedirect('/admin/users')).toBe('/admin/users')
      expect(sanitizeRedirect('/settings/profile')).toBe('/settings/profile')
    })

    it('should block external URLs', () => {
      expect(sanitizeRedirect('https://malicious.com')).toBe('/dashboard')
      expect(sanitizeRedirect('http://evil.com/steal')).toBe('/dashboard')
      expect(sanitizeRedirect('ftp://bad.com')).toBe('/dashboard')
    })

    it('should block protocol-relative URLs', () => {
      expect(sanitizeRedirect('//malicious.com')).toBe('/dashboard')
      expect(sanitizeRedirect('//evil.com/path')).toBe('/dashboard')
    })

    it('should block JavaScript URLs', () => {
      expect(sanitizeRedirect('javascript:alert("xss")')).toBe('/dashboard')
      expect(sanitizeRedirect('JavaScript:void(0)')).toBe('/dashboard')
      expect(sanitizeRedirect('data:text/html,<script>alert(1)</script>')).toBe('/dashboard')
    })

    it('should handle encoded malicious URLs', () => {
      expect(sanitizeRedirect('/%2F/malicious.com')).toBe('/dashboard')
      expect(sanitizeRedirect('/javascript%3Aalert(1)')).toBe('/dashboard')
    })

    it('should block unauthorized paths', () => {
      expect(sanitizeRedirect('/unauthorized')).toBe('/dashboard')
      expect(sanitizeRedirect('/api/secrets')).toBe('/dashboard')
      expect(sanitizeRedirect('/system/admin')).toBe('/dashboard')
    })

    it('should handle role-based defaults', () => {
      expect(sanitizeRedirect(null, 'admin')).toBe('/admin/dashboard')
      expect(sanitizeRedirect('', 'admin')).toBe('/admin/dashboard')
      expect(sanitizeRedirect(null, 'user')).toBe('/dashboard')
      expect(sanitizeRedirect('', 'user')).toBe('/dashboard')
    })

    it('should handle edge cases safely', () => {
      expect(sanitizeRedirect(undefined)).toBe('/dashboard')
      expect(sanitizeRedirect('')).toBe('/dashboard')
      expect(sanitizeRedirect('   ')).toBe('/dashboard')
      expect(sanitizeRedirect(null)).toBe('/dashboard')
    })
  })

  describe('isAllowedRedirectPath', () => {
    it('should allow whitelisted paths', () => {
      expect(isAllowedRedirectPath('/dashboard')).toBe(true)
      expect(isAllowedRedirectPath('/admin/dashboard')).toBe(true)
      expect(isAllowedRedirectPath('/settings/profile')).toBe(true)
      expect(isAllowedRedirectPath('/projects/new')).toBe(true)
    })

    it('should reject non-whitelisted paths', () => {
      expect(isAllowedRedirectPath('/api/admin')).toBe(false)
      expect(isAllowedRedirectPath('/system')).toBe(false)
      expect(isAllowedRedirectPath('/internal')).toBe(false)
    })

    it('should reject malformed paths', () => {
      expect(isAllowedRedirectPath('//evil.com')).toBe(false)
      expect(isAllowedRedirectPath('javascript:void(0)')).toBe(false)
      expect(isAllowedRedirectPath('')).toBe(false)
      expect(isAllowedRedirectPath('relative/path')).toBe(false)
    })
  })

  describe('createLoginRedirectUrl', () => {
    it('should create proper login URLs with redirects', () => {
      const url = createLoginRedirectUrl('/dashboard')
      expect(url).toBe('/auth/login?redirect=%2Fdashboard')
    })

    it('should handle custom login paths', () => {
      const url = createLoginRedirectUrl('/admin/users', '/auth/admin-login')
      expect(url).toBe('/auth/admin-login?redirect=%2Fadmin%2Fusers')
    })

    it('should sanitize malicious redirects', () => {
      const url = createLoginRedirectUrl('//evil.com')
      expect(url).toBe('/auth/login?redirect=%2Fdashboard')
    })
  })

  describe('OAuth and Magic Link URLs', () => {
    // Mock window.location.origin for tests
    const originalLocation = global.window?.location
    beforeAll(() => {
      global.window = { location: { origin: 'https://test.com' } } as any
    })
    afterAll(() => {
      global.window = { location: originalLocation } as any
    })

    it('should create secure OAuth callback URLs', () => {
      const url = getOAuthCallbackUrl('/dashboard', 'google')
      expect(url).toContain('https://test.com/auth/callback')
      expect(url).toContain('type=oauth')
      expect(url).toContain('provider=google')
      expect(url).toContain('redirect=%2Fdashboard')
    })

    it('should create secure magic link callback URLs', () => {
      const url = getMagicLinkCallbackUrl('/settings')
      expect(url).toContain('https://test.com/auth/callback')
      expect(url).toContain('type=magiclink')
      expect(url).toContain('redirect=%2Fsettings')
    })

    it('should sanitize malicious redirects in callbacks', () => {
      const oauthUrl = getOAuthCallbackUrl('//evil.com', 'github')
      expect(oauthUrl).toContain('redirect=%2Fdashboard')
      
      const magicUrl = getMagicLinkCallbackUrl('javascript:alert(1)')
      expect(magicUrl).toContain('redirect=%2Fdashboard')
    })
  })

  describe('getRedirectFromQuery', () => {
    it('should extract redirect from query parameters', () => {
      const mockRoute = {
        query: { redirect: '/dashboard' }
      }
      expect(getRedirectFromQuery(mockRoute)).toBe('/dashboard')
    })

    it('should handle redirectTo parameter', () => {
      const mockRoute = {
        query: { redirectTo: '/settings' }
      }
      expect(getRedirectFromQuery(mockRoute)).toBe('/settings')
    })

    it('should prefer redirect over redirectTo', () => {
      const mockRoute = {
        query: { 
          redirect: '/dashboard',
          redirectTo: '/settings'
        }
      }
      expect(getRedirectFromQuery(mockRoute)).toBe('/dashboard')
    })

    it('should apply role-based defaults', () => {
      const mockRoute = { query: {} }
      expect(getRedirectFromQuery(mockRoute, 'admin')).toBe('/admin/dashboard')
      expect(getRedirectFromQuery(mockRoute, 'user')).toBe('/dashboard')
    })

    it('should sanitize malicious query parameters', () => {
      const mockRoute = {
        query: { redirect: '//evil.com' }
      }
      expect(getRedirectFromQuery(mockRoute)).toBe('/dashboard')
    })
  })
})
