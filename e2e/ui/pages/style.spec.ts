import { test, expect } from "@playwright/test";

/**
 * Style Test Suite
 * Tests that the app pages adhere to the design system as defined in AGENTS.md
 */

test.describe("Style System", () => {
  // Expected colors from AGENTS.md
  const expectedColors = {
    void: "#0a0a0f",
    voidLight: "#12121a",
    voidLighter: "#1a1a2e",
    neonCyan: "#00fff5",
    neonMagenta: "#ff00ff",
    neonGreen: "#00ff41",
    neonBlue: "#4d7cff",
  };

  // Expected fonts from AGENTS.md
  const expectedFonts = {
    heading: "Instrument Sans",
    body: "Work Sans",
    code: "Geist Mono",
  };

  // Expected effect class names (based on AGENTS.md)
  const expectedEffects = [
    "scanlines",
    "cyber-grid",
    "neon-border",
    "glow-cyan",
    "dot-matrix",
  ];

  /**
   * Check if an element's computed color matches the expected color (within tolerance)
   */
  async function checkColor(
    page: Page,
    selector: string,
    colorProperty: "background-color" | "color" | "border-color",
    expectedColor: string
  ): Promise<void> {
    const actualColor = await page.$eval(
      selector,
      (el, prop) => {
        const computed = window.getComputedStyle(el);
        return computed.getPropertyValue(prop);
      },
      colorProperty
    );

    // Convert to rgb for comparison (since browsers may return rgb or rgba)
    const expectedRgb = hexToRgb(expectedColor);
    const actualRgb = cssColorToRgb(actualColor);

    // Allow small tolerance due to potential alpha or rendering differences
    expect(actualRgb.r).toBeCloseTo(expectedRgb.r, 0);
    expect(actualRgb.g).toBeCloseTo(expectedRgb.g, 0);
    expect(actualRgb.b).toBeCloseTo(expectedRgb.b, 0);
  }

  /**
   * Convert hex color to rgb object
   */
  function hexToRgb(hex: string): { r: number; g: number; b: number } {
    // Remove // if present
    const cleanHex = hex.replace("#", "");
    // Handle 3-digit hex
    if (cleanHex.length === 3) {
      return {
        r: parseInt(cleanHex[0] + cleanHex[0], 16),
        g: parseInt(cleanHex[1] + cleanHex[1], 16),
        b: parseInt(cleanHex[2] + cleanHex[2], 16),
      };
    }
    // Handle 6-digit hex
    return {
      r: parseInt(cleanHex.substring(0, 2), 16),
      g: parseInt(cleanHex.substring(2, 4), 16),
      b: parseInt(cleanHex.substring(4, 6), 16),
    };
  }

  /**
   * Convert CSS color string (rgb, rgba, hsl, etc.) to rgb object
   * This is a simplified converter that handles common cases.
   */
  function cssColorToRgb(cssColor: string): { r: number; g: number; b: number } {
    // Match rgb(r, g, b) or rgba(r, g, b, a)
    const rgbMatch = cssColor.match(
      /^rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*[\d.]+\s*)?\)$/
    );
    if (rgbMatch) {
      return {
        r: parseInt(rgbMatch[1]),
        g: parseInt(rgbMatch[2]),
        b: parseInt(rgbMatch[3]),
      };
    }

    // Match hex color
    const hexMatch = cssColor.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
    if (hexMatch) {
      return hexToRgb(cssColor);
    }

    // If we can't parse, return black (test will fail)
    return { r: 0, g: 0, b: 0 };
  }

  /**
   * Check if an element's computed font-family matches the expected font
   */
  async function checkFont(
    page: Page,
    selector: string,
    expectedFont: string
  ): Promise<void> {
    const actualFont = await page.$eval(
      selector,
      (el) => {
        const computed = window.getComputedStyle(el);
        return computed.getPropertyValue("font-family");
      }
    );

    // Font-family may contain multiple fallbacks and quotes
    // We check if the expected font is present in the string
    expect(actualFont).toContain(expectedFont);
  }

  /**
   * Check if an effect class is present on the page
   */
  async function checkEffectClass(
    page: Page,
    effectClass: string
  ): Promise<void> {
    const count = await page.$$eval(
      `.${effectClass}`,
      (elements) => elements.length
    );
    expect(count).toBeGreaterThan(0);
  }

  // Test pages
  const testPages = [
    { path: "/", name: "Homepage" },
    { path: "/services", name: "Services" },
    { path: "/store", name: "Store" },
    { path: "/blog", name: "Blog" },
    { path: "/contact", name: "Contact" },
  ];

  testPages.forEach(({ path, name }) => {
    test.describe(`${name} Style`, () => {
      test.beforeEach(async ({ page }) => {
        await page.goto(path);
        // Wait for network idle to ensure styles are applied
        await page.waitForLoadState("networkidle");
      });

      test("should have void background color", async ({ page }) => {
        // Check body background color
        await checkColor(page, "body", "background-color", expectedColors.void);
      });

      test("should have correct heading font", async ({ page }) => {
        // Check h1 font
        await checkFont(page, "h1", expectedFonts.heading);
      });

      test("should have correct body font", async ({ page }) => {
        // Check body font
        await checkFont(page, "body", expectedFonts.body);
      });

      test("should have correct code font", async ({ page }) => {
        // Check code or pre font
        await checkFont(page, "code, pre", expectedFonts.code);
      });

      test("should have neon cyan accents", async ({ page }) => {
        // Look for elements with neon cyan color (e.g., buttons, links, accents)
        // We'll check a few common places
        const neonCyanSelectors = [
          "a[href*='/services']", // Services link in nav
          "a[href*='/store']", // Store link in nav
          "a[href*='/blog']", // Blog link in nav
          "a[href*='/contact']", // Contact link in nav
          ".btn-primary", // Primary button
          "[data-testid='logo']", // Logo
        ];

        let found = false;
        for (const selector of neonCyanSelectors) {
          try {
            await checkColor(page, selector, "color", expectedColors.neonCyan);
            found = true;
            break;
          } catch (e) {
            // Try background-color if color fails
            try {
              await checkColor(page, selector, "background-color", expectedColors.neonCyan);
              found = true;
              break;
            } catch (e2) {
              // Continue to next selector
            }
          }
        }
        expect(found).toBeTruthy(
          `No element with neon cyan color found on ${name}`
        );
      });

      test("should have neon magenta accents", async ({ page }) => {
        // Similar to above but for magenta
        const neonMagentaSelectors = [
          ".btn-secondary",
          ".badge",
          "[data-testid='admin-badge']",
        ];

        let found = false;
        for (const selector of neonMagentaSelectors) {
          try {
            await checkColor(page, selector, "color", expectedColors.neonMagenta);
            found = true;
            break;
          } catch (e) {
            try {
              await checkColor(page, selector, "background-color", expectedColors.neonMagenta);
              found = true;
              break;
            } catch (e2) {
              // Continue
            }
          }
        }
        expect(found).toBeTruthy(
          `No element with neon magenta color found on ${name}`
        );
      });

      test("should have neon green accents", async ({ page }) => {
        const neonGreenSelectors = [
          ".btn-success",
          ".status-success",
          "[data-testid='success-indicator']",
        ];

        let found = false;
        for (const selector of neonGreenSelectors) {
          try {
            await checkColor(page, selector, "color", expectedColors.neonGreen);
            found = true;
            break;
          } catch (e) {
            try {
              await checkColor(page, selector, "background-color", expectedColors.neonGreen);
              found = true;
              break;
            } catch (e2) {
              // Continue
            }
          }
        }
        expect(found).toBeTruthy(
          `No element with neon green color found on ${name}`
        );
      });

      test("should have neon blue accents", async ({ page }) => {
        const neonBlueSelectors = [
          ".btn-info",
          ".status-info",
          "[data-testid='info-indicator']",
        ];

        let found = false;
        for (const selector of neonBlueSelectors) {
          try {
            await checkColor(page, selector, "color", expectedColors.neonBlue);
            found = true;
            break;
          } catch (e) {
            try {
              await checkColor(page, selector, "background-color", expectedColors.neonBlue);
              found = true;
              break;
            } catch (e2) {
              // Continue
            }
          }
        }
        expect(found).toBeTruthy(
          `No element with neon blue color found on ${name}`
        );
      });

      test.describe("Effects", () => {
        expectedEffects.forEach((effect) => {
          test(`should have ${effect} effect applied`, async ({ page }) => {
            await checkEffectClass(page, effect);
          });
        });
      });

      test.describe("Hover States", () => {
        test("should show neon cyan on hover for interactive elements", async ({ page }) => {
          // Find interactive elements (links, buttons) and check their hover color
          const interactiveSelectors = [
            "a[href*='/services']",
            "a[href*='/store']",
            "a[href*='/blog']",
            "a[href*='/contact']",
            ".btn",
            "button",
          ];

          let foundHover = false;
          for (const selector of interactiveSelectors) {
            try {
              // Hover over the element
              await page.hover(selector);
              // Check the color after hover
              await checkColor(page, selector, "color", expectedColors.neonCyan);
              foundHover = true;
              break;
            } catch (e) {
              try {
                await checkColor(page, selector, "background-color", expectedColors.neonCyan);
                foundHover = true;
                break;
              } catch (e2) {
                // Continue to next selector
              }
            }
          }
          expect(foundHover).toBeTruthy(
            `No interactive element shows neon cyan on hover on ${name}`
          );
        });
      });
    });
  });
});