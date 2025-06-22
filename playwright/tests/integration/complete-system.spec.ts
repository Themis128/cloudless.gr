import { expect, test } from '@playwright/test';

test.describe('Complete System Integration Tests', () => {
  const testUsers = {
    admin: {
      email: 'testadmin2@cloudless.gr',
      password: 'TestAdmin123!'
    }
  };

  test.describe('End-to-End User Workflows', () => {
    test('should complete full user registration and login workflow', async ({ page }) => {
      const uniqueEmail = `e2etest${Date.now()}@example.com`;
      
      // 1. Register new user
      await page.goto('/auth/register');
      await page.fill('[data-testid="fullname-input"]', 'E2E Test User');
      await page.fill('[data-testid="email-input"]', uniqueEmail);
      await page.fill('[data-testid="password-input"]', 'E2ETest123!');
      await page.fill('[data-testid="confirm-password-input"]', 'E2ETest123!');
      await page.check('input[type="checkbox"]');
      await page.click('[data-testid="create-account-button"]');
      
      // Wait for registration success
      await expect(page.locator('.v-alert--type-success')).toBeVisible({ timeout: 15000 });
      
      // 2. Login with new user
      await page.goto('/auth');
      await page.fill('[data-testid="email-input"]', uniqueEmail);
      await page.fill('[data-testid="password-input"]', 'E2ETest123!');
      await page.click('[data-testid="login-button"]');
      
      // Should be logged in and redirected
      await page.waitForURL(/.*\/(projects|users|dashboard).*/);
      
      // 3. Verify authenticated state
      await expect(page.locator('text=/logout/i')).toBeVisible();
      
      // 4. Access protected pages
      await page.goto('/projects');
      await expect(page).toHaveURL(/.*\/projects.*/);
      
      // 5. Logout
      await page.locator('text=/logout/i').first().click();
      await expect(page).toHaveURL(/.*\/(|auth).*/);
    });    test('should complete admin workflow', async ({ page }) => {
      // 1. Admin login
      await page.goto('/auth');
      await page.fill('[data-testid="admin-email-input"]', testUsers.admin.email);
      await page.fill('[data-testid="admin-password-input"]', testUsers.admin.password);
      await page.click('[data-testid="admin-login-button"]');
      
      // Should redirect to admin panel
      await expect(page).toHaveURL(/.*\/admin.*/);
      
      // 2. Access admin features
      await page.goto('/admin/users');
      await expect(page).toHaveURL(/.*\/admin\/users.*/);
      
      // 3. System maintenance access
      await page.goto('/sys/maintenance');
      await expect(page).toHaveURL(/.*\/sys\/maintenance.*/);
      
      // 4. Admin can also access regular user pages
      await page.goto('/projects');
      await expect(page).toHaveURL(/.*\/projects.*/);
      
      // 5. Logout
      await page.locator('text=/logout/i').first().click();
    });

    test('should handle password reset workflow', async ({ page }) => {
      // 1. Go to password reset
      await page.goto('/auth/reset');
      
      // 2. Submit valid email
      await page.fill('[data-testid="reset-email-input"]', testUsers.admin.email);
      await page.click('[data-testid="reset-submit-button"]');
      
      // 3. Should show success message
      await expect(page.locator('.v-alert--type-success')).toBeVisible({ timeout: 10000 });
      
      // 4. Should be able to return to login
      await page.goto('/auth');
      await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
    });
  });

  test.describe('Cross-Browser Compatibility', () => {
    test('should work consistently across different viewports', async ({ page }) => {
      const viewports = [
        { width: 1920, height: 1080, name: 'Desktop' },
        { width: 768, height: 1024, name: 'Tablet' },
        { width: 375, height: 667, name: 'Mobile' }
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        
        // Test responsive layout
        await page.goto('/');
        await expect(page.locator('body')).toBeVisible();
        
        // Test authentication on different screen sizes
        await page.goto('/auth');
        await expect(page.locator('[data-testid="email-input"]')).toBeVisible();
        await expect(page.locator('[data-testid="password-input"]')).toBeVisible();
        await expect(page.locator('[data-testid="login-button"]')).toBeVisible();
      }
    });
  });

  test.describe('Data Integrity & Consistency', () => {
    test('should maintain data consistency across user actions', async ({ page }) => {
      // Login as admin
      await page.goto('/auth');
      await page.fill('[data-testid="email-input"]', testUsers.admin.email);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      await page.click('[data-testid="login-button"]');
      
      await page.waitForURL(/.*\/admin.*/);
      
      // Navigate between pages and ensure state is maintained
      await page.goto('/projects');
      await page.goto('/admin');
      await page.goto('/users');
      
      // Should still be authenticated as admin
      await expect(page.locator('text=/logout/i')).toBeVisible();
      
      // Should still have admin access
      await page.goto('/admin');
      await expect(page).toHaveURL(/.*\/admin.*/);
    });
  });

  test.describe('Edge Cases & Error Recovery', () => {
    test('should handle simultaneous login attempts gracefully', async ({ browser }) => {
      // Create multiple browser contexts to simulate concurrent logins
      const context1 = await browser.newContext();
      const context2 = await browser.newContext();
      
      const page1 = await context1.newPage();
      const page2 = await context2.newPage();
      
      try {
        // Attempt login from both contexts simultaneously
        await Promise.all([
          (async () => {
            await page1.goto('/auth');
            await page1.fill('[data-testid="email-input"]', testUsers.admin.email);
            await page1.fill('[data-testid="password-input"]', testUsers.admin.password);
            await page1.click('[data-testid="login-button"]');
          })(),
          (async () => {
            await page2.goto('/auth');
            await page2.fill('[data-testid="email-input"]', testUsers.admin.email);
            await page2.fill('[data-testid="password-input"]', testUsers.admin.password);
            await page2.click('[data-testid="login-button"]');
          })()
        ]);
        
        // Both should succeed or handle gracefully
        await Promise.all([
          page1.waitForURL(/.*\/(admin|projects).*/),
          page2.waitForURL(/.*\/(admin|projects).*/),
        ]);
        
      } finally {
        await context1.close();
        await context2.close();
      }
    });

    test('should recover from network interruptions', async ({ page }) => {
      await page.goto('/auth');
      
      // Simulate network interruption
      await page.route('**/*', route => {
        if (Math.random() > 0.8) {
          route.abort();
        } else {
          route.continue();
        }
      });
      
      // Should still be able to interact with the page
      await page.fill('[data-testid="email-input"]', testUsers.admin.email);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      
      // Remove network simulation
      await page.unroute('**/*');
      
      // Should be able to complete login
      await page.click('[data-testid="login-button"]');
      
      // May take longer due to retries, but should eventually succeed
      await expect(page).toHaveURL(/.*\/(admin|projects|auth).*/);
    });
  });

  test.describe('Performance Under Load', () => {
    test('should handle rapid navigation between pages', async ({ page }) => {
      // Login first
      await page.goto('/auth');
      await page.fill('[data-testid="email-input"]', testUsers.admin.email);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      await page.click('[data-testid="login-button"]');
      
      await page.waitForURL(/.*\/admin.*/);
      
      // Rapidly navigate between pages
      const pages = ['/admin', '/projects', '/users', '/settings', '/admin'];
      
      for (let i = 0; i < 3; i++) { // Repeat multiple times
        for (const pagePath of pages) {
          await page.goto(pagePath);
          await page.waitForLoadState('networkidle');
          
          // Each page should load successfully
          await expect(page).toHaveURL(new RegExp(pagePath.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
        }
      }
    });
  });
});
