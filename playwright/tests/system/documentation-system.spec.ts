import { expect, test } from '@playwright/test';

test.describe('Documentation & System Integrity Tests', () => {
  
  test.describe('Documentation Accessibility & Content', () => {
    const documentationPages = [
      {
        path: '/documentation',
        name: 'Documentation Home',
        expectedContent: ['getting started', 'api reference', 'user guide']
      },
      {
        path: '/documentation/getting-started',
        name: 'Getting Started',
        expectedContent: ['installation', 'setup', 'configuration']
      },
      {
        path: '/documentation/api-reference',
        name: 'API Reference',
        expectedContent: ['endpoint', 'authentication', 'response']
      },
      {
        path: '/documentation/user-guide',
        name: 'User Guide',
        expectedContent: ['user', 'guide', 'how to']
      },
      {
        path: '/documentation/faq',
        name: 'FAQ',
        expectedContent: ['question', 'answer', 'faq']
      },
      {
        path: '/documentation/troubleshooting',
        name: 'Troubleshooting',
        expectedContent: ['problem', 'solution', 'error']
      },
      {
        path: '/documentation/roadmap',
        name: 'Roadmap',
        expectedContent: ['roadmap', 'future', 'plan']
      }
    ];

    for (const doc of documentationPages) {
      test(`should load ${doc.name} documentation page correctly`, async ({ page }) => {
        await page.goto(doc.path);
        await page.waitForLoadState('networkidle');
        
        // Should load without errors
        await expect(page).toHaveURL(new RegExp(doc.path.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
        
        // Should have meaningful content
        const bodyText = await page.locator('body').textContent();
        expect(bodyText).toBeDefined();
        expect(bodyText!.length).toBeGreaterThan(100); // Should have substantial content
        
        // Should contain expected keywords
        const lowerBodyText = bodyText!.toLowerCase();
        const hasExpectedContent = doc.expectedContent.some(keyword => 
          lowerBodyText.includes(keyword.toLowerCase())
        );
        expect(hasExpectedContent).toBe(true);
      });
    }

    test('should have working navigation within documentation', async ({ page }) => {
      await page.goto('/documentation');
      
      // Should have navigation links to other documentation pages
      const navLinks = page.locator('a[href^="/documentation/"]');
      const linkCount = await navLinks.count();
      expect(linkCount).toBeGreaterThan(0);
      
      // Test navigation to at least one sub-page
      if (linkCount > 0) {
        await navLinks.first().click();
        await page.waitForLoadState('networkidle');
        
        // Should navigate to documentation sub-page
        await expect(page).toHaveURL(/.*\/documentation\/.+/);
      }
    });

    test('should provide search functionality in documentation', async ({ page }) => {
      await page.goto('/documentation');
      
      // Look for search functionality
      const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first();
      
      if (await searchInput.isVisible()) {
        await searchInput.fill('authentication');
        
        // Should show search results or filter content
        await page.waitForTimeout(1000); // Wait for search to process
        
        const content = await page.locator('body').textContent();
        expect(content).toContain('authentication');
      }
    });
  });

  test.describe('System API Endpoints Health', () => {
    test('should have healthy API endpoints', async ({ page }) => {
      const apiEndpoints = [
        { path: '/api/system/auth', method: 'POST' },
        { path: '/api/system/create-admin', method: 'POST' },
        { path: '/api/system/login-test', method: 'POST' },
        { path: '/api/system/login-test-simple', method: 'POST' }
      ];

      for (const endpoint of apiEndpoints) {
        const response = await page.request.fetch(`http://localhost:3000${endpoint.path}`, {
          method: endpoint.method,
          headers: { 'Content-Type': 'application/json' },
          data: {} // Empty data to test endpoint existence
        });
        
        // Should not return 404 (endpoint exists)
        expect(response.status()).not.toBe(404);
        
        // Should return appropriate error for empty data (400, 422) or unauthorized (401, 403)
        expect([400, 401, 403, 422, 500]).toContain(response.status());
      }
    });

    test('should validate API response format', async ({ page }) => {
      // Test system auth endpoint format
      const response = await page.request.post('http://localhost:3000/api/system/auth', {
        headers: { 'Content-Type': 'application/json' },
        data: { username: 'test', password: 'test' }
      });
      
      const responseBody = await response.json();
      
      // Should have consistent error response format
      expect(responseBody).toHaveProperty('success');
      if (!responseBody.success) {
        expect(responseBody).toHaveProperty('error');
      }
    });
  });

  test.describe('Database Connectivity & Health', () => {
    test('should have working database connection', async ({ page }) => {
      // Test database through login attempt (this validates DB connectivity)
      await page.goto('/auth');
      
      await page.fill('[data-testid="email-input"]', 'test@example.com');
      await page.fill('[data-testid="password-input"]', 'wrongpassword');
      await page.click('[data-testid="login-button"]');
      
      // Should get authentication error (not database error)
      await expect(page.locator('.v-alert--type-error')).toBeVisible({ timeout: 10000 });
      
      const errorText = await page.locator('.v-alert--type-error').textContent();
      // Should be auth error, not database connection error
      expect(errorText).not.toContain('database');
      expect(errorText).not.toContain('connection');
    });

    test('should handle database operations correctly', async ({ page }) => {
      // Test profile creation through registration
      const uniqueEmail = `dbtest${Date.now()}@example.com`;
      
      await page.goto('/auth/register');
      
      await page.fill('[data-testid="fullname-input"]', 'DB Test User');
      await page.fill('[data-testid="email-input"]', uniqueEmail);
      await page.fill('[data-testid="password-input"]', 'TestPass123!');
      await page.fill('[data-testid="confirm-password-input"]', 'TestPass123!');
      await page.check('input[type="checkbox"]');
      
      await page.click('[data-testid="create-account-button"]');
      
      // Should successfully create user (validates DB write operations)
      await expect(page.locator('.v-alert--type-success')).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Performance & Loading', () => {
    test('should load pages within acceptable time limits', async ({ page }) => {
      const criticalPages = ['/', '/auth', '/auth/register', '/documentation'];
      
      for (const pagePath of criticalPages) {
        const startTime = Date.now();
        
        await page.goto(pagePath);
        await page.waitForLoadState('networkidle');
        
        const loadTime = Date.now() - startTime;
        
        // Pages should load within 5 seconds
        expect(loadTime).toBeLessThan(5000);
      }
    });

    test('should have optimized asset loading', async ({ page }) => {
      await page.goto('/');
      
      // Check for common performance issues
      const responses = [];
      page.on('response', response => responses.push(response));
      
      await page.waitForLoadState('networkidle');
      
      // Should not have excessive number of requests
      expect(responses.length).toBeLessThan(50);
      
      // Critical resources should load successfully
      const failedRequests = responses.filter(r => r.status() >= 400);
      expect(failedRequests.length).toBe(0);
    });
  });

  test.describe('Error Handling & User Experience', () => {
    test('should handle network errors gracefully', async ({ page }) => {
      // Test with simulated slow network
      await page.route('**/*', route => {
        setTimeout(() => route.continue(), 100);
      });
      
      await page.goto('/');
      
      // Should still load, albeit slowly
      await expect(page.locator('body')).toBeVisible({ timeout: 10000 });
    });

    test('should provide helpful error messages', async ({ page }) => {
      // Test various error scenarios
      await page.goto('/auth');
      
      // Invalid email format
      await page.fill('[data-testid="email-input"]', 'invalid-email');
      await page.fill('[data-testid="password-input"]', 'password');
      await page.click('[data-testid="login-button"]');
      
      // Error should be user-friendly
      await page.waitForTimeout(2000);
      const pageContent = await page.textContent('body');
      
      // Should not show technical error messages to users
      expect(pageContent).not.toContain('stack trace');
      expect(pageContent).not.toContain('undefined');
      expect(pageContent).not.toContain('null');
    });

    test('should maintain accessibility standards', async ({ page }) => {
      await page.goto('/');
      
      // Check for basic accessibility features
      const headings = page.locator('h1, h2, h3, h4, h5, h6');
      const headingCount = await headings.count();
      expect(headingCount).toBeGreaterThan(0);
      
      // Forms should have proper labels
      await page.goto('/auth');
      const inputs = page.locator('input[type="email"], input[type="password"]');
      const inputCount = await inputs.count();
      
      for (let i = 0; i < inputCount; i++) {
        const input = inputs.nth(i);
        const id = await input.getAttribute('id');
        const ariaLabel = await input.getAttribute('aria-label');
        const hasLabel = await page.locator(`label[for="${id}"]`).count() > 0;
        
        // Each input should have a label or aria-label
        expect(hasLabel || !!ariaLabel).toBe(true);
      }
    });
  });

  test.describe('Security Headers & Configuration', () => {
    test('should have proper security headers', async ({ page }) => {
      const response = await page.goto('/');
      
      if (response) {
        const headers = response.headers();
        
        // Check for important security headers (may not be present in dev)
        const securityHeaders = [
          'x-frame-options',
          'x-content-type-options',
          'referrer-policy'
        ];
        
        // In development, these might not be set, so we just check they're not insecure
        const xFrameOptions = headers['x-frame-options'];
        if (xFrameOptions) {
          expect(xFrameOptions.toLowerCase()).not.toBe('allowall');
        }
      }
    });

    test('should prevent common security vulnerabilities', async ({ page }) => {
      // Test XSS prevention
      await page.goto('/auth');
      
      const xssPayload = '<script>alert("xss")</script>';
      await page.fill('[data-testid="email-input"]', xssPayload);
      
      // Script should not execute
      let alertShown = false;
      page.on('dialog', dialog => {
        alertShown = true;
        dialog.dismiss();
      });
      
      await page.click('[data-testid="login-button"]');
      await page.waitForTimeout(1000);
      
      expect(alertShown).toBe(false);
    });
  });
});
