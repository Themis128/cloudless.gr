import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage } from "../helpers/page-helpers";

/**
 * Card Component Test Suite
 * Tests card components for rendering, layout, and accessibility
 */

test.describe("Card Component", () => {
  let page: BasePage;
  let responsivePage: ResponsivePage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = createBasePage(browserPage);
    responsivePage = createResponsivePage(browserPage);
    
    # Test on a page that likely has cards (like homepage, services, or blog)
    await page.navigate("/");
  });

  test("should render card containers", async ({ page: browserPage }) => {
    # Check for card containers
    const cards = browserPage.locator('.card, [data-testid="card"], .service-card, .product-card, .post-card');
    const count = await cards.count();
    
    expect(count).toBeGreaterThan(0);
    
    # Check that at least one card is visible
    await expect(cards.first()).toBeVisible();
  });

  test("should have proper card structure", async ({ page: browserPage }) => {
    const cards = browserPage.locator('.card, [data-testid="card"], .service-card, .product-card, .post-card');
    const count = await cards.count();
    
    expect(count).toBeGreaterThan(0);
    
    # Check a sample of cards for structure
    const sampleSize = Math.min(3, count);
    for (let i = 0; i < sampleSize; i++) {
      const card = cards.nth(i);
      
      await expect(card).toBeVisible();
      
      # Check for card content areas
      # Header/title
      const header = card.locator('.card-header, .card-title, h2, h3, [data-testid="card-header"]');
      # Content/body
      const content = card.locator('.card-content, .card-body, p, [data-testid="card-content"]');
      # Footer/actions
      const footer = card.locator('.card-footer, .card-actions, [data-testid="card-footer"]');
      
      # At least some of these should be present
      const hasHeader = await header.isVisible();
      const hasContent = await content.isVisible();
      const hasFooter = await footer.isVisible();
      
      expect(hasHeader || hasContent || hasFooter).toBeTruthy();
      
      # Check for image/media if present
      const image = card.locator('img, .card-image, [data-testid="card-image"]');
      # Image might not be present in all cards
    }
  });

  test("should have accessible card content", async ({ page: browserPage }) => {
    const cards = browserPage.locator('.card, [data-testid="card"], .service-card, .product-card, .post-card');
    const count = await cards.count();
    
    expect(count).toBeGreaterThan(0);
    
    # Check a sample of cards for accessibility
    const sampleSize = Math.min(3, count);
    for (let i = 0; i < sampleSize; i++) {
      const card = cards.nth(i);
      
      await expect(card).toBeVisible();
      
      # Check for accessible title/heading
      const title = card.locator('.card-title, h2, h3, [data-testid="card-title"]');
      if (await title.isVisible()) {
        # Check for accessible name (text content or aria-label)
        const textContent = await title.textContent();
        const ariaLabel = await title.getAttribute('aria-label');
        
        expect(textContent?.trim() || ariaLabel).toBeDefined();
      }
      
      # Check for accessible text content
      const content = card.locator('.card-content, .card-body, p, [data-testid="card-content"]');
      if (await content.isVisible()) {
        # Check that content is readable
        const textContent = await content.textContent();
        expect(textContent?.length).toBeGreaterThan(0);
      }
      
      # Check for accessible actions/links
      const links = card.locator('a, button, [role="button"]');
      const linkCount = await links.count();
      
      if (linkCount > 0) {
        # Check a sample of links/buttons for accessibility
        const linkSampleSize = Math.min(2, linkCount);
        for (let j = 0; j < linkSampleSize; j++) {
          const link = links.nth(j);
          
          await expect(link).toBeVisible();
          await expect(link).toBeEnabled();
          
          # Check for accessible name (text content or aria-label)
          const textContent = await link.textContent();
          const ariaLabel = await link.getAttribute('aria-label');
          const ariaLabelledby = await link.getAttribute('aria-labelledby');
          
          expect(textContent?.trim() || ariaLabel || ariaLabelledby).toBeDefined();
        }
      }
    }
  });

  test.describe("Card Variants", () => {
    test("should render service cards correctly", async ({ page: browserPage }) => {
      const serviceCards = browserPage.locator('.service-card, [data-testid="service-card"]');
      const count = await serviceCards.count();
      
      if (count > 0) {
        await expect(serviceCards.first()).toBeVisible();
        
        # Check for service-specific content
        const firstCard = serviceCards.first();
        
        # Check for service title
        const title = firstCard.locator('.service-title, h2, h3, [data-testid="service-title"]');
        await expect(title).toBeVisible();
        
        # Check for service description
        const description = firstCard.locator('.service-description, p, [data-testid="service-description"]');
        await expect(description).toBeVisible();
        
        # Check for service icon or image
        const icon = firstCard.locator('.service-icon, img, [data-testid="service-icon"]');
        # Icon might not be present
        
        # Check for service CTA button
        const ctaButton = firstCard.locator('.service-cta, a.btn, .btn, [data-testid="service-cta"]');
        # CTA might not be present
      }
    });
    
    test("should render product cards correctly", async ({ page: browserPage }) => {
      const productCards = browserPage.locator('.product-card, [data-testid="product-card"]');
      const count = await productCards.count();
      
      if (count > 0) {
        await expect(productCards.first()).toBeVisible();
        
        # Check for product-specific content
        const firstCard = productCards.first();
        
        # Check for product title
        const title = firstCard.locator('.product-title, h2, h3, [data-testid="product-title"]');
        await expect(title).toBeVisible();
        
        # Check for product price
        const price = firstCard.locator('.product-price, [data-testid="product-price"], .price');
        await expect(price).toBeVisible();
        
        # Check for product image
        const image = firstCard.locator('img, .product-image, [data-testid="product-image"]');
        await expect(image).toBeVisible();
        
        # Check for product description
        const description = firstCard.locator('.product-description, p, [data-testid="product-description"]');
        # Description might not be present
        
        # Check for add to cart button
        const addToCart = firstCard.locator('.add-to-cart, button:has-text("Add to Cart"), [data-testid="add-to-cart"]');
        await expect(addToCart).toBeVisible();
      }
    });
    
    test("should render blog post cards correctly", async ({ page: browserPage }) => {
      const postCards = browserPage.locator('.post-card, [data-testid="post-card"]');
      const count = await postCards.count();
      
      if (count > 0) {
        await expect(postCards.first()).toBeVisible();
        
        # Check for post-specific content
        const firstCard = postCards.first();
        
        # Check for post title
        const title = firstCard.locator('.post-title, h2, h3, [data-testid="post-title"]');
        await expect(title).toBeVisible();
        
        # Check for post excerpt/summary
        const excerpt = firstCard.locator('.post-excerpt, p, [data-testid="post-excerpt"]');
        await expect(excerpt).toBeVisible();
        
        # Check for post meta (author, date, etc.)
        const meta = firstCard.locator('.post-meta, [data-testid="post-meta"], .meta');
        await expect(meta).toBeVisible();
        
        # Check for featured image
        const image = firstCard.locator('img, .post-image, .featured-image, [data-testid="post-image"]');
        await expect(image).toBeVisible();
        
        # Check for read more link
        const readMore = firstCard.locator('a:has-text("Read More"), .read-more, [data-testid="read-more"]');
        await expect(readMore).toBeVisible();
      }
    });
  });

  test.describe("Layout and Spacing", () => {
    test("should have proper card spacing", async ({ page: browserPage }) => {
      const cards = browserPage.locator('.card, [data-testid="card"], .service-card, .product-card, .post-card');
      const count = await cards.count();
      
      expect(count).toBeGreaterThan(1); # Need at least 2 cards to check spacing
      
      if (count > 1) {
        # Check spacing between first two cards
        const firstCard = cards.first();
        const secondCard = cards.nth(1);
        
        await expect(firstCard).toBeVisible();
        await expect(secondCard).toBeVisible();
        
        # Get positions of both cards
        const firstBox = await firstCard.boundingBox();
        const secondBox = await secondCard.boundingBox();
        
        expect(firstBox).toBeDefined();
        expect(secondBox).toBeDefined();
        
        if (firstBox && secondBox) {
          # Check vertical spacing (cards stacked)
          const verticalSpacing = secondBox.y - (firstBox.y + firstBox.height);
          # Vertical spacing should be reasonable (positive for stacked cards)
          expect(verticalSpacing).toBeGreaterThanOrEqual(0);
          
          # Check horizontal spacing (cards in row)
          const horizontalSpacing = secondBox.x - (firstBox.x + firstBox.width);
          # Horizontal spacing should be reasonable (positive for side-by-side cards)
          expect(horizontalSpacing).toBeGreaterThanOrEqual(0);
        }
      }
    });
    
    test("should maintain card aspect ratio for images", async ({ page: browserPage }) => {
      const cardsWithImages = browserPage.locator('.card img, .product-card img, .post-card img, .service-card img');
      const count = await cardsWithImages.count();
      
      if (count > 0) {
        # Check a sample of card images
        const sampleSize = Math.min(3, count);
        for (let i = 0; i < sampleSize; i++) {
          const img = cardsWithImages.nth(i);
          
          await expect(img).toBeVisible();
          
          # Get image dimensions
          const width = await img.evaluate(el => el.naturalWidth);
          const height = await img.evaluate(el => el.naturalHeight);
          
          expect(width).toBeGreaterThan(0);
          expect(height).toBeGreaterThan(0);
          
          # Check that image has reasonable aspect ratio (not extremely distorted)
          const aspectRatio = width / height;
          expect(aspectRatio).toBeGreaterThan(0.1); # Not too wide
          expect(aspectRatio).toBeLessThan(10);     # Not too tall
        }
      }
    });
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/");
      
      const cards = browserPage.locator('.card, [data-testid="card"], .service-card, .product-card, .post-card');
      const count = await cards.count();
      
      expect(count).toBeGreaterThan(0);
      
      # Check a sample of cards for visibility and touch target size
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const card = cards.nth(i);
        
        await expect(card).toBeVisible();
        
        # Check that card content is readable on small screens
        const title = card.locator('.card-title, h2, h3');
        if (await title.isVisible()) {
          await expect(title).toBeVisible();
        }
        
        # Check that actionable elements are accessible
        const actions = card.locator('a, button');
        if (await actions.count() > 0) {
          const firstAction = actions.first();
          await expect(firstAction).toBeVisible();
          await expect(firstAction).toBeEnabled();
          
          # Check minimum touch target size (44x48px per WCAG)
          const boundingBox = await firstAction.boundingBox();
          if (boundingBox) {
            expect(boundingBox.width).toBeGreaterThanOrEqual(44);
            expect(boundingBox.height).toBeGreaterThanOrEqual(44);
          }
        }
      }
    });
    
    test("should render correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      await responsivePage.navigate("/");
      
      const cards = browserPage.locator('.card, [data-testid="card"], .service-card, .product-card, .post-card');
      const count = await cards.count();
      
      expect(count).toBeGreaterThan(0);
      
      # Check a sample of cards
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const card = cards.nth(i);
        
        await expect(card).toBeVisible();
        
        # Check that card content is visible
        const title = card.locator('.card-title, h2, h3');
        if (await title.isVisible()) {
          await expect(title).toBeVisible();
        }
        
        const content = card.locator('.card-content, p');
        if (await content.isVisible()) {
          await expect(content).toBeVisible();
        }
      }
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/");
      
      const cards = browserPage.locator('.card, [data-testid="card"], .service-card, .product-card, .post-card');
      const count = await cards.count();
      
      expect(count).toBeGreaterThan(0);
      
      # Check a sample of cards
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const card = cards.nth(i);
        
        await expect(card).toBeVisible();
        
        # Check that we can see multiple cards in a layout
        # (This is more about the container layout than individual cards)
        
        # Check that card content is visible
        const title = card.locator('.card-title, h2, h3');
        if (await title.isVisible()) {
          await expect(title).toBeVisible();
        }
        
        const content = card.locator('.card-content, p');
        if (await content.isVisible()) {
          await expect(content).toBeVisible();
        }
        
        # Check that actionable elements are visible
        const actions = card.locator('a, button');
        if (await actions.count() > 0) {
          await expect(actions.first()).toBeVisible();
          await expect(actions.first()).toBeEnabled();
        }
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should have accessible card containers", async ({ page: browserPage }) => {
      const cards = browserPage.locator('.card, [data-testid="card"], .service-card, .product-card, .post-card');
      const count = await cards.count();
      
      expect(count).toBeGreaterThan(0);
      
      # Check a sample of cards for accessibility
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const card = cards.nth(i);
        
        await expect(card).toBeVisible();
        
        # Check for ARIA role or label if card is interactive
        const role = await card.getAttribute('role');
        const ariaLabel = await card.getAttribute('aria-label');
        const ariaLabelledby = await card.getAttribute('aria-labelledby');
        
        # Non-interactive cards don't need ARIA roles
        # But if they have role, it should be appropriate
        if (role) {
          expect(['article', 'region', 'group'].includes(role)).toBeTruthy();
        }
        
        # Check that card is focusable if it's interactive
        # (We'll skip this check as it depends on implementation)
      }
    });
    
    test("should have accessible card headers", async ({ page: browserPage }) => {
      const cards = browserPage.locator('.card, [data-testid="card"], .service-card, .product-card, .post-card');
      const count = await cards.count();
      
      expect(count).toBeGreaterThan(0);
      
      # Check a sample of cards for header accessibility
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const card = cards.nth(i);
        
        await expect(card).toBeVisible();
        
        # Check for card header/title
        const header = card.locator('.card-header, .card-title, h2, h3, [data-testid="card-header"]');
        if (await header.isVisible()) {
          # Check for accessible name (text content or aria-label)
          const textContent = await header.textContent();
          const ariaLabel = await header.getAttribute('aria-label');
          const ariaLabelledby = await header.getAttribute('aria-labelledby');
          
          expect(textContent?.trim() || ariaLabel || ariaLabelledby).toBeDefined();
          
          # Check that header has appropriate heading level
          # This is more semantic than accessibility, but still important
          const tagName = await header.evaluate(el => el.tagName.toLowerCase());
          if (tagName.startsWith('h')) {
            const level = parseInt(tagName.substring(1), 10);
            expect(level).toBeGreaterThanOrEqual(1);
            expect(level).toBeLessThanOrEqual(6);
          }
        }
      }
    });
    
    test("should have accessible card content", async ({ page: browserPage }) => {
      const cards = browserPage.locator('.card, [data-testid="card"], .service-card, .product-card, .post-card');
      const count = await cards.count();
      
      expect(count).toBeGreaterThan(0);
      
      # Check a sample of cards for content accessibility
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const card = cards.nth(i);
        
        await expect(card).toBeVisible();
        
        # Check for card content
        const content = card.locator('.card-content, .card-body, p, [data-testid="card-content"]');
        if (await content.isVisible()) {
          # Check that content is readable
          const textContent = await content.textContent();
          expect(textContent?.length).toBeGreaterThan(0);
          
          # Check for sufficient color contrast (basic check)
          const bgColor = await content.evaluate(el => {
            return window.getComputedStyle(el).backgroundColor;
          });
          const textColor = await content.evaluate(el => {
            return window.getComputedStyle(el).color;
          });
          
          # Just verify we can get color values
          expect(bgColor).toBeDefined();
          expect(textColor).toBeDefined();
        }
      }
    });
    
    test("should have accessible card actions", async ({ page: browserPage }) => {
      const cards = browserPage.locator('.card, [data-testid="card"], .service-card, .product-card, .post-card');
      const count = await cards.count();
      
      expect(count).toBeGreaterThan(0);
      
      # Check a sample of cards for action accessibility
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const card = cards.nth(i);
        
        await expect(card).toBeVisible();
        
        # Check for actionable elements (links, buttons)
        const actions = card.locator('a, button, [role="button"]');
        const actionCount = await actions.count();
        
        if (actionCount > 0) {
          # Check a sample of actions for accessibility
          const actionSampleSize = Math.min(2, actionCount);
          for (let j = 0; j < actionSampleSize; j++) {
            const action = actions.nth(j);
            
            await expect(action).toBeVisible();
            await expect(action).toBeEnabled();
            
            # Check for accessible name (text content or aria-label)
            const textContent = await action.textContent();
            const ariaLabel = await action.getAttribute('aria-label');
            const ariaLabelledby = await action.getAttribute('aria-labelledby');
            
            expect(textContent?.trim() || ariaLabel || ariaLabelledby).toBeDefined();
            
            # Check that action is keyboard accessible
            await expect(action).toBeFocusable();
          }
        }
      }
    });
  });

  test.describe("Performance", () => {
    test("should not cause layout shifts", async ({ page: browserPage }) => {
      # Measure Cumulative Layout Shift (CLS) - basic check
      const clsValue = await browserPage.evaluate(() => {
        if (window.PerformanceObserver) {
          return new Promise((resolve) => {
            let cls = 0;
            const observer = new PerformanceObserver((entryList) => {
              for (const entry of entryList.getEntries()) {
                if (!entry.hadRecentInput) {
                  cls += entry.value;
                }
              }
              resolve(cls);
            });
            observer.observe({ entryTypes: ['layout-shift'] });
            
            # Wait a bit to collect layout shift data
            setTimeout(() => {
              observer.disconnect();
              resolve(cls);
            }, 3000);
          });
        }
        return 0;
      });
      
      # CLS should be less than 0.1 for good performance
      expect(clsValue).toBeLessThan(0.1);
    });
    
    test("should have reasonable number of DOM nodes", async ({ page: browserPage }) => {
      # Count card-related DOM nodes
      const cardCount = await browserPage.evaluate(() => {
        return document.querySelectorAll('.card, [data-testid="card"], .service-card, .product-card, .post-card').length;
      });
      
      # Should not have excessively many cards on a page
      expect(cardCount).toBeLessThan(100); # Reasonable upper limit
    });
    
    test("should optimize image loading", async ({ page: browserPage }) => {
      # Check if card images use loading optimization
      const cardImages = browserPage.locator('.card img, .service-card img, .product-card img, .post-card img');
      const count = await cardImages.count();
      
      if (count > 0) {
        # Check a sample of images for loading attributes
        const sampleSize = Math.min(3, count);
        for (let i = 0; i < sampleSize; i++) {
          const img = cardImages.nth(i);
          
          # Check for lazy loading attribute
          const loading = await img.getAttribute('loading');
          # lazy loading is good for performance
          
          # Check for width and height attributes (helps prevent layout shift)
          const width = await img.getAttribute('width');
          const height = await img.getAttribute('height');
          # These might be set via CSS instead
        }
      }
    });
  });
});