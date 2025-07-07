import { test, expect } from '@playwright/test';

test.describe('End-to-End System Tests', () => {
  const testUser = {
    email: 'baltzakis.themis@gmail.com',
    password: 'TH!123789th!'
  };

  test.describe('Complete Login and Navigation Workflow', () => {
    test('should complete full authentication and navigation workflow', async ({ page }) => {
      // 1. Start at home page
      await page.goto('/');
      
      // 2. Try to access protected route - should redirect to auth
      await page.goto('/users');
      await page.waitForURL(/.*\/auth.*/, { timeout: 5000 });
      expect(page.url()).toContain('/auth');
      
      // 3. Verify login form is present
      await expect(page.locator('text=Welcome Back')).toBeVisible();
      await expect(page.locator('input[type="email"]')).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      
      // 4. Perform login
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // 5. Should be redirected to users dashboard
      await page.waitForURL(/.*\/users.*/, { timeout: 10000 });
      expect(page.url()).toContain('/users');
      
      // 6. Verify dashboard content loads
      await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 10000 });
      
      // 7. Navigate to admin
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/admin');
      
      // 8. Navigate to projects
      await page.goto('/projects');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/projects');
      
      // 9. Return to users
      await page.goto('/users');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/users');
      
      // 10. Verify session persists across navigation
      await page.reload();
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/users');
    });

    test('should handle complex redirect scenario', async ({ page }) => {
      // 1. Try to access deeply nested admin route
      await page.goto('/admin/users');
      
      // 2. Should redirect to auth
      await page.waitForURL(/.*\/auth.*/, { timeout: 5000 });
      expect(page.url()).toContain('/auth');
      
      // 3. Login
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // 4. Should redirect to admin area
      await page.waitForURL(/.*\/admin.*/, { timeout: 10000 });
      expect(page.url()).toContain('/admin');
      
      // 5. Navigate through admin sections
      await page.goto('/admin/settings');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/admin');
      
      // 6. Access system maintenance
      await page.goto('/sys/maintenance');
      await page.waitForLoadState('networkidle');
      // Should be accessible for admin
      const isAuthorized = page.url().includes('/sys/maintenance') || page.url().includes('/admin');
      expect(isAuthorized).toBeTruthy();
    });
  });

  test.describe('Session Persistence and Recovery', () => {
    test('should maintain session across browser refresh', async ({ page }) => {
      // Login
      await page.goto('/auth');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
      
      const originalUrl = page.url();
      
      // Refresh page
      await page.reload();
      await page.waitForLoadState('networkidle');
      
      // Should still be authenticated
      expect(page.url()).toContain('users');
      
      // Should be able to access other protected routes
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/admin');
    });

    test('should handle session timeout gracefully', async ({ page }) => {
      // Login first
      await page.goto('/auth');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
      
      // Simulate session expiry by clearing cookies
      await page.context().clearCookies();
      
      // Try to access protected route
      await page.goto('/users');
      
      // Should be redirected back to auth
      await page.waitForURL(/.*\/auth.*/, { timeout: 5000 });
      expect(page.url()).toContain('/auth');
      
      // Should be able to login again
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*\/users.*/, { timeout: 10000 });
      expect(page.url()).toContain('/users');
    });
  });

  test.describe('Error Handling and Recovery', () => {
    test('should handle network interruptions during login', async ({ page }) => {
      await page.goto('/auth');
      
      // Fill form
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      
      // Simulate network issues for some requests
      await page.route('**/auth/v1/token*', route => {
        // Let some requests through, fail others
        if (Math.random() > 0.7) {
          route.abort();
        } else {
          route.continue();
        }
      });
      
      // Attempt login
      await page.click('button:has-text("Sign In")');
      
      // Remove network simulation after a bit
      setTimeout(async () => {
        await page.unroute('**/auth/v1/token*');
      }, 2000);
      
      // Should eventually succeed or show proper error
      try {
        await page.waitForURL(/.*\/(users|admin).*/, { timeout: 15000 });
        expect(page.url()).toMatch(/\/(users|admin)/);
      } catch {
        // If login failed due to network, should show error
        const hasError = await page.locator('.v-alert--type-error').isVisible();
        expect(hasError).toBeTruthy();
      }
    });

    test('should handle rapid navigation attempts', async ({ page }) => {
      // Login first
      await page.goto('/auth');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
      
      // Rapidly navigate between pages
      const pages = ['/users', '/admin', '/projects', '/users', '/admin'];
      
      for (const pagePath of pages) {
        await page.goto(pagePath);
        // Don't wait for full load to simulate rapid navigation
        await page.waitForTimeout(200);
      }
      
      // Final page should load correctly
      await page.waitForLoadState('networkidle');
      expect(page.url()).toContain('/admin');
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    test('should work on different viewport sizes', async ({ page }) => {
      const viewports = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 768, height: 1024 },  // Tablet
        { width: 375, height: 667 }    // Mobile
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        
        // Test login flow
        await page.goto('/auth');
        
        // Form should be visible and functional
        await expect(page.locator('input[type="email"]')).toBeVisible();
        await expect(page.locator('input[type="password"]')).toBeVisible();
        await expect(page.locator('button:has-text("Sign In")')).toBeVisible();
        
        // Test login
        await page.fill('input[type="email"]', testUser.email);
        await page.fill('input[type="password"]', testUser.password);
        await page.click('button:has-text("Sign In")');
        
        await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
        expect(page.url()).toMatch(/\/(users|admin)/);
        
        // Test navigation on this viewport
        await page.goto('/admin');
        await page.waitForLoadState('networkidle');
        expect(page.url()).toContain('/admin');
        
        // Clear session for next iteration
        await page.context().clearCookies();
      }
    });
  });

  test.describe('Performance and Load', () => {
    test('should handle multiple rapid logins', async ({ page }) => {
      for (let i = 0; i < 3; i++) {
        // Clear session
        await page.context().clearCookies();
        
        // Login
        await page.goto('/auth');
        await page.fill('input[type="email"]', testUser.email);
        await page.fill('input[type="password"]', testUser.password);
        await page.click('button:has-text("Sign In")');
        
        // Should succeed each time
        await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
        expect(page.url()).toMatch(/\/(users|admin)/);
        
        // Brief delay between attempts
        await page.waitForTimeout(500);
      }
    });

    test('should load pages within reasonable time', async ({ page }) => {
      // Login
      await page.goto('/auth');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      
      const startTime = Date.now();
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
      const loginTime = Date.now() - startTime;
      
      // Login should complete within reasonable time
      expect(loginTime).toBeLessThan(8000); // 8 seconds max
      
      // Test page navigation speed
      const navStart = Date.now();
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');
      const navTime = Date.now() - navStart;
      
      // Navigation should be fast
      expect(navTime).toBeLessThan(5000); // 5 seconds max
    });
  });
});
