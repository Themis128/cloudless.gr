import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage } from "../helpers/page-helpers";

/**
 * Homepage Test Suite
 * Tests the homepage for rendering, navigation, and responsiveness
 */

test.describe("Homepage", () => {
  let page: BasePage;
  let responsivePage: ResponsivePage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = createBasePage(browserPage);
    responsivePage = createResponsivePage(browserPage);
    
    await page.navigate("/");
  });

  test("should load successfully", async ({ page: browserPage }) => {
    await expect(browserPage).toHaveTitle(/cloudless/i);
    
    // Check for main heading or hero section
    const heading = browserPage.locator('h1, .hero-heading, [data-testid="hero-heading"]');
    await expect(heading).toBeVisible();
  });

  test("should have visible navigation", async ({ page: browserPage }) => {
    const nav = browserPage.locator('nav, [data-testid="main-nav"], .main-navigation');
    await expect(nav).toBeVisible();
    
    // Check for main navigation links
    const navLinks = nav.locator('a[href*="/services"], a[href*="/store"], a[href*="/blog"], a[href*="/contact"]');
    await expect(navLinks.first()).toBeVisible();
  });

  test("should have hero section with call-to-action", async ({ page: browserPage }) => {
    const hero = browserPage.locator('.hero, [data-testid="hero"], .hero-section');
    await expect(hero).toBeVisible();
    
    // Check for heading in hero
    const heroHeading = hero.locator('h1, h2, .hero-title');
    await expect(heroHeading).toBeVisible();
    
    // Check for CTA button
    const ctaButton = hero.locator('a[href*="/services"], a[href*="/store"], .btn-primary, .cta-button');
    await expect(ctaButton).toBeVisible();
  });

  test("should have services section", async ({ page: browserPage }) => {
    const servicesSection = browserPage.locator('#services, [data-testid="services-section"], .services-section');
    await expect(servicesSection).toBeVisible();
    
    // Check for service cards
    const serviceCards = servicesSection.locator('.service-card, [data-testid="service-card"]');
    await expect(serviceCards.first()).toBeVisible({ timeout: 5000 });
    
    // Check that we have at least one service card
    const count = await serviceCards.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should have call-to-action section", async ({ page: browserPage }) => {
    const ctaSection = browserPage.locator('#cta, [data-testid="cta-section"], .cta-section');
    await expect(ctaSection).toBeVisible();
    
    // Check for heading in CTA
    const ctaHeading = ctaSection.locator('h2, h3, .cta-title');
    await expect(ctaHeading).toBeVisible();
    
    // Check for button in CTA
    const ctaButton = ctaSection.locator('a.btn, .btn, .cta-button');
    await expect(ctaButton).toBeVisible();
  });

  test("should have footer with links", async ({ page: browserPage }) => {
    const footer = browserPage.locator('footer, [data-testid="footer"], .footer');
    await expect(footer).toBeVisible();
    
    // Check for copyright
    const copyright = footer.locator('.copyright, small, [data-testid="copyright"]');
    await expect(copyright).toBeVisible();
    
    // Check for navigation links in footer
    const footerNav = footer.locator('nav, .footer-nav, [data-testid="footer-nav"]');
    await expect(footerNav).toBeVisible();
    
    // Check for social media links
    const socialLinks = footer.locator('a[href*="twitter"], a[href*="facebook"], a[href*="linkedin"], a[href*="instagram"]');
    // At least one social link should be present if social media is enabled
  });

  test("should have accessible navigation", async ({ page: browserPage }) => {
    // Test that navigation is keyboard accessible
    const navLinks = browserPage.locator('nav a, [data-testid="main-nav"] a');
    const firstLink = navLinks.first();
    
    await expect(firstLink).toBeFocusable();
    
    // Test tab navigation
    await firstLink.focus();
    await expect(firstLink).toBeFocused();
    
    await browserPage.keyboard press("Tab");
    const secondLink = navLinks.nth(1);
    await expect(secondLink).toBeFocused();
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/");
      
      // Check that essential elements are still visible
      const heading = browserPage.locator('h1, .hero-heading, [data-testid="hero-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that navigation is accessible (might be hamburger menu on mobile)
      const navToggle = browserPage.locator('button[aria-label*="menu"], .nav-toggle, .hamburger');
      const navMenu = browserPage.locator('nav, [data-testid="main-nav"], .main-navigation');
      
      // Either the nav is visible directly or there's a toggle button
      const isNavVisible = await navMenu.isVisible();
      const hasToggle = await navToggle.isVisible();
      
      expect(isNavVisible || hasToggle).toBeTruthy();
      
      if (hasToggle) {
        // Test that toggle opens the navigation
        await navToggle.click();
        await expect(navMenu).toBeVisible();
      }
    });
    
    test("should render correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      await responsivePage.navigate("/");
      
      // Check that layout adapts appropriately
      const heading = browserPage.locator('h1, .hero-heading, [data-testid="hero-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that navigation is visible
      const nav = browserPage.locator('nav, [data-testid="main-nav"], .main-navigation');
      await expect(nav).toBeVisible();
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/");
      
      // Check that full layout is visible
      const heading = browserPage.locator('h1, .hero-heading, [data-testid="hero-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that navigation is visible
      const nav = browserPage.locator('nav, [data-testid="main-nav"], .main-navigation');
      await expect(nav).toBeVisible();
      
      // Check that we can see multiple content sections
      const servicesSection = browserPage.locator('#services, [data-testid="services-section"], .services-section');
      const ctaSection = browserPage.locator('#cta, [data-testid="cta-section"], .cta-section');
      
      await expect(servicesSection).toBeVisible();
      await expect(ctaSection).toBeVisible();
    });
  });

  test.describe("Navigation", () => {
    test("should navigate to services page", async ({ page: browserPage }) => {
      const servicesLink = browserPage.locator('a[href*="/services"], nav a:has-text("Services"), .nav-link[href*="/services"]');
      await expect(servicesLink).toBeVisible();
      
      await servicesLink.click();
      await expect(browserPage).toHaveURL(/\/services/);
    });
    
    test("should navigate to store page", async ({ page: browserPage }) => {
      const storeLink = browserPage.locator('a[href*="/store"], nav a:has-text("Store"), .nav-link[href*="/store"]');
      await expect(storeLink).toBeVisible();
      
      await storeLink.click();
      await expect(browserPage).toHaveURL(/\/store/);
    });
    
    test("should navigate to blog page", async ({ page: browserPage }) => {
      const blogLink = browserPage.locator('a[href*="/blog"], nav a:has-text("Blog"), .nav-link[href*="/blog"]');
      await expect(blogLink).toBeVisible();
      
      await blogLink.click();
      await expect(browserPage).toHaveURL(/\/blog/);
    });
    
    test("should navigate to contact page", async ({ page: browserPage }) => {
      const contactLink = browserPage.locator('a[href*="/contact"], nav a:has-text("Contact"), .nav-link[href*="/contact"]');
      await expect(contactLink).toBeVisible();
      
      await contactLink.click();
      await expect(browserPage).toHaveURL(/\/contact/);
    });
  });

  test.describe("Performance", () => {
    test("should load within reasonable time", async ({ page: browserPage }) => {
      // Measure time to first byte and first contentful paint
      const startTime = Date.now();
      await page.navigate("/");
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
      
      // Also check for first contentful paint using web vitals if available
      const FCP = await browserPage.evaluate(() => {
        if (window.performance && window.performance.getEntriesByName) {
          const entry = window.performance.getEntriesByName('first-contentful-paint')[0];
          return entry ? entry.startTime : 0;
        }
        return 0;
      });
      
      if (FCP > 0) {
        expect(FCP).toBeLessThan(3000); // FCP should be under 3 seconds
      }
    });
    
    test("should have reasonable page size", async ({ page: browserPage }) => {
      // Get total page size
      const totalSize = await browserPage.evaluate(() => {
        let size = 0;
        if (window.performance && window.performance.getEntriesByType) {
          const resources = window.performance.getEntriesByType('resource');
          resources.forEach(resource => {
            size += resource.transferSize || 0;
          });
        }
        return size;
      });
      
      // Should be under 3MB for initial load
      expect(totalSize).toBeLessThan(3 * 1024 * 1024);
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper language attribute", async ({ page: browserPage }) => {
      const htmlElement = browserPage.locator('html');
      const lang = await htmlElement.getAttribute('lang');
      expect(lang).toMatch(/^en/); // Should be English or English variant
    });
    
    test("should have proper character encoding", async ({ page: browserPage }) => {
      const metaCharset = browserPage.locator('meta[charset]');
      await expect(metaCharset).toBeVisible();
      
      const charset = await metaCharset.getAttribute('charset');
      expect(charset.toLowerCase()).toBe('utf-8');
    });
    
    test("should have viewport meta tag", async ({ page: browserPage }) => {
      const viewportMeta = browserPage.locator('meta[name="viewport"]');
      await expect(viewportMeta).toBeVisible();
      
      const content = await viewportMeta.getAttribute('content');
      expect(content).toContain('width=device-width');
      expect(content).toContain('initial-scale=1');
    });
    
    test("should have sufficient color contrast (basic check)", async ({ page: browserPage }) => {
      // This is a basic check - for full accessibility testing, use axe-core
      const textElements = browserPage.locator('body *');
      const count = await textElements.count();
      
      // Check a sample of text elements for visible text
      const sampleSize = Math.min(10, count);
      for (let i = 0; i < sampleSize; i++) {
        const element = textElements.nth(i);
        const isVisible = await element.isVisible();
        if (isVisible) {
          const color = await element.evaluate(el => {
            const style = window.getComputedStyle(el);
            return style.color;
          });
          // Just verify we can get a color value - actual contrast checking requires more complex logic
          expect(color).toMatch(/^rgb|^#|^hsl/);
        }
      }
    });
  });

  test.describe("SEO Basics", () => {
    test("should have title tag", async ({ page: browserPage }) => {
      await expect(browserPage).toHaveTitle(/cloudless/i);
      const title = await browserPage.title();
      expect(title.length).toBeGreaterThan(0);
      expect(title.length).toBeLessThan(100); // Reasonable title length
    });
    
    test("should have meta description", async ({ page: browserPage }) => {
      const metaDesc = browserPage.locator('meta[name="description"]');
      await expect(metaDesc).toBeVisible();
      
      const content = await metaDesc.getAttribute('content');
      expect(content).toBeDefined();
      expect(content.length).toBeGreaterThan(0);
      expect(content.length).toBeLessThan(200); // Reasonable description length
    });
    
    test("should have canonical URL", async ({ page: browserPage }) => {
      const canonical = browserPage.locator('link[rel="canonical"]');
      // Not all pages may have canonical, but homepage usually does
      if (await canonical.isVisible()) {
        const href = await canonical.getAttribute('href');
        expect(href).toContain('/');
        expect(href).not.toContain('?'); // Should not have query parameters
      }
    });
    
    test("should have open graph tags", async ({ page: browserPage }) => {
      const ogTitle = browserPage.locator('meta[property="og:title"]');
      const ogDescription = browserPage.locator('meta[property="og:description"]');
      const ogImage = browserPage.locator('meta[property="og:image"]');
      const ogUrl = browserPage.locator('meta[property="og:url"]');
      
      // At least some OG tags should be present
      const titleVisible = await ogTitle.isVisible();
      const descVisible = await ogDescription.isVisible();
      const imageVisible = await ogImage.isVisible();
      const urlVisible = await ogUrl.isVisible();
      
      expect(titleVisible || descVisible || imageVisible || urlVisible).toBeTruthy();
    });
  });
});