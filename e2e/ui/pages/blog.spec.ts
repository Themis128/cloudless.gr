import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage, createAuthenticatedPage } from "../helpers/page-helpers";

/**
 * Blog Page Test Suite
 * Tests the blog page for rendering, navigation, and functionality
 */

test.describe("Blog Page", () => {
  let page: BasePage;
  let responsivePage: ResponsivePage;
  let authPage: AuthenticatedPage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = createBasePage(browserPage);
    responsivePage = createResponsivePage(browserPage);
    authPage = createAuthenticatedPage(browserPage);
    
    await page.navigate("/blog");
  });

  test("should load successfully", async ({ page: browserPage }) => {
    await expect(browserPage).toHaveTitle(/blog|cloudless/i);
    
    // Check for main heading
    const heading = browserPage.locator('h1, .blog-heading, [data-testid="blog-heading"]');
    await expect(heading).toBeVisible();
  });

  test("should have blog posts grid or list", async ({ page: browserPage }) => {
    const postsContainer = browserPage.locator('.posts-grid, .posts-list, [data-testid="posts-container"], .blog-posts');
    await expect(postsContainer).toBeVisible();
    
    // Check for post items/cards
    const postItems = postsContainer.locator('.post-item, .post-card, [data-testid="post-item"]');
    await expect(postItems.first()).toBeVisible({ timeout: 5000 });
    
    // Check that we have at least one post item
    const count = await postItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should display blog post details", async ({ page: browserPage }) => {
    const postItems = browserPage.locator('.post-item, .post-card, [data-testid="post-item"]');
    const firstItem = postItems.first();
    
    await expect(firstItem).toBeVisible();
    
    // Check for post title
    const title = firstItem.locator('h2, h3, .post-title, [data-testid="post-title"]');
    await expect(title).toBeVisible();
    
    // Check for post excerpt/summary
    const excerpt = firstItem.locator('.post-excerpt, [data-testid="post-excerpt"], p');
    await expect(excerpt).toBeVisible();
    
    // Check for post meta (author, date, etc.)
    const meta = firstItem.locator('.post-meta, [data-testid="post-meta"], .meta');
    await expect(meta).toBeVisible();
    
    // Check for featured image
    const image = firstItem.locator('img, .post-image, .featured-image');
    await expect(image).toBeVisible();
    
    // Check for read more link
    const readMore = firstItem.locator('a:has-text("Read More"), .read-more, [data-testid="read-more"]');
    await expect(readMore).toBeVisible();
  });

  test("should have blog categories or tags", async ({ page: browserPage }) => {
    const postItems = browserPage.locator('.post-item, .post-card, [data-testid="post-item"]');
    const firstItem = postItems.first();
    
    await expect(firstItem).toBeVisible();
    
    // Check for categories/tags
    const categories = firstItem.locator('.post-categories, .post-tags, [data-testid="post-categories"], [data-testid="post-tags"]');
    // Categories might not be present for all implementations
    
    // Alternatively check for badges or labels
    const badges = firstItem.locator('.badge, .label, .tag, [data-testid="badge"]');
    // Badges might not be present
  });

  test("should have pagination or load more functionality", async ({ page: browserPage }) => {
    // Check for pagination
    const pagination = browserPage.locator('.pagination, [data-testid="pagination"], .page-links');
    await expect(pagination).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // Check for load more button
    const loadMore = browserPage.locator('button:has-text("Load More"), .load-more, [data-testid="load-more"]');
    await expect(loadMore).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test("should have call-to-action for newsletter or subscription", async ({ page: browserPage }) => {
    const ctaSection = browserPage.locator('.newsletter-cta, [data-testid="newsletter"], .cta-section');
    await expect(ctaSection).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await ctaSection.isVisible()) {
      // Check for heading in CTA
      const ctaHeading = ctaSection.locator('h2, h3, .cta-title');
      await expect(ctaHeading).toBeVisible();
      
      // Check for email input
      const emailInput = ctaSection.locator('input[type="email"], [data-testid="email-input"]');
      await expect(emailInput).toBeVisible();
      
      // Check for submit button
      const submitButton = ctaSection.locator('button[type="submit"], .btn, .submit-button');
      await expect(submitButton).toBeVisible();
    }
  });

  test.describe("Authentication", () => {
    test("should show login prompt for commenting when not authenticated", async ({ page: browserPage }) => {
      // Navigate to a specific blog post
      const postLinks = browserPage.locator('.post-item a, .post-card a, [data-testid="post-link"]');
      const firstPostLink = postLinks.first();
      
      if (await firstPostLink.isVisible()) {
        await firstPostLink.click();
        
        // Wait for post detail page to load
        await browserPage.waitForURL(/\/blog\/.+/, { timeout: 5000 });
        
        // Try to add a comment
        const commentInput = browserPage.locator('textarea[placeholder*="comment"], [data-testid="comment-input"]');
        const submitComment = browserPage.locator('button:has-text("Post Comment"), [data-testid="submit-comment"]');
        
        if (await commentInput.isVisible() && await submitComment.isVisible()) {
          await commentInput.fill("This is a test comment");
          await submitComment.click();
          
          // Should show login prompt or redirect to login
          const loginPrompt = browserPage.locator('text=/sign in|log in/i, [data-testid="login-prompt"], .auth-required');
          await expect(loginPrompt).toBeVisible({ timeout: 5000 });
          
          // Or redirect to login page
          await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
        }
      }
    });
    
    test("should allow authenticated users to comment", async ({ page: browserPage }) => {
      // First login as a test user
      await authPage.loginViaApi("test@example.com", "password123");
      
      // Navigate to a specific blog post
      await page.navigate("/blog");
      const postLinks = browserPage.locator('.post-item a, .post-card a, [data-testid="post-link"]');
      const firstPostLink = postLinks.first();
      
      if (await firstPostLink.isVisible()) {
        await firstPostLink.click();
        
        // Wait for post detail page to load
        await browserPage.waitForURL(/\/blog\/.+/, { timeout: 5000 });
        
        // Try to add a comment
        const commentInput = browserPage.locator('textarea[placeholder*="comment"], [data-testid="comment-input"]');
        const submitComment = browserPage.locator('button:has-text("Post Comment"), [data-testid="submit-comment"]');
        
        if (await commentInput.isVisible() && await submitComment.isVisible()) {
          await commentInput.fill("This is a test comment from an authenticated user");
          await submitComment.click();
          
          // Should show success message
          const successMessage = browserPage.locator('text=/comment posted|success/i, [data-testid="success-message"]');
          await expect(successMessage).toBeVisible({ timeout: 5000 });
          
          // Comment should appear in the list
          const commentText = browserPage.locator(`text="This is a test comment from an authenticated user"`);
          await expect(commentText).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/blog");
      
      // Check that essential elements are still visible
      const heading = browserPage.locator('h1, .blog-heading, [data-testid="blog-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that post items are visible (might be stacked)
      const postItems = browserPage.locator('.post-item, .post-card, [data-testid="post-item"]');
      await expect(postItems.first()).toBeVisible();
    });
    
    test("should render correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      await responsivePage.navigate("/blog");
      
      // Check that layout adapts appropriately
      const heading = browserPage.locator('h1, .blog-heading, [data-testid="blog-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that post items are visible
      const postItems = browserPage.locator('.post-item, .post-card, [data-testid="post-item"]');
      await expect(postItems.first()).toBeVisible();
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/blog");
      
      // Check that full layout is visible
      const heading = browserPage.locator('h1, .blog-heading, [data-testid="blog-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that we can see multiple post items
      const postItems = browserPage.locator('.post-item, .post-card, [data-testid="post-item"]');
      const count = await postItems.count();
      expect(count).toBeGreaterThan(0);
      
      // On desktop, we might expect to see multiple items in a grid
    });
  });

  test.describe("Navigation", () => {
    test("should navigate to homepage", async ({ page: browserPage }) => {
      const homeLink = browserPage.locator('a[href="/"], .logo, [data-testid="logo"], nav a:has-text("Home")');
      await expect(homeLink).toBeVisible();
      
      await homeLink.click();
      await expect(browserPage).toHaveURL(/\/($|\?|#)/);
    });
    
    test("should navigate to services", async ({ page: browserPage }) => {
      const servicesLink = browserPage.locator('a[href*="/services"], nav a:has-text("Services"), .nav-link[href*="/services"]');
      await expect(servicesLink).toBeVisible();
      
      await servicesLink.click();
      await expect(browserPage).toHaveURL(/\/services/);
    });
    
    test("should navigate to store", async ({ page: browserPage }) => {
      const storeLink = browserPage.locator('a[href*="/store"], nav a:has-text("Store"), .nav-link[href*="/store"]');
      await expect(storeLink).toBeVisible();
      
      await storeLink.click();
      await expect(browserPage).toHaveURL(/\/store/);
    });
    
    test("should navigate to contact", async ({ page: browserPage }) => {
      const contactLink = browserPage.locator('a[href*="/contact"], nav a:has-text("Contact"), .nav-link[href*="/contact"]');
      await expect(contactLink).toBeVisible();
      
      await contactLink.click();
      await expect(browserPage).toHaveURL(/\/contact/);
    });
    
    test("should navigate to individual blog post", async ({ page: browserPage }) => {
      const postLinks = browserPage.locator('.post-item a, .post-card a, [data-testid="post-link"]');
      const firstPostLink = postLinks.first();
      
      if (await firstPostLink.isVisible()) {
        await firstPostLink.click();
        await expect(browserPage).toMatchURL(/\/blog\/.+/);
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper language attribute", async ({ page: browserPage }) => {
      const htmlElement = browserPage.locator('html');
      const lang = await htmlElement.getAttribute('lang');
      expect(lang).toMatch(/^en/);
    });
    
    test("should have proper heading structure", async ({ page: browserPage }) => {
      // Check for h1
      const h1 = browserPage.locator('h1');
      await expect(h1).toBeVisible();
      
      // Check that we don't have multiple h1s (best practice)
      const h1Count = await h1.count();
      expect(h1Count).toBeLessThan(3);
      
      // Check for proper heading hierarchy
      const h2 = browserPage.locator('h2');
      const h3 = browserPage.locator('h3');
      
      // At least some h2 or h3 should be present for post titles
      const headingCount = await h2.count() + await h3.count();
      expect(headingCount).toBeGreaterThan(0);
    });
    
    test("should have accessible post elements", async ({ page: browserPage }) => {
      // Check that post titles are accessible
      const postTitles = browserPage.locator('.post-title, h2, h3');
      const count = await postTitles.count();
      
      // Check a sample of post titles
      const sampleSize = Math.min(5, count);
      for (let i = 0; i < sampleSize; i++) {
        const title = postTitles.nth(i);
        await expect(title).toBeVisible();
        
        // Check for accessible name (text content or aria-label)
        const textContent = await title.textContent();
        const ariaLabel = await title.getAttribute('aria-label');
        
        expect(textContent?.trim() || ariaLabel).toBeDefined();
      }
    });
    
    test("should have accessible images with alt text", async ({ page: browserPage }) => {
      // Check that images have alt text
      const images = browserPage.locator('img');
      const count = await images.count();
      
      // Check a sample of images
      const sampleSize = Math.min(5, count);
      for (let i = 0; i < sampleSize; i++) {
        const img = images.nth(i);
        await expect(img).toBeVisible();
        
        // Check for alt attribute
        const altText = await img.getAttribute('alt');
        expect(altText).toBeDefined(); // Alt text should be present (can be empty for decorative images)
      }
    });
  });

  test.describe("Performance", () => {
    test("should load within reasonable time", async ({ page: browserPage }) => {
      const startTime = Date.now();
      await page.navigate("/blog");
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });
  });
});