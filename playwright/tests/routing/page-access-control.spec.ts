import { expect, test } from '@playwright/test';

test.describe('Page Access Control & Routing Tests', () => {
  const testUsers = {
    admin: {
      email: 'testadmin2@cloudless.gr',
      password: 'TestAdmin123!'
    },
    regular: {
      email: 'test@example.com',
      password: 'TestPassword123!'
    }
  };

  // Helper function to login as different user types
  async function loginAs(page: any, userType: 'admin' | 'regular') {
    const user = testUsers[userType];
    console.log(`🔐 Logging in as ${userType}: ${user.email}`);
    
    await page.goto('/auth');
    await page.fill('[data-testid="email-input"]', user.email);
    await page.fill('[data-testid="password-input"]', user.password);
    await page.click('[data-testid="login-button"]');
    await page.waitForLoadState('networkidle');
    
    console.log(`✅ Successfully logged in as ${userType}`);
  }

  test.beforeEach(async ({ page }) => {
    console.log(`🧪 Starting test: ${test.info().title}`);
    console.log(`📍 Environment: ${process.env.TEST_ENVIRONMENT || 'local'}`);
    console.log(`🌐 Base URL: ${process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000'}`);
  });

  test.describe('Public Pages Access', () => {
    const publicPages = [
      { path: '/', name: 'Home' },
      { path: '/info', name: 'Info' },
      { path: '/info/about', name: 'About' },
      { path: '/info/contact', name: 'Contact' },
      { path: '/info/faq', name: 'FAQ' },
      { path: '/info/matrix', name: 'Matrix' },
      { path: '/info/sitemap', name: 'Sitemap' },
      { path: '/auth', name: 'Login' },
      { path: '/auth/register', name: 'Register' },
      { path: '/auth/reset', name: 'Password Reset' },
      { path: '/auth', name: 'Login' },
      { path: '/documentation', name: 'Documentation' },
      { path: '/documentation/getting-started', name: 'Getting Started' },
      { path: '/documentation/api-reference', name: 'API Reference' },
      { path: '/documentation/user-guide', name: 'User Guide' },
      { path: '/documentation/faq', name: 'Documentation FAQ' },
      { path: '/documentation/troubleshooting', name: 'Troubleshooting' },
      { path: '/documentation/roadmap', name: 'Roadmap' }
    ];

    for (const page of publicPages) {
      test(`should allow unauthenticated access to ${page.name} (${page.path})`, async ({ page: playwright }) => {
        console.log(`🌐 Testing public access to: ${page.path} (${page.name})`);
        
        await playwright.goto(page.path);
        console.log(`📍 Navigated to: ${page.path}`);
        
        await playwright.waitForLoadState('networkidle');
        console.log('⏳ Page load completed');
        
        // Verify we're not redirected to auth
        const currentUrl = playwright.url();
        console.log(`🔍 Current URL: ${currentUrl}`);
        
        expect(currentUrl).not.toContain('/auth');
        console.log(`✅ Public page accessible: ${page.name}`);
        
        // Should load successfully without redirect to auth
        await expect(playwright).toHaveURL(new RegExp(page.path.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
        
        // Should not show auth errors
        await expect(playwright.locator('.v-alert--type-error')).not.toBeVisible();
        
        // Page should have content (not be completely empty)
        const body = playwright.locator('body');
        await expect(body).not.toBeEmpty();
      });
    }

    test('should provide consistent navigation on public pages', async ({ page }) => {
      await page.goto('/');
      
      // Check main navigation exists
      const nav = page.locator('nav, .nav, [role="navigation"]').first();
      await expect(nav).toBeVisible();
      
      // Test navigation to key public pages
      await page.goto('/info');
      await expect(page).toHaveURL(/.*\/info.*/);
      
      await page.goto('/documentation');
      await expect(page).toHaveURL(/.*\/documentation.*/);
    });
  });

  test.describe('Protected Pages Access', () => {
    const protectedPages = [
      { path: '/projects', name: 'Projects', requiresAuth: true, requiresAdmin: false },
      { path: '/users', name: 'Users', requiresAuth: true, requiresAdmin: false },
      { path: '/settings', name: 'Settings', requiresAuth: true, requiresAdmin: false },
      { path: '/storage', name: 'Storage', requiresAuth: true, requiresAdmin: false }
    ];

    for (const protectedPage of protectedPages) {
      test(`should redirect unauthenticated users from ${protectedPage.name} to auth`, async ({ page }) => {
        await page.goto(protectedPage.path);
        
        // Should be redirected to auth page
        await expect(page).toHaveURL(/.*\/auth.*/);
      });

      test(`should allow authenticated users to access ${protectedPage.name}`, async ({ page }) => {
        // Login as regular user
        await loginAs(page, 'regular');
        
        // Navigate to protected page
        await page.goto(protectedPage.path);
        
        // Should be able to access the page
        if (!protectedPage.requiresAdmin) {
          await expect(page).toHaveURL(new RegExp(protectedPage.path.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
        }
      });
    }
  });

  test.describe('Admin Pages Access', () => {
    const adminPages = [
      { path: '/admin', name: 'Admin Dashboard' },
      { path: '/admin/users', name: 'Admin Users' },
      { path: '/admin/settings', name: 'Admin Settings' },
      { path: '/sys/maintenance', name: 'System Maintenance' }
    ];    for (const adminPage of adminPages) {
      test(`should redirect unauthenticated users from ${adminPage.name} to auth`, async ({ page }) => {
        await page.goto(adminPage.path);
        
        // Should be redirected to auth
        await expect(page).toHaveURL(/.*\/auth.*/);
      });

      test(`should redirect regular users from ${adminPage.name} to auth`, async ({ page }) => {
        // Login as regular user
        await loginAs(page, 'regular');
        
        await page.goto(adminPage.path);
        
        // Should be redirected to auth with error
        await expect(page).toHaveURL(/.*\/auth.*error=unauthorized.*/);
      });

      test(`should allow admin users to access ${adminPage.name}`, async ({ page }) => {
        // Login as admin
        await loginAs(page, 'admin');
        
        await page.goto(adminPage.path);
        
        // Should be able to access admin page
        await expect(page).toHaveURL(new RegExp(adminPage.path.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
      });
    }
  });

  test.describe('Routing & Redirects', () => {
    test('should redirect logged-in users from auth pages appropriately', async ({ page }) => {
      // Login as admin
      await loginAs(page, 'admin');
      
      // Try to go to login page while logged in
      await page.goto('/auth');
      
      // Should redirect away from auth (to appropriate dashboard)
      await page.waitForLoadState('networkidle');
      const currentUrl = page.url();
      expect(currentUrl).not.toMatch(/.*\/auth$/);
    });

    test('should handle invalid routes gracefully', async ({ page }) => {
      await page.goto('/non-existent-page');
      
      // Should show 404 or redirect to home
      const is404 = await page.locator('text=/404|not found/i').isVisible();
      const isHome = page.url().endsWith('/');
      
      expect(is404 || isHome).toBe(true);
    });

    test('should preserve intended destination after login', async ({ page }) => {
      // Try to access protected page while not logged in
      await page.goto('/projects');
      
      // Should redirect to auth
      await expect(page).toHaveURL(/.*\/auth.*/);
      
      // Login
      await page.fill('[data-testid="email-input"]', testUsers.admin.email);
      await page.fill('[data-testid="password-input"]', testUsers.admin.password);
      await page.click('[data-testid="login-button"]');
      
      // Should eventually end up on intended page or appropriate dashboard
      await page.waitForLoadState('networkidle');
      const finalUrl = page.url();
      expect(finalUrl).toMatch(/.*\/(projects|admin|users).*/);
    });

    test('should handle deep linking correctly', async ({ page }) => {
      const deepLinks = [
        '/info/about',
        '/documentation/getting-started',
        '/documentation/api-reference'
      ];

      for (const link of deepLinks) {
        await page.goto(link);
        await expect(page).toHaveURL(new RegExp(link.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')));
      }
    });
  });

  test.describe('Navigation Consistency', () => {
    test('should maintain consistent navigation across user states', async ({ page }) => {
      // Test navigation as unauthenticated user
      await page.goto('/');
      
      // Check for auth-related navigation
      const loginLink = page.locator('text=/login|sign in/i').first();
      await expect(loginLink).toBeVisible();
      
      // Login and check navigation changes
      await loginAs(page, 'admin');
      await page.goto('/');
      
      // Should show authenticated navigation
      const logoutLink = page.locator('text=/logout|sign out/i').first();
      await expect(logoutLink).toBeVisible();
    });

    test('should show appropriate navigation for different user roles', async ({ page }) => {
      // Test admin navigation
      await loginAs(page, 'admin');
      await page.goto('/');
      
      // Admin should see admin links
      const adminLink = page.locator('text=/admin/i').first();
      await expect(adminLink).toBeVisible();
      
      // Logout and login as regular user
      await page.locator('text=/logout/i').first().click();
      await loginAs(page, 'regular');
      await page.goto('/');
      
      // Regular user should not see admin links
      const adminLinkAfter = page.locator('text=/admin/i').first();
      await expect(adminLinkAfter).not.toBeVisible();
    });
  });

  test.describe('Security & Access Control', () => {
    test('should prevent unauthorized API access', async ({ page }) => {
      // Try to access admin API endpoints directly
      const adminApiEndpoints = [
        '/api/system/auth',
        '/api/system/create-admin'
      ];

      for (const endpoint of adminApiEndpoints) {
        const response = await page.request.post(`http://localhost:3000${endpoint}`, {
          data: { test: 'unauthorized' }
        });
        
        // Should return unauthorized or bad request
        expect([400, 401, 403, 422]).toContain(response.status());
      }
    });

    test('should validate session integrity', async ({ page }) => {
      // Login
      await loginAs(page, 'admin');
      
      // Access admin page
      await page.goto('/admin');
      await expect(page).toHaveURL(/.*\/admin.*/);
      
      // Clear cookies/session (simulate session expiry)
      await page.context().clearCookies();
      
      // Try to access admin page again
      await page.goto('/admin');
      
      // Should be redirected to login
      await expect(page).toHaveURL(/.*\/auth.*/);
    });
  });
});
