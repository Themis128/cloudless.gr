import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage, createAuthenticatedPage } from "../helpers/page-helpers";

/**
 * Authentication Journey Test Suite
 * Tests the complete authentication flow: login, registration, password reset, etc.
 */

test.describe("Authentication Journey", () => {
  let page: BasePage;
  let responsivePage: ResponsivePage;
  let authPage: AuthenticatedPage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = createBasePage(browserPage);
    responsivePage = createResponsivePage(browserPage);
    authPage = createAuthenticatedPage(browserPage);
  });

  test.describe("Login Flow", () => {
    test("should allow user to login with valid credentials", async ({ page: browserPage }) => {
      // Start from homepage
      await page.navigate("/en");
      
      // Navigate to login page
      const loginLink = browserPage.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      
      await loginLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      
      // Fill in login form
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const passwordInput = browserPage.locator('input[name*="password" i], [data-testid="password-input"], input[type="password"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      // Use test credentials
      await emailInput.fill("test@example.com");
      await passwordInput.fill("password123");
      
      // Submit form
      await submitButton.click();
      
      // Should redirect to homepage or dashboard
      await expect(browserPage).toHaveURL(/\/($|\?#)/, { timeout: 10000 });
      // Or to dashboard if that's the default after login
      // await expect(browserPage).toHaveURL(/\/dashboard/, { timeout: 10000 });
      
      // Check for successful login indicator
      const userIndicator = browserPage.locator('.user-info, [data-testid="user-info"], text=/hello, test/i, .avatar');
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
    });
    
    test("should show error for invalid login credentials", async ({ page: browserPage }) => {
      // Start from homepage
      await page.navigate("/en");
      
      // Navigate to login page
      const loginLink = browserPage.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      
      await loginLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      
      // Fill in login form with invalid credentials
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const passwordInput = browserPage.locator('input[name*="password" i], [data-testid="password-input"], input[type="password"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      await emailInput.fill("invalid@example.com");
      await passwordInput.fill("wrongpassword");
      
      // Submit form
      await submitButton.click();
      
      // Should show error message
      const errorMessage = browserPage.locator('text=/invalid/i, text=/incorrect/i, text=/failed/i, [data-testid="error-message"], .error-message');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
      
      // Should still be on login page
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
    });
    
    test("should show validation errors for empty login fields", async ({ page: browserPage }) => {
      // Start from homepage
      await page.navigate("/en");
      
      // Navigate to login page
      const loginLink = browserPage.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      
      await loginLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      
      // Try to submit empty form
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      await expect(submitButton).toBeVisible();
      
      await submitButton.click();
      
      // Should show validation errors
      const emailError = browserPage.locator('text=/email is required/i, [data-testid="email-error"], .error-message');
      const passwordError = browserPage.locator('text=/password is required/i, [data-testid="password-error"], .error-message');
      
      expect(await emailError.isVisible() || await passwordError.isVisible()).toBeTruthy();
    });
  });

  test.describe("Registration Flow", () => {
    test("should allow user to register with valid information", async ({ page: browserPage }) => {
      // Start from homepage
      await page.navigate("/en");
      
      // Navigate to registration page
      const registerLink = browserPage.locator('a[href*="/auth/register"], a[href*="/signup"], .register-link, [data-testid="register-link"], a:has-text("Sign Up")');
      await expect(registerLink).toBeVisible({ timeout: 5000 });
      
      await registerLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/register|\/register|\/signup/, { timeout: 5000 });
      
      // Fill in registration form
      const nameInput = browserPage.locator('input[name*="name" i], [data-testid="name-input"]');
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const passwordInput = browserPage.locator('input[name*="password" i], [data-testid="password-input"], input[type="password"]');
      const confirmPasswordInput = browserPage.locator('input[name*="confirm" i], [data-testid="confirm-password-input"], input[name*="password_confirm"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(nameInput).toBeVisible();
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(confirmPasswordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      // Use test registration data
      await nameInput.fill("Test User");
      await emailInput.fill("newuser@example.com");
      await passwordInput.fill("securepassword123");
      await confirmPasswordInput.fill("securepassword123");
      
      // Submit form
      await submitButton.click();
      
      // Should redirect to homepage or show success message
      await expect(browserPage).toHaveURL(/\/($|\?#)/, { timeout: 10000 });
      // Or show success message on same page
      const successMessage = browserPage.locator('text=/account created/i, text=/welcome/i, text=/success/i, [data-testid="success-message"], .success-message');
      await expect(successMessage).toBeVisible({ timeout: 5000 });
      
      // Check for successful registration indicator
      const userIndicator = browserPage.locator('.user-info, [data-testid="user-info"], text=/hello, test/i, .avatar');
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
    });
    
    test("should show error for duplicate email registration", async ({ page: browserPage }) => {
      // Start from homepage
      await page.navigate("/en");
      
      // Navigate to registration page
      const registerLink = browserPage.locator('a[href*="/auth/register"], a[href*="/signup"], .register-link, [data-testid="register-link"], a:has-text("Sign Up")');
      await expect(registerLink).toBeVisible({ timeout: 5000 });
      
      await registerLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/register|\/register|\/signup/, { timeout: 5000 });
      
      // Fill in registration form with existing email
      const nameInput = browserPage.locator('input[name*="name" i], [data-testid="name-input"]');
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const passwordInput = browserPage.locator('input[name*="password" i], [data-testid="password-input"], input[type="password"]');
      const confirmPasswordInput = browserPage.locator('input[name*="confirm" i], [data-testid="confirm-password-input"], input[name*="password_confirm"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(nameInput).toBeVisible();
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(confirmPasswordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      await nameInput.fill("Test User");
      await emailInput.fill("test@example.com"); // Assuming this already exists
      await passwordInput.fill("securepassword123");
      await confirmPasswordInput.fill("securepassword123");
      
      // Submit form
      await submitButton.click();
      
      // Should show error message
      const errorMessage = browserPage.locator('text=/already exists/i, text=/taken/i, text=/duplicate/i, [data-testid="error-message"], .error-message');
      await expect(errorMessage).toBeVisible({ timeout: 5000 });
      
      // Should still be on registration page
      await expect(browserPage).toHaveURL(/\/auth\/register|\/register|\/signup/, { timeout: 5000 });
    });
    
    test("should show validation errors for empty registration fields", async ({ page: browserPage }) => {
      // Start from homepage
      await page.navigate("/en");
      
      // Navigate to registration page
      const registerLink = browserPage.locator('a[href*="/auth/register"], a[href*="/signup"], .register-link, [data-testid="register-link"], a:has-text("Sign Up")');
      await expect(registerLink).toBeVisible({ timeout: 5000 });
      
      await registerLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/register|\/register|\/signup/, { timeout: 5000 });
      
      // Try to submit empty form
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      await expect(submitButton).toBeVisible();
      
      await submitButton.click();
      
      // Should show validation errors
      const nameError = browserPage.locator('text=/name is required/i, [data-testid="name-error"], .error-message');
      const emailError = browserPage.locator('text=/email is required/i, [data-testid="email-error"], .error-message');
      const passwordError = browserPage.locator('text=/password is required/i, [data-testid="password-error"], .error-message');
      const confirmError = browserPage.locator('text=/confirm password is required/i, [data-testid="confirm-error"], .error-message');
      
      const errors = [nameError, emailError, passwordError, confirmError];
      const visibleErrors = await Promise.all(errors.map(error => error.isVisible()));
      expect(visibleErrors.some(isVisible => isVisible)).toBeTruthy();
    });
    
    test("should show validation error for password mismatch", async ({ page: browserPage }) => {
      // Start from homepage
      await page.navigate("/en");
      
      // Navigate to registration page
      const registerLink = browserPage.locator('a[href*="/auth/register"], a[href*="/signup"], .register-link, [data-testid="register-link"], a:has-text("Sign Up")');
      await expect(registerLink).toBeVisible({ timeout: 5000 });
      
      await registerLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/register|\/register|\/signup/, { timeout: 5000 });
      
      // Fill in registration form with mismatched passwords
      const nameInput = browserPage.locator('input[name*="name" i], [data-testid="name-input"]');
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const passwordInput = browserPage.locator('input[name*="password" i], [data-testid="password-input"], input[type="password"]');
      const confirmPasswordInput = browserPage.locator('input[name*="confirm" i], [data-testid="confirm-password-input"], input[name*="password_confirm"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(nameInput).toBeVisible();
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(confirmPasswordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      await nameInput.fill("Test User");
      await emailInput.fill("newuser@example.com");
      await passwordInput.fill("password123");
      await confirmPasswordInput.fill("differentpassword456"); // Mismatch
      
      // Submit form
      await submitButton.click();
      
      // Should show password mismatch error
      const mismatchError = browserPage.locator('text=/passwords do not match/i, text=/mismatch/i, [data-testid="password-mismatch"], .error-message');
      await expect(mismatchError).toBeVisible({ timeout: 5000 });
      
      // Should still be on registration page
      await expect(browserPage).toHaveURL(/\/auth\/register|\/register|\/signup/, { timeout: 5000 });
    });
  });

  test.describe("Password Reset Flow", () => {
    test("should allow user to request password reset", async ({ page: browserPage }) => {
      // Start from homepage
      await page.navigate("/en");
      
      // Navigate to login page
      const loginLink = browserPage.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      
      await loginLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      
      // Click on forgot password link
      const forgotLink = browserPage.locator('a[href*="/auth/forgot"], a[href*="/reset"], .forgot-link, [data-testid="forgot-link"], a:has-text("Forgot Password")');
      await expect(forgotLink).toBeVisible({ timeout: 5000 });
      
      await forgotLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/forgot|\/forgot-password|\/reset/, { timeout: 5000 });
      
      // Fill in password reset form
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(emailInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      await emailInput.fill("test@example.com");
      
      // Submit form
      await submitButton.click();
      
      // Should show success message
      const successMessage = browserPage.locator('text=/reset email sent/i, text=/check your email/i, [data-testid="success-message"], .success-message');
      await expect(successMessage).toBeVisible({ timeout: 5000 });
      
      // Should still be on reset page or redirect to login
      await expect(browserPage).toHaveURL(/\/auth\/forgot|\/forgot-password|\/reset|\/login|\/auth\/login/, { timeout: 5000 });
    });
    
    test("should show error for non-existent email in password reset", async ({ page: browserPage }) => {
      // Start from homepage
      await page.navigate("/en");
      
      // Navigate to login page
      const loginLink = browserPage.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      
      await loginLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      
      // Click on forgot password link
      const forgotLink = browserPage.locator('a[href*="/auth/forgot"], a[href*="/reset"], .forgot-link, [data-testid="forgot-link"], a:has-text("Forgot Password")');
      await expect(forgotLink).toBeVisible({ timeout: 5000 });
      
      await forgotLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/forgot|\/forgot-password|\/reset/, { timeout: 5000 });
      
      // Fill in password reset form with non-existent email
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(emailInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      await emailInput.fill("nonexistent@example.com");
      
      // Submit form
      await submitButton.click();
      
      // Might show success message (for security, don't reveal if email exists)
      // or show error message
      const message = browserPage.locator('text=/reset email sent/i, text=/check your email/i, text=/not found/i, [data-testid="message"]');
      await expect(message).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Logout Flow", () => {
    test("should allow user to logout successfully", async ({ page: browserPage }) => {
      // First login
      await authPage.loginViaApi("test@example.com", "password123");
      
      // Verify login
      await page.navigate("/en");
      const userIndicator = browserPage.locator('.user-info, [data-testid="user-info"], text=/hello, test/i, .avatar');
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
      
      // Navigate to logout
      const logoutLink = browserPage.locator('a[href*="/auth/logout"], a[href*="/logout"], .logout-link, [data-testid="logout-link"], a:has-text("Logout")');
      await expect(logoutLink).toBeVisible({ timeout: 5000 });
      
      await logoutLink.click();
      
      // Should redirect to homepage or login page
      await expect(browserPage).toHaveURL(/\/($|\?#)/, { timeout: 5000 });
      // Or to login page
      // await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      
      // Should show logged out indicator
      const loginLink = browserPage.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      
      // User indicator should be gone
      await expect(userIndicator).toBeHidden({ timeout: 5000 });
    });
  });

  test.describe("Session Persistence", () => {
    test("should maintain session across page reloads", async ({ page: browserPage }) => {
      // First login
      await authPage.loginViaApi("test@example.com", "password123");
      
      // Verify login
      await page.navigate("/en");
      const userIndicator = browserPage.locator('.user-info, [data-testid="user-info"], text=/hello, test/i, .avatar');
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
      
      // Reload page
      await page.reload();
      
      // Should still be logged in
      await expect(browserPage).toHaveURL(/\/($|\?#)/, { timeout: 5000 });
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
    });
    
    test("should maintain session across navigation", async ({ page: browserPage }) => {
      // First login
      await authPage.loginViaApi("test@example.com", "password123");
      
      // Verify login
      await page.navigate("/en");
      const userIndicator = browserPage.locator('.user-info, [data-testid="user-info"], text=/hello, test/i, .avatar');
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
      
      // Navigate to different pages
      await page.navigate("/en/services");
      await expect(browserPage).toHaveURL(/\/services/);
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
      
      await page.navigate("/en/blog");
      await expect(browserPage).toHaveURL(/\/blog/);
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
      
      await page.navigate("/en/contact");
      await expect(browserPage).toHaveURL(/\/contact/);
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
      
      await page.navigate("/en");
      await expect(browserPage).toHaveURL(/\/($|\?#)/);
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Responsive Design", () => {
    test("should work correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      
      // Test login flow on mobile
      await page.navigate("/en");
      
      // Navigate to login page
      const loginLink = browserPage.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      
      await loginLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      
      // Fill in login form
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const passwordInput = browserPage.locator('input[name*="password" i], [data-testid="password-input"], input[type="password"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      await emailInput.fill("test@example.com");
      await passwordInput.fill("password123");
      
      // Submit form
      await submitButton.click();
      
      // Should redirect to homepage
      await expect(browserPage).toHaveURL(/\/($|\?#)/, { timeout: 10000 });
      
      // Check for successful login indicator
      const userIndicator = browserPage.locator('.user-info, [data-testid="user-info"], text=/hello, test/i, .avatar');
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
    });
    
    test("should work correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      
      // Similar to mobile test but with tablet viewport
      await page.navigate("/en");
      
      // Navigate to login page
      const loginLink = browserPage.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      
      await loginLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      
      // Fill in login form
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const passwordInput = browserPage.locator('input[name*="password" i], [data-testid="password-input"], input[type="password"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      await emailInput.fill("test@example.com");
      await passwordInput.fill("password123");
      
      // Submit form
      await submitButton.click();
      
      // Should redirect to homepage
      await expect(browserPage).toHaveURL(/\/($|\?#)/, { timeout: 10000 });
      
      // Check for successful login indicator
      const userIndicator = browserPage.locator('.user-info, [data-testid="user-info"], text=/hello, test/i, .avatar');
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
    });
    
    test("should work correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      
      // Similar to mobile test but with desktop viewport
      await page.navigate("/en");
      
      // Navigate to login page
      const loginLink = browserPage.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      
      await loginLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      
      // Fill in login form
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const passwordInput = browserPage.locator('input[name*="password" i], [data-testid="password-input"], input[type="password"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      await emailInput.fill("test@example.com");
      await passwordInput.fill("password123");
      
      // Submit form
      await submitButton.click();
      
      // Should redirect to homepage
      await expect(browserPage).toHaveURL(/\/($|\?#)/, { timeout: 10000 });
      
      // Check for successful login indicator
      const userIndicator = browserPage.locator('.user-info, [data-testid="user-info"], text=/hello, test/i, .avatar');
      await expect(userIndicator).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe("Accessibility", () => {
    test("should have accessible login form", async ({ page: browserPage }) => {
      // Start from homepage
      await page.navigate("/en");
      
      // Navigate to login page
      const loginLink = browserPage.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      
      await loginLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      
      // Check form elements for accessibility
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const passwordInput = browserPage.locator('input[name*="password" i], [data-testid="password-input"], input[type="password"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      // Check email input accessibility
      await expect(emailInput).toBeEnabled();
      const emailLabel = browserPage.locator(`label[for="${await emailInput.getAttribute('id')}"]`);
      const emailAriaLabel = await emailInput.getAttribute('aria-label');
      const emailAriaLabelledby = await emailInput.getAttribute('aria-labelledby');
      expect(await emailLabel.isVisible() || emailAriaLabel || emailAriaLabelledby).toBeTruthy();
      
      // Check password input accessibility
      await expect(passwordInput).toBeEnabled();
      const passwordLabel = browserPage.locator(`label[for="${await passwordInput.getAttribute('id')}"]`);
      const passwordAriaLabel = await passwordInput.getAttribute('aria-label');
      const passwordAriaLabelledby = await passwordInput.getAttribute('aria-labelledby');
      expect(await passwordLabel.isVisible() || passwordAriaLabel || passwordAriaLabelledby).toBeTruthy();
      
      // Check submit button accessibility
      await expect(submitButton).toBeEnabled();
      const buttonText = await submitButton.textContent();
      const buttonAriaLabel = await submitButton.getAttribute('aria-label');
      expect(buttonText?.trim() || buttonAriaLabel).toBeDefined();
      
      // Check that form is keyboard navigable
      await expect(emailInput).toBeFocusable();
      await expect(passwordInput).toBeFocusable();
      await expect(submitButton).toBeFocusable();
    });
    
    test("should have accessible registration form", async ({ page: browserPage }) => {
      // Start from homepage
      await page.navigate("/en");
      
      // Navigate to registration page
      const registerLink = browserPage.locator('a[href*="/auth/register"], a[href*="/signup"], .register-link, [data-testid="register-link"], a:has-text("Sign Up")');
      await expect(registerLink).toBeVisible({ timeout: 5000 });
      
      await registerLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/register|\/register|\/signup/, { timeout: 5000 });
      
      // Check form elements for accessibility
      const nameInput = browserPage.locator('input[name*="name" i], [data-testid="name-input"]');
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const passwordInput = browserPage.locator('input[name*="password" i], [data-testid="password-input"], input[type="password"]');
      const confirmPasswordInput = browserPage.locator('input[name*="confirm" i], [data-testid="confirm-password-input"], input[name*="password_confirm"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(nameInput).toBeVisible();
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(confirmPasswordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      // Check name input accessibility
      await expect(nameInput).toBeEnabled();
      const nameLabel = browserPage.locator(`label[for="${await nameInput.getAttribute('id')}"]`);
      const nameAriaLabel = await nameInput.getAttribute('aria-label');
      const nameAriaLabelledby = await nameInput.getAttribute('aria-labelledby');
      expect(await nameLabel.isVisible() || nameAriaLabel || nameAriaLabelledby).toBeTruthy();
      
      // Check email input accessibility
      await expect(emailInput).toBeEnabled();
      const emailLabel = browserPage.locator(`label[for="${await emailInput.getAttribute('id')}"]`);
      const emailAriaLabel = await emailInput.getAttribute('aria-label');
      const emailAriaLabelledby = await emailInput.getAttribute('aria-labelledby');
      expect(await emailLabel.isVisible() || emailAriaLabel || emailAriaLabelledby).toBeTruthy();
      
      // Check password input accessibility
      await expect(passwordInput).toBeEnabled();
      const passwordLabel = browserPage.locator(`label[for="${await passwordInput.getAttribute('id')}"]`);
      const passwordAriaLabel = await passwordInput.getAttribute('aria-label');
      const passwordAriaLabelledby = await passwordInput.getAttribute('aria-labelledby');
      expect(await passwordLabel.isVisible() || passwordAriaLabel || passwordAriaLabelledby).toBeTruthy();
      
      // Check confirm password input accessibility
      await expect(confirmPasswordInput).toBeEnabled();
      const confirmLabel = browserPage.locator(`label[for="${await confirmPasswordInput.getAttribute('id')}"]`);
      const confirmAriaLabel = await confirmPasswordInput.getAttribute('aria-label');
      const confirmAriaLabelledby = await confirmPasswordInput.getAttribute('aria-labelledby');
      expect(await confirmLabel.isVisible() || confirmAriaLabel || confirmAriaLabelledby).toBeTruthy();
      
      // Check submit button accessibility
      await expect(submitButton).toBeEnabled();
      const buttonText = await submitButton.textContent();
      const buttonAriaLabel = await submitButton.getAttribute('aria-label');
      expect(buttonText?.trim() || buttonAriaLabel).toBeDefined();
      
      // Check that form is keyboard navigable
      await expect(nameInput).toBeFocusable();
      await expect(emailInput).toBeFocusable();
      await expect(passwordInput).toBeFocusable();
      await expect(confirmPasswordInput).toBeFocusable();
      await expect(submitButton).toBeFocusable();
    });
  });

  test.describe("Performance", () => {
    test("should load login page within reasonable time", async ({ page: browserPage }) => {
      const startTime = Date.now();
      await page.navigate("/en");
      
      // Navigate to login page
      const loginLink = browserPage.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      
      await loginLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });
    
    test("should complete login process within reasonable time", async ({ page: browserPage }) => {
      const startTime = Date.now();
      
      // Start from homepage
      await page.navigate("/en");
      
      // Navigate to login page
      const loginLink = browserPage.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 });
      
      await loginLink.click();
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      
      // Fill in login form
      const emailInput = browserPage.locator('input[name*="email" i], [data-testid="email-input"], input[type="email"]');
      const passwordInput = browserPage.locator('input[name*="password" i], [data-testid="password-input"], input[type="password"]');
      const submitButton = browserPage.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
      
      await expect(emailInput).toBeVisible();
      await expect(passwordInput).toBeVisible();
      await expect(submitButton).toBeVisible();
      
      await emailInput.fill("test@example.com");
      await passwordInput.fill("password123");
      
      // Submit form
      await submitButton.click();
      
      // Should redirect to homepage
      await expect(browserPage).toHaveURL(/\/($|\?#)/, { timeout: 10000 });
      
      const endTime = Date.now();
      const processTime = endTime - startTime;
      expect(processTime).toBeLessThan(8000); // Should complete within 8 seconds
    });
  });
});