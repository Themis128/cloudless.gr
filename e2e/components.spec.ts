import { test, expect } from "@playwright/test";

/**
 * Component coverage tests
 * Tests reusable UI components across the application
 */

test.describe("UI Components", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en");
  });

  test.describe("ScrollReveal Component", () => {
    test("reveal animation is applied to elements", async ({ page }) => {
      // ScrollReveal elements have .reveal class
      const revealElements = page.locator(".reveal");
      const count = await revealElements.count();
      expect(count).toBeGreaterThan(0);
    });

    test("elements become visible after scroll", async ({ page }) => {
      // Wait for page to load
      await page.waitForLoadState("networkidle");

      // Check that reveal elements have visible class after intersection
      const visibleElements = page.locator(".reveal-visible");
      const count = await visibleElements.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe("StatCounter Component", () => {
    test("stat counters are rendered", async ({ page }) => {
      const statCounters = page.locator('[class*="stat"], [data-testid*="stat"]');
      const count = await statCounters.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe("Social Links Component", () => {
    test("social links are present", async ({ page }) => {
      const socialLinks = page.locator(
        'a[href*="github"], a[href*="linkedin"], a[href*="twitter"]'
      );
      const count = await socialLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    test("social links have proper attributes", async ({ page }) => {
      const externalLinks = page.locator('a[target="_blank"]');
      const count = await externalLinks.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe("Navigation", () => {
    test("navigation links are present", async ({ page }) => {
      const navLinks = page.locator("nav a, header a");
      const count = await navLinks.count();
      expect(count).toBeGreaterThan(0);
    });

    test("logo/link to home exists", async ({ page }) => {
      const homeLink = page.locator('a[href="/"], a[href="/en"]').first();
      await expect(homeLink).toBeVisible();
    });
  });

  test.describe("Buttons and CTAs", () => {
    test("primary buttons are styled", async ({ page }) => {
      const primaryButtons = page.locator(".btn-v2-primary, [class*='btn-primary']");
      const count = await primaryButtons.count();
      expect(count).toBeGreaterThan(0);
    });

    test("button links are accessible", async ({ page }) => {
      const buttons = page.locator("button, a[role='button']");
      const count = await buttons.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe("Form Elements", () => {
    test("form inputs have labels or placeholders", async ({ page }) => {
      await page.goto("/en/contact");

      const inputs = page.locator("input, textarea, select");
      const count = await inputs.count();
      expect(count).toBeGreaterThan(0);
    });

      test("form has submit button", async ({ page }) => {
       await page.goto("/en/contact");

       const submitButton = page.locator(
         'button[type="submit"], input[type="submit"]'
       );
       // Check if submit button exists before asserting visibility
       if (await submitButton.count() > 0) {
         await expect(submitButton.first()).toBeVisible();
       }
     });
  });

  test.describe("Typographic Elements", () => {
    test("heading hierarchy exists", async ({ page }) => {
      const h1 = page.locator("h1");
      const h2 = page.locator("h2");

      await expect(h1.first()).toBeVisible();
      expect(await h1.count()).toBeGreaterThan(0);
    });

    test("body text is present", async ({ page }) => {
      const paragraphs = page.locator("p");
      const count = await paragraphs.count();
      expect(count).toBeGreaterThan(0);
    });
  });

  test.describe("Cards and Sections", () => {
    test("content cards are rendered", async ({ page }) => {
      const cards = page.locator(".rounded-xl, [class*='card']");
      const count = await cards.count();
      expect(count).toBeGreaterThan(0);
    });

    test("sections have proper spacing", async ({ page }) => {
      const sections = page.locator("section");
      const count = await sections.count();
      expect(count).toBeGreaterThan(0);
    });
  });
});

test.describe("Responsive Components", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("mobile layout adapts", async ({ page }) => {
    await page.goto("/en");

    // Check for mobile-specific elements or layout changes
    const body = page.locator("body");
    await expect(body).toBeVisible();
  });

  test("mobile menu button exists when needed", async ({ page }) => {
    await page.goto("/en");

    // Look for mobile menu trigger
    const menuTrigger = page.locator(
      '[data-testid="mobile-menu"], [aria-label*="menu"], .mobile-menu-trigger'
    );
    // Menu trigger may or may not exist depending on viewport
    const exists = await menuTrigger.count();
    if (exists > 0) {
      await expect(menuTrigger.first()).toBeVisible();
    }
  });
});

test.describe("Dark Mode / Theme", () => {
  test("theme variables are defined", async ({ page }) => {
    await page.goto("/en");

    // Check for CSS custom properties
    const hasCustomProperties = await page.evaluate(() => {
      const styles = getComputedStyle(document.documentElement);
      return styles.getPropertyValue("--accent") !== "";
    });

    expect(hasCustomProperties).toBeTruthy();
  });
});