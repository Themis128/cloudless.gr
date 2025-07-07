import { test, expect } from '@playwright/test';

test.describe('Redirect Flow Integration Tests', () => {
  const testUser = {
    email: 'baltzakis.themis@gmail.com',
    password: 'TH!123789th!'
  };

  test.beforeEach(async ({ page }) => {
    // Clear auth state before each test
    await page.context().clearCookies();
    await page.context().clearPermissions();
  });

  test.describe('Direct URL Access with Redirects', () => {
    test('should redirect from /users to auth and back to /users after login', async ({ page }) => {
      // 1. Try to access protected route directly
      await page.goto('/users');
      
      // 2. Should be redirected to auth with redirect parameter
      await page.waitForURL(/.*\/auth.*/, { timeout: 5000 });
      expect(page.url()).toContain('/auth');
      expect(page.url()).toContain('redirect');
      
      // 3. Verify the redirect parameter points to users
      const url = new URL(page.url());
      const redirectParam = url.searchParams.get('redirect');
      expect(redirectParam).toBe('/users');
      
      // 4. Login
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // 5. Should be redirected back to /users
      await page.waitForURL(/.*\/users.*/, { timeout: 10000 });
      expect(page.url()).toContain('/users');
      
      // 6. Verify we're on the actual users page content
      await expect(page.locator('text=Welcome')).toBeVisible({ timeout: 5000 });
    });

    test('should redirect from /admin to auth and back to /admin after login', async ({ page }) => {
      // 1. Try to access admin directly
      await page.goto('/admin');
      
      // 2. Should be redirected to auth
      await page.waitForURL(/.*\/auth.*/, { timeout: 5000 });
      expect(page.url()).toContain('/auth');
      
      // 3. Login
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // 4. Should be redirected to admin
      await page.waitForURL(/.*\/admin.*/, { timeout: 10000 });
      expect(page.url()).toContain('/admin');
    });

    test('should redirect from /projects to auth and back to /projects after login', async ({ page }) => {
      // 1. Try to access projects directly
      await page.goto('/projects');
      
      // 2. Should be redirected to auth
      await page.waitForURL(/.*\/auth.*/, { timeout: 5000 });
      expect(page.url()).toContain('/auth');
      
      // 3. Login
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // 4. Should be redirected to projects
      await page.waitForURL(/.*\/projects.*/, { timeout: 10000 });
      expect(page.url()).toContain('/projects');
    });

    test('should handle nested routes like /users/profile', async ({ page }) => {
      // 1. Try to access nested route
      await page.goto('/users/profile');
      
      // 2. Should be redirected to auth
      await page.waitForURL(/.*\/auth.*/, { timeout: 5000 });
      expect(page.url()).toContain('/auth');
      
      // 3. Login
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // 4. Should be redirected (might go to /users or /users/profile depending on routing)
      await page.waitForURL(/.*\/users.*/, { timeout: 10000 });
      expect(page.url()).toContain('/users');
    });

    test('should handle nested admin routes like /admin/users', async ({ page }) => {
      // 1. Try to access nested admin route
      await page.goto('/admin/users');
      
      // 2. Should be redirected to auth
      await page.waitForURL(/.*\/auth.*/, { timeout: 5000 });
      expect(page.url()).toContain('/auth');
      
      // 3. Login
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // 4. Should be redirected to admin area
      await page.waitForURL(/.*\/admin.*/, { timeout: 10000 });
      expect(page.url()).toContain('/admin');
    });
  });

  test.describe('Manual Redirect Parameter Testing', () => {
    test('should handle explicit redirect to /users', async ({ page }) => {
      await page.goto('/auth?redirect=/users');
      
      // Verify redirect parameter is preserved
      expect(page.url()).toContain('redirect=/users');
      
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      await page.waitForURL(/.*\/users.*/, { timeout: 10000 });
      expect(page.url()).toContain('/users');
    });

    test('should handle explicit redirect to /admin', async ({ page }) => {
      await page.goto('/auth?redirect=/admin');
      
      expect(page.url()).toContain('redirect=/admin');
      
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      await page.waitForURL(/.*\/admin.*/, { timeout: 10000 });
      expect(page.url()).toContain('/admin');
    });

    test('should handle explicit redirect to /projects', async ({ page }) => {
      await page.goto('/auth?redirect=/projects');
      
      expect(page.url()).toContain('redirect=/projects');
      
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      await page.waitForURL(/.*\/projects.*/, { timeout: 10000 });
      expect(page.url()).toContain('/projects');
    });

    test('should handle encoded redirect parameters', async ({ page }) => {
      // URL-encoded version of /users/profile
      await page.goto('/auth?redirect=%2Fusers%2Fprofile');
      
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      await page.waitForURL(/.*\/users.*/, { timeout: 10000 });
      expect(page.url()).toContain('/users');
    });
  });

  test.describe('Default Redirect Behavior', () => {
    test('should redirect to /users by default when no redirect parameter', async ({ page }) => {
      await page.goto('/auth');
      
      // No redirect parameter
      expect(page.url()).not.toContain('redirect');
      
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // Should go to default destination (/users)
      await page.waitForURL(/.*\/users.*/, { timeout: 10000 });
      expect(page.url()).toContain('/users');
    });

    test('should handle invalid redirect parameters gracefully', async ({ page }) => {
      // Invalid redirect parameter
      await page.goto('/auth?redirect=invalid-path');
      
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // Should fallback to default (/users) or handle gracefully
      await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
      const isValidRedirect = page.url().includes('/users') || page.url().includes('/admin');
      expect(isValidRedirect).toBeTruthy();
    });

    test('should handle external redirect attempts securely', async ({ page }) => {
      // Attempt to redirect to external URL (should be blocked)
      await page.goto('/auth?redirect=https://example.com');
      
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // Should not redirect to external URL, should go to safe internal route
      await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
      expect(page.url()).not.toContain('example.com');
      expect(page.url()).toContain('192.168.0.23:3000');
    });
  });

  test.describe('Error Cases and Edge Cases', () => {
    test('should handle multiple redirect parameters', async ({ page }) => {
      await page.goto('/auth?redirect=/users&redirect=/admin');
      
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // Should handle gracefully and redirect to one of the valid routes
      await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
      const isValidRedirect = page.url().includes('/users') || page.url().includes('/admin');
      expect(isValidRedirect).toBeTruthy();
    });

    test('should handle malformed redirect parameters', async ({ page }) => {
      await page.goto('/auth?redirect=malformed%url');
      
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // Should fallback to default behavior
      await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
      expect(page.url()).toMatch(/\/(users|admin)/);
    });

    test('should handle very long redirect parameters', async ({ page }) => {
      const longPath = '/users/' + 'a'.repeat(1000);
      await page.goto(`/auth?redirect=${encodeURIComponent(longPath)}`);
      
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      
      // Should handle gracefully
      await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
      expect(page.url()).toMatch(/\/(users|admin)/);
    });
  });

  test.describe('Authenticated User Redirect Behavior', () => {
    test('should redirect authenticated users away from auth page to default route', async ({ page }) => {
      // First login
      await page.goto('/auth');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
      
      // Now try to go back to auth page
      await page.goto('/auth');
      
      // Should be redirected to users page
      await page.waitForURL(/.*\/users.*/, { timeout: 5000 });
      expect(page.url()).toContain('/users');
    });

    test('should ignore redirect parameter for already authenticated users', async ({ page }) => {
      // First login
      await page.goto('/auth');
      await page.fill('input[type="email"]', testUser.email);
      await page.fill('input[type="password"]', testUser.password);
      await page.click('button:has-text("Sign In")');
      await page.waitForURL(/.*\/(users|admin).*/, { timeout: 10000 });
      
      // Try to access auth with redirect parameter
      await page.goto('/auth?redirect=/admin');
      
      // Should be redirected to default (users) not the redirect parameter
      await page.waitForURL(/.*\/users.*/, { timeout: 5000 });
      expect(page.url()).toContain('/users');
    });
  });
});
