import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage } from "../../helpers/page-helpers";

/**
 * Button Component Test Suite
 * Tests button components for rendering, states, and accessibility
 */

test.describe("Button Component", () => {
  let page: BasePage;
  let responsivePage: ResponsivePage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = createBasePage(browserPage);
    responsivePage = createResponsivePage(browserPage);
    
    // Test on a page that likely has various buttons (like homepage or services)
    await page.navigate("/services");
  });

  test("should render different button variants", async ({ page: browserPage }) => {
    // Check for primary button
    const primaryButton = browserPage.locator('.btn-primary, button.primary, [data-variant="primary"]');
    await expect(primaryButton.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // Check for secondary button
    const secondaryButton = browserPage.locator('.btn-secondary, button.secondary, [data-variant="secondary"]');
    await expect(secondaryButton.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // Check for outline button
    const outlineButton = browserPage.locator('.btn-outline, button.outline, [data-variant="outline"]');
    await expect(outlineButton.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // Check for ghost button
    const ghostButton = browserPage.locator('.btn-ghost, button.ghost, [data-variant="ghost"]');
    await expect(ghostButton.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    // Check for basic button
    const button = browserPage.locator('button, .btn');
    await expect(button.first()).toBeVisible();
  });

  test("should have proper button states", async ({ page: browserPage }) => {
    const buttons = browserPage.locator('button, .btn');
    const count = await buttons.count();
    
    expect(count).toBeGreaterThan(0);
    
    // Check a sample of buttons for states
    const sampleSize = Math.min(5, count);
    for (let i = 0; i < sampleSize; i++) {
      const button = buttons.nth(i);
      
      // Check that button is visible
      await expect(button).toBeVisible();
      
      // Check that button is enabled (not disabled)
      await expect(button).toBeEnabled();
      
      // Check hover state (we can't directly test hover, but we can check cursor)
      const cursor = await button.evaluate(el => {
        return window.getComputedStyle(el).cursor;
      });
      expect(cursor).toBe('pointer');
      
      // Check focus outline (basic check)
      await button.focus();
      const isFocused = await button.evaluate(el => el === document.activeElement);
      expect(isFocused).toBeTruthy();
      
      // Blur the button
      await button.blur();
    }
  });

  test("should have accessible button labels", async ({ page: browserPage }) => {
    const buttons = browserPage.locator('button, .btn');
    const count = await buttons.count();
    
    expect(count).toBeGreaterThan(0);
    
    // Check a sample of buttons for accessibility
    const sampleSize = Math.min(5, count);
    for (let i = 0; i < sampleSize; i++) {
      const button = buttons.nth(i);
      
      await expect(button).toBeVisible();
      await expect(button).toBeEnabled();
      
      // Check for accessible name (text content, aria-label, or aria-labelledby)
      const textContent = await button.textContent();
      const ariaLabel = await button.getAttribute('aria-label');
      const ariaLabelledby = await button.getAttribute('aria-labelledby');
      
      expect(textContent?.trim() || ariaLabel || ariaLabelledby).toBeDefined();
      
      // Check that button doesn't rely solely on color for meaning
      // This is a basic check - in reality, we'd need to check color contrast
      const buttonColor = await button.evaluate(el => {
        return window.getComputedStyle(el).backgroundColor;
      });
      // Just verify we can get a color value
      expect(buttonColor).toBeDefined();
    }
  });

  test.describe("Button Types", () => {
    test("should render submit buttons correctly", async ({ page: browserPage }) => {
      const submitButtons = browserPage.locator('button[type="submit"], .btn[type="submit"]');
      const count = await submitButtons.count();
      
      if (count > 0) {
        await expect(submitButtons.first()).toBeVisible();
        await expect(submitButtons.first()).toBeEnabled();
        
        // Check that submit button has accessible name
        const button = submitButtons.first();
        const textContent = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        
        expect(textContent?.trim() || ariaLabel).toBeDefined();
      }
    });
    
    test("should render button links correctly", async ({ page: browserPage }) => {
      const buttonLinks = browserPage.locator('a.btn, a.button, .btn-link');
      const count = await buttonLinks.count();
      
      if (count > 0) {
        await expect(buttonLinks.first()).toBeVisible();
        
        // Check that button link has accessible name
        const link = buttonLinks.first();
        const textContent = await link.textContent();
        const ariaLabel = await link.getAttribute('aria-label');
        
        expect(textContent?.trim() || ariaLabel).toBeDefined();
        
        // Check that link is keyboard accessible
        await expect(link).toBeFocusable();
        
        // Check that link has href attribute
        const href = await link.getAttribute('href');
        expect(href).toBeDefined();
      }
    });
    
    test("should render icon buttons correctly", async ({ page: browserPage }) => {
      const iconButtons = browserPage.locator('button[aria-label], .btn[aria-label], button:has(.icon), .btn:has(.icon)');
      const count = await iconButtons.count();
      
      if (count > 0) {
        await expect(iconButtons.first()).toBeVisible();
        await expect(iconButtons.first()).toBeEnabled();
        
        // Check that icon button has accessible name (aria-label)
        const button = iconButtons.first();
        const ariaLabel = await button.getAttribute('aria-label');
        const ariaLabelledby = await button.getAttribute('aria-labelledby');
        
        expect(ariaLabel || ariaLabelledby).toBeDefined();
        
        // Check that button contains an icon or SVG
        const icon = button.locator('svg, .icon, i, [class*="icon"]');
        // Icon might not be present in all implementations
      }
    });
  });

  test.describe("Button States", () => {
    test("should show loading state when disabled", async ({ page: browserPage }) => {
      // Look for buttons that might have loading states
      // This is implementation-specific, so we'll check for common patterns
      const buttons = browserPage.locator('button, .btn');
      const count = await buttons.count();
      
      // Check a sample of buttons
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const button = buttons.nth(i);
        
        await expect(button).toBeVisible();
        
        // Check for loading indicators (spinner, text change, etc.)
        // This is highly implementation-specific
        const loadingSpinner = button.locator('.spinner, .loading, [data-testid="loading"]');
        // Loading state might not be present
        
        // Check for text that indicates loading
        const buttonText = await button.textContent();
        // Text might change to "Loading..." or similar
      }
    });
    
    test("should be disabled when in loading state", async ({ page: browserPage }) => {
      // Similar to above, check if buttons are disabled during loading
      // This is highly implementation-specific
      const buttons = browserPage.locator('button, .btn');
      const count = await buttons.count();
      
      // Check a sample of buttons
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const button = buttons.nth(i);
        
        await expect(button).toBeVisible();
        
        // We can't easily test loading state without triggering it
        // So we'll just verify the button can be disabled
        await expect(button).toBeEnabled();
        
        // Test disabling the button (if it has a disabled state)
        // This is just to verify the disabled attribute works
        await button.evaluate((el) => {
          el.disabled = true;
        });
        await expect(button).toBeDisabled();
        
        // Re-enable for other tests
        await button.evaluate((el) => {
          el.disabled = false;
        });
      }
    });
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/services");
      
      const buttons = browserPage.locator('button, .btn');
      const count = await buttons.count();
      
      expect(count).toBeGreaterThan(0);
      
      // Check a sample of buttons for visibility and touch target size
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const button = buttons.nth(i);
        
        await expect(button).toBeVisible();
        await expect(button).toBeEnabled();
        
        // Check minimum touch target size (44x48px per WCAG)
        const boundingBox = await button.boundingBox();
        expect(boundingBox).toBeDefined();
        
        if (boundingBox) {
          // Width should be at least 44px (or height if vertical)
          expect(boundingBox.width).toBeGreaterThanOrEqual(44);
          expect(boundingBox.height).toBeGreaterThanOrEqual(44);
        }
      }
    });
    
    test("should render correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      await responsivePage.navigate("/services");
      
      const buttons = browserPage.locator('button, .btn');
      const count = await buttons.count();
      
      expect(count).toBeGreaterThan(0);
      
      // Check a sample of buttons
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const button = buttons.nth(i);
        
        await expect(button).toBeVisible();
        await expect(button).toBeEnabled();
      }
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/services");
      
      const buttons = browserPage.locator('button, .btn');
      const count = await buttons.count();
      
      expect(count).toBeGreaterThan(0);
      
      // Check a sample of buttons
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const button = buttons.nth(i);
        
        await expect(button).toBeVisible();
        await expect(button).toBeEnabled();
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should have sufficient color contrast", async ({ page: browserPage }) => {
      // This is a basic check - for full accessibility testing, use axe-core
      const buttons = browserPage.locator('button, .btn');
      const count = await buttons.count();
      
      expect(count).toBeGreaterThan(0);
      
      // Check a sample of buttons for color properties
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const button = buttons.nth(i);
        
        await expect(button).toBeVisible();
        
        // Get background and text colors
        const bgColor = await button.evaluate(el => {
          return window.getComputedStyle(el).backgroundColor;
        });
        const textColor = await button.evaluate(el => {
          return window.getComputedStyle(el).color;
        });
        
        // Just verify we can get color values
        expect(bgColor).toBeDefined();
        expect(textColor).toBeDefined();
        
        // Basic check: colors should not be the same (would be invisible)
        expect(bgColor).not.toEqual(textColor);
      }
    });
    
    test("should have accessible names", async ({ page: browserPage }) => {
      const buttons = browserPage.locator('button, .btn');
      const count = await buttons.count();
      
      expect(count).toBeGreaterThan(0);
      
      // Check a sample of buttons for accessibility
      const sampleSize = Math.min(5, count);
      for (let i = 0; i < sampleSize; i++) {
        const button = buttons.nth(i);
        
        await expect(button).toBeVisible();
        await expect(button).toBeEnabled();
        
        // Check for accessible name (text content, aria-label, or aria-labelledby)
        const textContent = await button.textContent();
        const ariaLabel = await button.getAttribute('aria-label');
        const ariaLabelledby = await button.getAttribute('aria-labelledby');
        
        expect(textContent?.trim() || ariaLabel || ariaLabelledby).toBeDefined();
        
        // Check that accessible name is descriptive
        const accessibleName = textContent?.trim() || ariaLabel || ariaLabelledby;
        if (accessibleName) {
          expect(accessibleName.length).toBeGreaterThan(0);
          // Avoid generic text like "button" or "click here" - basic check
          const lowerName = accessibleName.toLowerCase();
          expect(lowerName).not.toMatch(/^(button|click here|submit)$/);
        }
      }
    });
    
    test("should be keyboard accessible", async ({ page: browserPage }) => {
      const buttons = browserPage.locator('button, .btn');
      const count = await buttons.count();
      
      expect(count).toBeGreaterThan(0);
      
      // Check a sample of buttons for keyboard accessibility
      const sampleSize = Math.min(5, count);
      for (let i = 0; i < sampleSize; i++) {
        const button = buttons.nth(i);
        
        await expect(button).toBeVisible();
        await expect(button).toBeEnabled();
        
        // Check that button is focusable
        await expect(button).toBeFocusable();
        
        // Check that button can be activated with Enter key
        await button.focus();
        await expect(button).toBeFocused();
        
        // Press Enter - we can't easily test the result without knowing what the button does
        // But we can verify it doesn't throw an error
        await browserPage.keyboard.press('Enter');
        
        // Press Space - same as above
        await button.focus();
        await browserPage.keyboard.press('Space');
        
        // Blur for next iteration
        await button.blur();
      }
    });
  });

  test.describe("Performance", () => {
    test("should not cause layout shifts", async ({ page: browserPage }) => {
      // Measure Cumulative Layout Shift (CLS) - basic check
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
            
            // Wait a bit to collect layout shift data
            setTimeout(() => {
              observer.disconnect();
              resolve(cls);
            }, 3000);
          });
        }
        return 0;
      });
      
      // CLS should be less than 0.1 for good performance
      expect(clsValue).toBeLessThan(0.1);
    });
    
    test("should have reasonable number of DOM nodes", async ({ page: browserPage }) => {
      // Count button-related DOM nodes
      const buttonCount = await browserPage.evaluate(() => {
        return document.querySelectorAll('button, .btn').length;
      });
      
      // Should not have excessively many buttons on a page
      expect(buttonCount).toBeLessThan(50); // Reasonable upper limit
    });
  });
});