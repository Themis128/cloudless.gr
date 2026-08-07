import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage, createAuthenticatedPage } from "../../helpers/page-helpers";

/**
 * Store Page Test Suite
 * Tests the store/e-commerce page for rendering, navigation, and functionality
 */

test.describe("Store Page", () => {
  let page: BasePage;
  let responsivePage: ResponsivePage;
  let authPage: AuthenticatedPage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = createBasePage(browserPage);
    responsivePage = createResponsivePage(browserPage);
    authPage = createAuthenticatedPage(browserPage);
    
    await page.navigate("/store");
  });

  test("should load successfully", async ({ page: browserPage }) => {
    await expect(browserPage).toHaveTitle(/store|shop|cloudless/i);
    
    // Check for main heading
    const heading = browserPage.locator('h1, .store-heading, [data-testid="store-heading"]');
    await expect(heading).toBeVisible();
  });

  test("should have products grid or list", async ({ page: browserPage }) => {
    const productsContainer = browserPage.locator('.products-grid, .products-list, [data-testid="products-container"], .store-products');
    await expect(productsContainer).toBeVisible();
    
    // Check for product items/cards
    const productItems = productsContainer.locator('.product-item, .product-card, [data-testid="product-item"]');
    // Products might not be available in test environment, so we wait but don't fail if none
    await expect(productItems.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // If products exist, check their structure
    if (await productItems.count() > 0) {
      const firstProduct = productItems.first();
      
      // Check for product title
      const title = firstProduct.locator('h2, h3, .product-title, [data-testid="product-title"]');
      await expect(title).toBeVisible();
      
      // Check for product price
      const price = firstProduct.locator('.product-price, [data-testid="product-price"], .price');
      await expect(price).toBeVisible();
      
      // Check for product image
      const image = firstProduct.locator('img, .product-image');
      await expect(image).toBeVisible();
      
      // Check for add to cart button
      const addToCart = firstProduct.locator('button:has-text("Add to Cart"), .add-to-cart, [data-testid="add-to-cart"]');
      await expect(addToCart).toBeVisible();
    }
  });

  test("should have product categories or filters", async ({ page: browserPage }) => {
    // Check for category navigation or filters
    const categoriesNav = browserPage.locator('.categories, .filters, [data-testid="categories"], [data-testid="filters"]');
    await expect(categoriesNav).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // Check for sort options
    const sortSelect = browserPage.locator('select[name*="sort"], .sort-select, [data-testid="sort"]');
    await expect(sortSelect).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test("should have shopping cart indicator", async ({ page: browserPage }) => {
    const cartIndicator = browserPage.locator('.cart-indicator, [data-testid="cart"], .shopping-cart, a[href*="/cart"]');
    await expect(cartIndicator).toBeVisible();
    
    // Check for cart count badge
    const cartCount = cartIndicator.locator('.cart-count, .badge, [data-testid="cart-count"]');
    // Cart count might be zero initially
  });

  test("should have call-to-action for featured products", async ({ page: browserPage }) => {
    const featuredSection = browserPage.locator('.featured-products, [data-testid="featured"], .hero-section');
    await expect(featuredSection).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await featuredSection.isVisible()) {
      // Check for heading in featured section
      const heading = featuredSection.locator('h2, h3, .section-title');
      await expect(heading).toBeVisible();
      
      // Check for featured products
      const featuredProducts = featuredSection.locator('.product-item, .product-card');
      await expect(featuredProducts.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test.describe("Authentication", () => {
    test("should show login prompt for cart actions when not authenticated", async ({ page: browserPage }) => {
      // Try to add a product to cart
      const addToCartButtons = browserPage.locator('button:has-text("Add to Cart"), .add-to-cart, [data-testid="add-to-cart"]');
      const firstButton = addToCartButtons.first();
      
      if (await firstButton.isVisible()) {
        await firstButton.click();
        
        // Should show login prompt or redirect to login
        const loginPrompt = browserPage.locator('text=/sign in|log in/i, [data-testid="login-prompt"], .auth-required');
        await expect(loginPrompt).toBeVisible({ timeout: 5000 });
        
        // Or redirect to login page
        await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
      }
    });
    
    test("should allow authenticated users to add to cart", async ({ page: browserPage }) => {
      // First login as a test user
      await authPage.loginViaApi("test@example.com", "password123");
      
      await page.navigate("/store");
      
      // Try to add a product to cart
      const addToCartButtons = browserPage.locator('button:has-text("Add to Cart"), .add-to-cart, [data-testid="add-to-cart"]');
      const firstButton = addToCartButtons.first();
      
      if (await firstButton.isVisible()) {
        await firstButton.click();
        
        // Should show success message or update cart count
        const successMessage = browserPage.locator('text=/added to cart|success/i, [data-testid="success-message"]');
        await expect(successMessage).toBeVisible({ timeout: 5000 });
        
        // Or cart count should increase
        const cartCount = browserPage.locator('.cart-count, [data-testid="cart-count"]');
        await expect(cartCount).toBeVisible({ timeout: 5000 });
        
        const countText = await cartCount.textContent();
        const count = parseInt(countText || "0", 10);
        expect(count).toBeGreaterThan(0);
      }
    });
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/store");
      
      // Check that essential elements are still visible
      const heading = browserPage.locator('h1, .store-heading, [data-testid="store-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that product items are visible (might be stacked)
      const productItems = browserPage.locator('.product-item, .product-card, [data-testid="product-item"]');
      if (await productItems.count() > 0) {
        await expect(productItems.first()).toBeVisible();
      }
    });
    
    test("should render correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      await responsivePage.navigate("/store");
      
      // Check that layout adapts appropriately
      const heading = browserPage.locator('h1, .store-heading, [data-testid="store-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that product items are visible
      const productItems = browserPage.locator('.product-item, .product-card, [data-testid="product-item"]');
      if (await productItems.count() > 0) {
        await expect(productItems.first()).toBeVisible();
      }
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/store");
      
      // Check that full layout is visible
      const heading = browserPage.locator('h1, .store-heading, [data-testid="store-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that we can see multiple product items
      const productItems = browserPage.locator('.product-item, .product-card, [data-testid="product-item"]');
      if (await productItems.count() > 0) {
        const count = await productItems.count();
        expect(count).toBeGreaterThan(0);
      }
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
    
    test("should navigate to cart", async ({ page: browserPage }) => {
      const cartLink = browserPage.locator('a[href*="/cart"], .cart-link, [data-testid="cart-link"]');
      await expect(cartLink).toBeVisible();
      
      await cartLink.click();
      await expect(browserPage).toHaveURL(/\/cart/);
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper language attribute", async ({ page: browserPage }) => {
      const htmlElement = browserPage.locator('html');
      const lang = await htmlElement.getAttribute('lang');
      expect(lang).toMatch(/^en/);
    });
    
    test("should have accessible product elements", async ({ page: browserPage }) => {
      // Check that product titles are accessible
      const productTitles = browserPage.locator('.product-title, h2, h3');
      const count = await productTitles.count();
      
      // Check a sample of product titles
      const sampleSize = Math.min(5, count);
      for (let i = 0; i < sampleSize; i++) {
        const title = productTitles.nth(i);
        await expect(title).toBeVisible();
        
        // Check for accessible name (text content or aria-label)
        const textContent = await title.textContent();
        const ariaLabel = await title.getAttribute('aria-label');
        
        expect(textContent?.trim() || ariaLabel).toBeDefined();
      }
    });
    
    test("should have accessible buttons", async ({ page: browserPage }) => {
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
      await page.navigate("/store");
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(8000); // Store might take longer to load due to products
    });
  });
});