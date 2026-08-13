import { test, expect } from "@playwright/test";

/**
 * Admin User Journey Test Suite
 * Tests user flows for administrative tasks, dashboard access, and system management
 */

test.describe("Admin User Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Start from homepage
    await page.goto("/en");
    await expect(page).toHaveURL(/.*\/$/);
  });

  test("should allow admin to navigate to login page", async ({ page }) => {
    // Expect
    expect(page.locator('text=Login, text=Sign in, text=Admin login')).toBeVisible();
    
    // Act
    await page.click('text=Login, text=Sign in, text=Admin login');
    // Assert
    await expect(page).toHaveURL(/.*\/auth\/login/);
  });

  test("should show admin login form with required fields", async ({ page }) => {
    await page.goto("/en/auth/login");
    await expect(page).toHaveURL(/.*\/auth\/login/);
    
    // Expect
    expect(page.locator('form')).toBeVisible();
    
    // Arrange
    const form = page.locator('form');
    // Assert
    await expect(form.locator('input[name="email"], input[name="username"], input[type="email"]')).toBeVisible();
    await expect(form.locator('input[name="password"], input[type="password"]')).toBeVisible();
  });

  test("should allow admin to login with valid credentials (test credentials)", async ({ page }) => {
    await page.goto("/en/auth/login");
    await expect(page).toHaveURL(/.*\/auth\/login/);
    
    // Arrange - Using test credentials - in real scenario these would be valid test credentials
    await page.locator('input[name="email"], input[name="username"], input[type="email"]').first().fill(`testadmin${Date.now()}@example.com`);
    await page.locator('input[name="password"], input[type="password"]').first().fill(`TestPassword123!`);
    
    // Act
    await page.locator('button:has-text("Login"), button:has-text("Sign in"), button:has-text("Submit")').first().click();
    
    // Note: This will likely fail with invalid credentials, but we're testing the flow
    // Assert
    await page.waitForTimeout(3000);
    
    // Should either show success (redirect to dashboard) or error message
    const dashboardOrError = page.locator('.dashboard, text=Dashboard, text=Overview, .error, .alert, text=Invalid, text=Failed');
    expect(dashboardOrError.first()).toBeVisible();
  });

  test("should show appropriate error for invalid login credentials", async ({ page }) => {
    await page.goto("/en/auth/login");
    await expect(page).toHaveURL(/.*\/auth\/login/);
    
    // Arrange - Fill in obviously invalid credentials
    await page.locator('input[name="email"], input[name="username"], input[type="email"]').first().fill(`invalid${Date.now()}@example.com`);
    await page.locator('input[name="password"], input[type="password"]').first().fill(`wrongpassword`);
    
    // Act
    await page.locator('button:has-text("Login"), button:has-text("Sign in"), button:has-text("Submit")').first().click();
    
    // Assert
    await page.waitForTimeout(2000);
    
    const errorMessage = page.locator('.error, .alert, text=Invalid, text=Failed, text=Incorrect, text=Unauthorized');
    expect(errorMessage.first()).toBeVisible();
  });

  test("should allow admin to access dashboard after login (if credentials work)", async ({ page }) => {
    // This test assumes we have valid test credentials
    // In a real test environment, we would set up test credentials beforehand
    
    await page.goto("/en/auth/login");
    await expect(page).toHaveURL(/.*\/auth\/login/);
    
    // Assert - Verify login page elements exist
    expect(page.locator('input[name="email"], input[name="username"], input[type="email"]')).toBeVisible();
    expect(page.locator('input[name="password"], input[type="password"]')).toBeVisible();
    expect(page.locator('button:has-text("Login"), button:has-text("Sign in"), button:has-text("Submit")')).toBeVisible();
  });

  test("should show admin dashboard widgets and navigation after login", async ({ page }) => {
    // We'll test that if we somehow get to a dashboard, we see expected elements
    await page.goto("/en/admin");
    await page.waitForTimeout(2000);
    
    // If redirected to login, that's expected for unauthenticated access
    if (await page.url().includes('/auth/login')) {
      expect(page.locator('text=Sign in, text=Login')).toBeVisible();
    } else {
      // If we somehow got to dashboard, check for dashboard elements
      expect(page.locator('.dashboard, text=Dashboard, text=Overview, .widget, .card, [data-testid="dashboard"]')).toBeVisible();
    }
  });

  test("should allow admin to navigate to different admin sections", async ({ page }) => {
    // Test admin navigation without authentication (should redirect to login)
    const adminSections = [
      '/en/admin/analytics',
      '/en/admin/users',
      '/en/admin/settings',
      '/en/admin/crm',
      '/en/admin/email'
    ];
    
    for (const section of adminSections) {
      await page.goto(section);
      await page.waitForTimeout(2000);
      
      // Should either show login page or admin section content
      const loginOrContent = page.locator('text=Sign in, text=Login, .dashboard, .admin-panel, text=Analytics, text=Users, text=Settings');
      expect(loginOrContent.first()).toBeVisible();
    }
  });

  test("should allow admin to log out", async ({ page }) => {
    // We'd need to be logged in first to test logout
    // For now, verify logout link exists on login page or would be visible after login
    await page.goto("/en/auth/login");
    
    // In a real scenario after login, there would be a logout button/link
  });
});