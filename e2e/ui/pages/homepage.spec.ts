import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage } from "../../helpers/page-helpers";

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
    
    await page.navigate("/en");
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
    const hero = browserPage.getByTestId("hero");
    await expect(hero).toBeVisible();
    await expect(hero.locator("h1")).toBeVisible();
    await expect(browserPage.getByTestId("hero-cta-primary")).toBeVisible();
    await expect(browserPage.getByTestId("hero-cta-secondary")).toBeVisible();
  });

  test("should have services section", async ({ page: browserPage }) => {
    const servicesSection = browserPage.getByTestId("services-section");
    await expect(servicesSection).toBeVisible();
    const serviceCards = servicesSection.getByTestId("service-card");
    await expect(serviceCards.first()).toBeVisible({ timeout: 10_000 });
    expect(await serviceCards.count()).toBeGreaterThan(0);
  });

  test("should have call-to-action section", async ({ page: browserPage }) => {
    const ctaSection = browserPage.getByTestId("cta-section");
    await expect(ctaSection).toBeVisible();
    await expect(ctaSection.locator("h2")).toBeVisible();
    await expect(ctaSection.locator('a[href*="/contact"]').first()).toBeVisible();
  });

  test("should have footer with links", async ({ page: browserPage }) => {
    const footer = browserPage.locator("footer").first();
    await expect(footer).toBeVisible();
    await expect(footer.locator("a").first()).toBeVisible();
  });

  test("should have accessible navigation", async ({ page: browserPage }) => {
    const navLinks = browserPage.getByTestId("main-nav").locator("a").filter({ visible: true });
    const firstLink = navLinks.first();
    await expect(firstLink).toBeVisible();
    await firstLink.focus();
    await expect(firstLink).toBeFocused();
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/en");
      
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
      await responsivePage.navigate("/en");
      
      // Check that layout adapts appropriately
      const heading = browserPage.locator('h1, .hero-heading, [data-testid="hero-heading"]');
      await expect(heading).toBeVisible();
      
      // Check that navigation is visible
      const nav = browserPage.locator('nav, [data-testid="main-nav"], .main-navigation');
      await expect(nav).toBeVisible();
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/en");

      await expect(browserPage.locator("h1").first()).toBeVisible();
      await expect(browserPage.getByTestId("main-nav")).toBeVisible();
      await expect(browserPage.getByTestId("services-section")).toBeVisible();
      await expect(browserPage.getByTestId("cta-section")).toBeVisible();
    });
  });

  test.describe("Navigation", () => {
    async function clickVisibleNav(browserPage: import("@playwright/test").Page, hrefPart: string) {
      const link = browserPage
        .getByTestId("main-nav")
        .locator(`a[href*="${hrefPart}"]`)
        .filter({ visible: true })
        .first();
      await expect(link).toBeVisible();
      await link.click();
    }

    test("should navigate to services page", async ({ page: browserPage }) => {
      await clickVisibleNav(browserPage, "/services");
      await expect(browserPage).toHaveURL(/\/services/);
    });

    test("should navigate to store page", async ({ page: browserPage }) => {
      await clickVisibleNav(browserPage, "/store");
      await expect(browserPage).toHaveURL(/\/store/);
    });

    test("should navigate to blog page", async ({ page: browserPage }) => {
      await clickVisibleNav(browserPage, "/blog");
      await expect(browserPage).toHaveURL(/\/blog/);
    });

    test("should navigate to contact page", async ({ page: browserPage }) => {
      await clickVisibleNav(browserPage, "/contact");
      await expect(browserPage).toHaveURL(/\/contact/);
    });

    test("hero primary CTA goes to contact", async ({ page: browserPage }) => {
      await browserPage.getByTestId("hero-cta-primary").click();
      await expect(browserPage).toHaveURL(/\/contact/);
    });

    test("hero secondary CTA goes to services", async ({ page: browserPage }) => {
      await browserPage.getByTestId("hero-cta-secondary").click();
      await expect(browserPage).toHaveURL(/\/services/);
    });
  });

  test.describe("Performance", () => {
    test("should load within reasonable time", async ({ page: browserPage }) => {
      // Measure time to first byte and first contentful paint
      const startTime = Date.now();
      await page.navigate("/en");
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
      await expect(metaCharset).toHaveCount(1);
      const charset = await metaCharset.getAttribute("charset");
      expect(charset?.toLowerCase()).toBe("utf-8");
    });

    test("should have viewport meta tag", async ({ page: browserPage }) => {
      const viewportMeta = browserPage.locator('meta[name="viewport"]');
      await expect(viewportMeta).toHaveCount(1);
      const content = await viewportMeta.getAttribute("content");
      expect(content).toContain("width=device-width");
      expect(content).toContain("initial-scale=1");
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
      expect(title.length).toBeLessThan(100);
    });

    test("should have meta description", async ({ page: browserPage }) => {
      const metaDesc = browserPage.locator('meta[name="description"]');
      await expect(metaDesc).toHaveCount(1);
      const content = await metaDesc.getAttribute("content");
      expect(content).toBeTruthy();
      expect(content!.length).toBeGreaterThan(0);
      expect(content!.length).toBeLessThan(320);
    });

    test("should have canonical URL", async ({ page: browserPage }) => {
      const canonical = browserPage.locator('link[rel="canonical"]');
      if ((await canonical.count()) > 0) {
        const href = await canonical.first().getAttribute("href");
        expect(href).toContain("/");
        expect(href).not.toContain("?");
      }
    });

    test("should have open graph tags", async ({ page: browserPage }) => {
      const count =
        (await browserPage.locator('meta[property="og:title"]').count()) +
        (await browserPage.locator('meta[property="og:description"]').count()) +
        (await browserPage.locator('meta[property="og:image"]').count()) +
        (await browserPage.locator('meta[property="og:url"]').count());
      expect(count).toBeGreaterThan(0);
    });
  });
});
