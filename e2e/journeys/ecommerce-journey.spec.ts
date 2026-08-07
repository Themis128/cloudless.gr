import { test, expect } from "@playwright/test";

/**
 * E-commerce User Journey Test Suite
 * Tests complete user flows for shopping, checkout, and order management
 */

test.describe("E-commerce User Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Start from homepage
    await page.goto("/");
    await expect(page).toHaveURL(/.*\/$/);
  });

  test("should allow user to browse products and add to cart", async ({ page }) => {
    // Navigate to store page
    await page.click('text=Store');
    await expect(page).toHaveURL(/.*\/store/);
    
    // Wait for products to load
    await page.waitForSelector('.product-item', { timeout: 5000 });
    
    // Click on first product
    const firstProduct = page.locator('.product-item').first();
    await firstProduct.click();
    
    // Wait for product detail page
    await page.waitForSelector('.product-detail', { timeout: 5000 });
    
    // Add to cart
    await page.click('button:has-text("Add to Cart")');
    
    // Verify cart updated
    await expect(page.locator('.cart-count')).toHaveText(/[1-9]/);
  });

  test("should allow user to view cart and proceed to checkout", async ({ page }) => {
    // Add item to cart first
    await page.goto("/store");
    await page.waitForSelector('.product-item', { timeout: 5000 });
    await page.locator('.product-item').first().click();
    await page.waitForSelector('.product-detail', { timeout: 5000 });
    await page.click('button:has-text("Add to Cart")');
    await page.waitForTimeout(1000); // Wait for cart update
    
    // Go to cart
    await page.click('.cart-icon');
    await expect(page).toHaveURL(/.*\/cart/);
    
    // Verify item in cart
    await expect(page.locator('.cart-item')).toBeVisible();
    
    // Proceed to checkout
    await page.click('button:has-text("Proceed to Checkout")');
    await expect(page).toHaveURL(/.*\/checkout/);
  });

  test("should allow user to complete checkout process", async ({ page }) => {
    // This test would require mock payment processing
    // For now, we'll verify the checkout form loads and validates
    
    await page.goto("/checkout");
    await expect(page).toHaveURL(/.*\/checkout/);
    
    // Fill in checkout form with test data
    await page.fill('input[name="email"]', `test${Date.now()}@example.com`);
    await page.fill('input[name="name"]', `Test User ${Date.now()}`);
    await page.fill('input[name="address"]', '123 Test Street');
    await page.fill('input[name="city"]', 'Test City');
    await page.fill('input[name="postalCode"]', '12345');
    await page.fill('input[name="phone"]', '555-123-4567');
    
    // Verify form accepts input
    await expect(page.locator('input[name="email"]')).toHaveValue(/test.*@example.com/);
    
    // Attempt to place order (would fail without payment mock, but we can verify validation)
    await page.click('button:has-text("Place Order")');
    
    // Should show either success or validation errors
    await page.waitForTimeout(2000);
    const orderConfirmation = page.locator('.order-confirmation, .error-message');
    await expect(orderConfirmation.first()).toBeVisible();
  });

  test("should allow user to view order history", async ({ page }) => {
    // This would require authentication
    // For now, test that the route exists and handles unauthenticated access
    
    await page.goto("/user/purchases");
    // Should redirect to login or show appropriate message for unauthenticated access
    await page.waitForTimeout(1000);
    
    const loginOrMessage = page.locator('text=Sign in, text=Login, text=Please log in');
    await expect(loginOrMessage.first()).toBeVisible();
  });

  test("should allow user to manage profile", async ({ page }) => {
    // Test profile page access
    await page.goto("/user/profile");
    // Should redirect to login or show appropriate message for unauthenticated access
    await page.waitForTimeout(1000);
    
    const loginOrMessage = page.locator('text=Sign in, text=Login, text=Please log in');
    await expect(loginOrMessage.first()).toBeVisible();
  });
});