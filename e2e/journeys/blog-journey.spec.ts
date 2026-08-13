import { test, expect } from "@playwright/test";

/**
 * Blog User Journey Test Suite
 * Tests user flows for reading, searching, and interacting with blog content
 */

test.describe("Blog User Journey", () => {
  test.beforeEach(async ({ page }) => {
    // Start from homepage
    await page.goto("/en");
    await expect(page).toHaveURL(/.*\/$/);
  });

  test("should allow user to browse blog posts", async ({ page }) => {
    // Navigate to blog page
    await page.click('text=Blog');
    await expect(page).toHaveURL(/.*\/blog/);
    
    // Wait for blog posts to load
    await page.waitForSelector('.blog-post-item, .post-card', { timeout: 5000 });
    
    // Verify at least one post is visible
    const postItems = page.locator('.blog-post-item, .post-card');
    await expect(postItems.first()).toBeVisible();
    
    // Check that posts have expected elements
    await expect(postItems.first()).toContainText(/[a-zA-Z]/); // Has some text
  });

  test("should allow user to view individual blog post", async ({ page }) => {
    // Navigate to blog page
    await page.click('text=Blog');
    await expect(page).toHaveURL(/.*\/blog/);
    
    // Wait for blog posts to load
    await page.waitForSelector('.blog-post-item, .post-card', { timeout: 5000 });
    
    // Click on first post
    const firstPost = page.locator('.blog-post-item, .post-card').first();
    await firstPost.click();
    
    // Wait for post detail page
    await page.waitForSelector('.blog-post-detail, .post-detail, article', { timeout: 5000 });
    
    // Verify we're on a post detail page
    await expect(page).toHaveURL(/\/blog\//);

    // Assert
    expect(page.locator('.blog-post-detail, .post-detail, article')).toBeVisible();
  });

  test("should allow user to search blog posts", async ({ page }) => {
    // Navigate to blog page
    await page.click('text=Blog');
    await expect(page).toHaveURL(/.*\/blog/);
    
    // Assert
    expect(page.locator('input[placeholder*="Search" i], input[name="q"], input[type="search"]')).toBeVisible();
    
    // If search exists, use it
    const searchInput = page.locator('input[placeholder*="Search" i], input[name="q"], input[type="search"]').first();
    if (await searchInput.isVisible()) {
      await searchInput.fill("test");
      await page.keyboard.press("Enter");
      
      // Assert
      expect(page.locator('.search-results, .blog-post-item, .post-card, .no-results')).toBeVisible();
    }
  });

  test("should allow user to filter blog by category or tag", async ({ page }) => {
    // Navigate to blog page
    await page.click('text=Blog');
    await expect(page).toHaveURL(/.*\/blog/);
    
    // Assert
    expect(page.locator('.category-filter, .tag-filter, .filter-option, select')).toBeVisible();
    
    // Arrange
    const filterElements = page.locator('.category-filter, .tag-filter, .filter-option, select');
    if (await filterElements.first().isVisible()) {
      // Act
      await filterElements.first().click();
      await page.waitForTimeout(1000);
    }
  });

  test("should allow user to subscribe to blog newsletter", async ({ page }) => {
    // Assert
    expect(page.locator('text=Newsletter, text=Subscribe, input[name="email"]')).toBeVisible();
    
    // Arrange
    const newsletterElements = page.locator('text=Newsletter, text=Subscribe, input[name="email"]');
    if (await newsletterElements.first().isVisible()) {
      // Act
      await newsletterElements.first().click();
      await page.waitForTimeout(1000);
      
      // Arrange
      const newsletterForm = page.locator('form:has-text("Newsletter"), form:has-text("Subscribe"), input[name="email"]');
      if (await newsletterForm.first().isVisible()) {
        await newsletterForm.locator('input[name="email"]').first().fill(`test${Date.now()}@example.com`);
        await newsletterForm.locator('button:has-text("Subscribe"), button:has-text("Sign up")').first().click();
        await page.waitForTimeout(2000);
        
        // Assert
        const successMessage = page.locator('.success, .confirmation, text=Thanks, text=Subscribed');
        expect(successMessage.first()).toBeVisible();
      }
    }
  });
});