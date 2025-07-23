const { test, expect } = require('@playwright/test')

test.describe('🛡️ Security Tests', () => {
  const baseURL = 'http://192.168.0.23:3000'

  test('🔒 Input Validation - XSS Prevention', async ({ request }) => {
    const maliciousData = {
      name: '<script>alert("XSS")</script>',
      description: '"><img src=x onerror=alert("XSS")>',
      config: JSON.stringify({
        type: 'Data Processing',
        version: '1.0.0',
        inputType: 'JSON',
        outputType: 'CSV',
        steps: []
      }),
      status: 'draft'
    }

    const response = await request.post(`${baseURL}/api/prisma/pipelines`, {
      data: maliciousData
    })

    expect(response.status()).toBe(200)
    const result = await response.json()
    
    // Check that malicious content is sanitized
    expect(result.data.name).not.toContain('<script>')
    expect(result.data.description).not.toContain('<img')
  })

  test('🔒 SQL Injection Prevention', async ({ request }) => {
    const sqlInjectionData = {
      name: "'; DROP TABLE users; --",
      description: "'; INSERT INTO users VALUES ('hacker', 'password'); --",
      config: JSON.stringify({
        type: 'Data Processing',
        version: '1.0.0',
        inputType: 'JSON',
        outputType: 'CSV',
        steps: []
      }),
      status: 'draft'
    }

    const response = await request.post(`${baseURL}/api/prisma/pipelines`, {
      data: sqlInjectionData
    })

    // Should handle gracefully without SQL errors
    expect(response.status()).toBe(200)
    const result = await response.json()
    expect(result.success).toBe(true)
  })

  test('🔒 Rate Limiting - API Abuse Prevention', async ({ request }) => {
    const pipelineData = {
      name: 'Rate Limit Test',
      description: 'Testing rate limiting',
      config: JSON.stringify({
        type: 'Data Processing',
        version: '1.0.0',
        inputType: 'JSON',
        outputType: 'CSV',
        steps: []
      }),
      status: 'draft'
    }

    // Make multiple rapid requests
    const promises = []
    for (let i = 0; i < 20; i++) {
      promises.push(
        request.post(`${baseURL}/api/prisma/pipelines`, {
          data: { ...pipelineData, name: `Rate Limit Test ${i}` }
        })
      )
    }

    const responses = await Promise.all(promises)
    
    // Some requests should be rate limited
    const rateLimited = responses.filter(r => r.status() === 429)
    expect(rateLimited.length).toBeGreaterThan(0)
  })

  test('🔒 Authentication - Protected Route Access', async ({ request }) => {
    // Try to access admin endpoints without authentication
    const adminEndpoints = [
      '/api/admin/users',
      '/api/admin/redis-analytics',
      '/api/admin/redis-status'
    ]

    for (const endpoint of adminEndpoints) {
      const response = await request.get(`${baseURL}${endpoint}`)
      
      // Should require authentication
      expect([401, 403, 404]).toContain(response.status())
    }
  })

  test('🔒 File Upload Security', async ({ request }) => {
    // Test malicious file upload
    const maliciousFile = Buffer.from('<script>alert("malicious")</script>')
    
    const formData = new FormData()
    formData.append('file', new Blob([maliciousFile], { type: 'text/plain' }), 'malicious.js')
    formData.append('name', 'Malicious Upload Test')

    const response = await request.post(`${baseURL}/api/upload`, {
      data: formData
    })

    // Should reject malicious files
    expect([400, 403, 404]).toContain(response.status())
  })

  test('🔒 Content Security Policy', async ({ page }) => {
    await page.goto(`${baseURL}/pipelines/create`)
    
    // Check for CSP headers
    const response = await page.waitForResponse('**/*')
    const headers = response.headers()
    
    // Should have security headers
    expect(headers['content-security-policy'] || headers['x-content-security-policy']).toBeDefined()
  })

  test('🔒 HTTPS Enforcement', async ({ request }) => {
    // Test that sensitive data is not sent over HTTP
    const response = await request.get(`${baseURL}/api/health/database`)
    
    // Check for security headers
    const headers = response.headers()
    expect(headers['strict-transport-security'] || headers['hsts']).toBeDefined()
  })

  test('🔒 Input Sanitization - Special Characters', async ({ request }) => {
    const specialCharData = {
      name: 'Test with special chars: !@#$%^&*()_+-=[]{}|;:,.<>?',
      description: 'Description with quotes: "single" and \'double\' quotes',
      config: JSON.stringify({
        type: 'Data Processing',
        version: '1.0.0',
        inputType: 'JSON',
        outputType: 'CSV',
        steps: []
      }),
      status: 'draft'
    }

    const response = await request.post(`${baseURL}/api/prisma/pipelines`, {
      data: specialCharData
    })

    expect(response.status()).toBe(200)
    const result = await response.json()
    expect(result.success).toBe(true)
    
    // Data should be stored correctly
    expect(result.data.name).toBe(specialCharData.name)
  })
}) 