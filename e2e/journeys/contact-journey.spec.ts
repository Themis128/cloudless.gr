import { test, expect } from "@playwright/test";

/**
 * Contact User Journey Test Suite
 * Tests user flows for contacting support, submitting inquiries, and getting help
 */

test.describe("Contact User Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Start from homepage
    await page.goto("/en");
    await expect(page).toHaveURL(/.*\/$/);
  });

  test("should allow user to navigate to contact page", async ({ page }) => {
    // Assert
    expect(page.locator('text=Contact, text=Contact Us, text=Get in touch')).toBeVisible();
    
    // Act
    await page.click('text=Contact, text=Contact Us, text=Get in touch');
    // Assert
    await expect(page).toHaveURL(/.*\/contact/);
  });

  test("should display contact form with required fields", async ({ page }) => {
    await page.goto("/en/contact");
    await expect(page).toHaveURL(/.*\/contact/);
    
    // Assert
    expect(page.locator('form')).toBeVisible();
    
    // Arrange
    const form = page.locator('form');
    // Assert
    await expect(form.locator('input[name="name"], input[name="your-name"], input[name="fullname"]')).toBeVisible();
    await expect(form.locator('input[name="email"], input[name="your-email"], input[name="email-address"]')).toBeVisible();
    await expect(form.locator('textarea[name="message"], textarea[name="your-message"], input[name="subject"]')).toBeVisible();
  });

  test("should allow user to submit contact form with valid data", async ({ page }) => {
    await page.goto("/en/contact");
    await expect(page).toHaveURL(/.*\/contact/);
    
    // Arrange
    const form = page.locator('form');
    await form.locator('input[name="name"], input[name="your-name"], input[name="fullname"]').first().fill(`Test User ${Date.now()}`);
    await form.locator('input[name="email"], input[name="your-email"], input[name="email-address"]').first().fill(`test${Date.now()}@example.com`);
    await form.locator('textarea[name="message"], textarea[name="your-message"], input[name="subject"]').first().fill(`This is a test message from automated testing at ${new Date().toISOString()}`);
    
    // Act
    await form.locator('button:has-text("Send"), button:has-text("Submit"), button:has-text("Contact")').first().click();
    
    // Assert
    await page.waitForTimeout(3000);
    
    const successMessage = page.locator('.success, .confirmation, text=Thanks, text=Message sent, text=We\'ll get back to you');
    expect(successMessage.first()).toBeVisible();
  });

  test("should validate contact form data and show errors for invalid input", async ({ page }) => {
    await page.goto("/en/contact");
    await expect(page).toHaveURL(/.*\/contact/);
    
    // Arrange
    const form = page.locator('form');
    
    // Test with empty required fields
    await form.locator('button:has-text("Send"), button:has-text("Submit"), button:has-text("Contact")').first().click();
    
    // Assert
    await page.waitForTimeout(1000);
    
    const errorMessages = page.locator('.error, .invalid, [role="alert"], text=Required, text=Please fill in');
    expect(errorMessages.first()).toBeVisible();
  });

  test("should validate email format in contact form", async ({ page }) => {
    await page.goto("/en/contact");
    await expect(page).toHaveURL(/.*\/contact/);
    
    // Arrange
    const form = page.locator('form');
    await form.locator('input[name="name"], input[name="your-name"], input[name="fullname"]').first().fill(`Test User ${Date.now()}`);
    await form.locator('input[name="email"], input[name="your-email"], input[name="email-address"]').first().fill(`invalid-email`);
    await form.locator('textarea[name="message"], textarea[name="your-message"], input[name="subject"]').first().fill(`Test message`);
    
    // Act
    await form.locator('button:has-text("Send"), button:has-text("Submit"), button:has-text("Contact")').first().click();
    
    // Assert
    await page.waitForTimeout(1000);
    
    const emailError = page.locator('.error, .invalid, [role="alert"]:has-text("email"), text=Valid email, text=Please enter a valid');
    expect(emailError.first()).toBeVisible();
  });

  test("should allow user to view contact information (phone, address, etc.)", async ({ page }) => {
    await page.goto("/en/contact");
    await expect(page).toHaveURL(/.*\/contact/);
    
    // Look for contact info like phone, address, social links
    const contactInfo = page.locator('text=Phone, text=Call, text=Address, text=Location, text=Email, text=Follow us');
    expect(contactInfo.first()).toBeVisible();
  });
});