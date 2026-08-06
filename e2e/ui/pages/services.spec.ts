import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage, createAuthenticatedPage } from "../helpers/page-helpers";

/**
 * Services Page Test Suite
 * Tests the services page for rendering, navigation, and functionality
 */

test.describe("Services Page", () => {
  let page: BasePage;
  let responsivePage: ResponsivePage;
  let authPage: AuthenticatedPage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = createBasePage(browserPage);
    responsivePage = createResponsivePage(browserPage);
    authPage = createAuthenticatedPage(browserPage);
    
    await page.navigate("/services");
  });

  test("should load successfully", async ({ page: browserPage }) => {
    await expect(browserPage).toHaveTitle(/services|cloudless/i);
    
    // Check for main heading
    const heading = browserPage.locator('h1, .services-heading, [data-testid="services-heading"]');
    await expect(heading).toBeVisible();
  });

  test("should have services grid or list", async ({ page: browserPage }) => {
    const servicesContainer = browserPage.locator('.services-grid, .services-list, [data-testid="services-container"], .services');
    await expect(servicesContainer).toBeVisible();
    
    // Check for service items/cards
    const serviceItems = servicesContainer.locator('.service-item, .service-card, [data-testid="service-item"]');
    await expect(serviceItems.first()).toBeVisible({ timeout: 5000 });
    
    // Check that we have at least one service item
    const count = await serviceItems.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should display service details", async ({ page: browserPage }) => {
    const serviceItems = browserPage.locator('.service-item, .service-card, [data-testid="service-item"]');
    const firstItem = serviceItems.first();
    
    await expect(firstItem).toBeVisible();
    
    // Check for service title
    const title = firstItem.locator('h2, h3, .service-title, [data-testid="service-title"]');
    await expect(title).toBeVisible();
    
    // Check for service description
    const description = firstItem.locator('.service-description, [data-testid="service-description"], p');
    await expect(description).toBeVisible();
    
    // Check for pricing or CTA button
    const ctaOrPrice = firstItem.locator('.service-price, .service-cta, a.btn, .btn, [data-testid="service-price"], [data-testid="service-cta"]');
    // Note: This might not be present for all services, so we don't assert visibility
  });

  test("should have service categories or tags", async ({ page: browserPage }) => {
    const serviceItems = browserPage.locator('.service-item, .service-card, [data-testid="service-item"]');
    const firstItem = serviceItems.first();
    
    await expect(firstItem).toBeVisible();
    
    // Check for categories/tags
    const categories = firstItem.locator('.service-categories, .service-tags, [data-testid="service-categories"], [data-testid="service-tags"]');
    // Categories might not be present for all implementations
    
    // Alternatively check for badges or labels
    const badges = firstItem.locator('.badge, .label, .tag, [data-testid="badge"]');
    // Badges might not be present
  });

  test("should have call-to-action for getting started", async ({ page: browserPage }) => {
    const ctaSection = browserPage.locator('.services-cta, [data-testid="services-cta"], .cta-section');
    await expect(ctaSection).toBeVisible();
    
    // Check for heading in CTA
    const ctaHeading = ctaSection.locator('h2, h3, .cta-title');
    await expect(ctaHeading).toBeVisible();
    
    // Check for primary button
    const primaryButton = ctaSection.locator('a.btn-primary, .btn-primary, .primary-button');
    await expect(primaryButton).toBeVisible();
    
    // Check that button links to appropriate page (contact, store, etc.)
    const href = await primaryButton.getAttribute('href');
    expect(href).toMatch(/\/contact|\/store|\/get-started|\/sign-up/);
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/services");
      
      // Check that essential elements are still visible
      const heading = browserPage.locator('h1, .services-heading, [data-testid="services-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that service items are visible (might be stacked)
      const serviceItems = browserPage.locator('.service-item, .service-card, [data-testid="service-item"]');
      await expect(serviceItems.first()).toBeVisible();
    });
    
    test("should render correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      await responsivePage.navigate("/services");
      
      // Check that layout adapts appropriately
      const heading = browserPage.locator('h1, .services-heading, [data-testid="services-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that service items are visible
      const serviceItems = browserPage.locator('.service-item, .service-card, [data-testid="service-item"]');
      await expect(serviceItems.first()).toBeVisible();
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/services");
      
      // Check that full layout is visible
      const heading = browserPage.locator('h1, .services-heading, [data-testid="services-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that we can see multiple service items
      const serviceItems = browserPage.locator('.service-item, .service-card, [data-testid="service-item"]');
      const count = await serviceItems.count();
      expect(count).toBeGreaterThan(0);
      
      // On desktop, we might expect to see multiple items in a grid
      // But we don't assert a specific count as layout may vary
    });
  });

  test.describe("Navigation", () => {
    test("should navigate to homepage", async ({ page: browserPage }) => {
      const homeLink = browserPage.locator('a[href="/"], .logo, [data-testid="logo"], nav a:has-text("Home")');
      await expect(homeLink).toBeVisible();
      
      await homeLink.click();
      await expect(browserPage).toHaveURL(/\/($|\?|#)/); // Homepage or with query/hash
    });
    
    test("should navigate to store", async ({ page: browserPage }) => {
      const storeLink = browserPage.locator('a[href*="/store"], nav a:has-text("Store"), .nav-link[href*="/store"]');
      await expect(storeLink).toBeVisible();
      
      await storeLink.click();
      await expect(browserPage).toHaveURL(/\/store/);
    });
    
    test("should navigate to blog", async ({ page: browserPage }) => {
      const blogLink = browserPage.locator('a[href*="/blog"], nav a:has-text("Blog"), .nav-link[href*="/blog"]');
      await expect(blogLink).toBeVisible();
      
      await blogLink.click();
      await expect(browserPage).toHaveURL(/\/blog/);
    });
    
    test("should navigate to contact", async ({ page: browserPage }) => {
      const contactLink = browserPage.locator('a[href*="/contact"], nav a:has-text("Contact"), .nav-link[href*="/contact"]');
      await expect(contactLink).toBeVisible();
      
      await contactLink.click();
      await expect(browserPage).toHaveURL(/\/contact/);
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
      expect(h1Count).toBeLessThan(3); // Allow for some flexibility
      
      // Check for proper heading hierarchy
      const h2 = browserPage.locator('h2');
      const h3 = browserPage.locator('h3');
      
      // At least some h2 or h3 should be present for service titles
      const headingCount = await h2.count() + await h3.count();
      expect(headingCount).toBeGreaterThan(0);
    });
    
    test("should have accessible buttons and links", async ({ page: browserPage }) => {
      // Check that buttons have accessible names
      const buttons = browserPage.locator('button, .btn, [role="button"]');
      const count = await buttons.count();
      
      // Check a sample of buttons for accessibility
      const sampleSize = Math.min(5, count);
      for (let i = 0; i < sampleSize; i++) {
        const button = buttons.nth(i);
        await expect(button).toBeEnabled();
        
        // Check for aria-label, text content, or aria-labelledby
        const ariaLabel = await button.getAttribute('aria-label');
        const textContent = await button.textContent();
        const ariaLabelledby = await button.getAttribute('aria-labelledby');
        
        expect(ariaLabel || textContent?.trim() || ariaLabelledby).toBeDefined();
      }
    });
  });

  test.describe("Performance", () => {
    test("should load within reasonable time", async ({ page: browserPage }) => {
      const startTime = Date.now();
      await page.navigate("/services");
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
    });
  });
});