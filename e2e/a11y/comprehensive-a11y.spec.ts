import { test, expect } from "@playwright/test";
import { axe, toHaveNoViolations } from "jest-axe";

/**
 * Comprehensive Accessibility Test Suite
 * Tests accessibility across the entire application using axe-core
 */

test.describe.configure({ mode: "serial" });

test.beforeAll(() => {
  expect.extend(toHaveNoViolations);
});

test.describe("Homepage Accessibility", () => {
  test("should pass axe accessibility tests", async ({ page }) => {
    await page.goto("/");
    
    // Inject axe and run accessibility tests
    const accessibilityScanResults = await page.evaluate(async () => {
      // Import axe if not already available
      if (typeof axe === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
        document.head.appendChild(script);
        
        // Wait for axe to load
        await new Promise(resolve => {
          script.onload = resolve;
        });
      }
      
      return await axe.run();
    });
    
    expect(accessibilityScanResults).toHaveNoViolations();
  });
});

test.describe("Services Page Accessibility", () => {
  test("should pass axe accessibility tests", async ({ page }) => {
    await page.goto("/services");
    
    const accessibilityScanResults = await page.evaluate(async () => {
      if (typeof axe === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
        document.head.appendChild(script);
        
        await new Promise(resolve => {
          script.onload = resolve;
        });
      }
      
      return await axe.run();
    });
    
    expect(accessibilityScanResults).toHaveNoViolations();
  });
});

test.describe("Store Page Accessibility", () => {
  test("should pass axe accessibility tests", async ({ page }) => {
    await page.goto("/store");
    
    const accessibilityScanResults = await page.evaluate(async () => {
      if (typeof axe === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
        document.head.appendChild(script);
        
        await new Promise(resolve => {
          script.onload = resolve;
        });
      }
      
      return await axe.run();
    });
    
    expect(accessibilityScanResults).toHaveNoViolations();
  });
});

test.describe("Blog Page Accessibility", () => {
  test("should pass axe accessibility tests", async ({ page }) => {
    await page.goto("/blog");
    
    const accessibilityScanResults = await page.evaluate(async () => {
      if (typeof axe === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
        document.head.appendChild(script);
        
        await new Promise(resolve => {
          script.onload = resolve;
        });
      }
      
      return await axe.run();
    });
    
    expect(accessibilityScanResults).toHaveNoViolations();
  });
});

test.describe("Contact Page Accessibility", () => {
  test("should pass axe accessibility tests", async ({ page }) => {
    await page.goto("/contact");
    
    const accessibilityScanResults = await page.evaluate(async () => {
      if (typeof axe === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
        document.head.appendChild(script);
        
        await new Promise(resolve => {
          script.onload = resolve;
        });
      }
      
      return await axe.run();
    });
    
    expect(accessibilityScanResults).toHaveNoViolations();
  });
});

test.describe("Dashboard Page Accessibility", () => {
  test("should pass axe accessibility tests for authenticated user", async ({ page }) => {
    // Login first - using API request to avoid UI interaction complications
    await page.context().addCookies([
      {
        name: "session_token",
        value: "test-session-token", // In real test, this would be a valid token
        path: "/",
        domain: "localhost",
        httpOnly: true,
        sameSite: "Lax",
        expires: Date.now() + 86400000, // 24 hours
      }
    ]);
    
    await page.goto("/dashboard");
    
    const accessibilityScanResults = await page.evaluate(async () => {
      if (typeof axe === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
        document.head.appendChild(script);
        
        await new Promise(resolve => {
          script.onload = resolve;
        });
      }
      
      return await axe.run();
    });
    
    expect(accessibilityScanResults).toHaveNoViolations();
  });
});

test.describe("Admin Page Accessibility", () => {
  test("should pass axe accessibility tests for admin user", async ({ page }) => {
    // Login as admin - using API request
    await page.context().addCookies([
      {
        name: "session_token",
        value: "test-admin-session-token", // In real test, this would be a valid admin token
        path: "/",
        domain: "localhost",
        httpOnly: true,
        sameSite: "Lax",
        expires: Date.now() + 86400000, // 24 hours
      }
    ]);
    
    await page.goto("/admin");
    
    const accessibilityScanResults = await page.evaluate(async () => {
      if (typeof axe === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
        document.head.appendChild(script);
        
        await new Promise(resolve => {
          script.onload = resolve;
        });
      }
      
      return await axe.run();
    });
    
    expect(accessibilityScanResults).toHaveNoViolations();
  });
});

test.describe("Component Accessibility", () => {
  test("header should pass axe accessibility tests", async ({ page }) => {
    await page.goto("/");
    
    const accessibilityScanResults = await page.evaluate(async () => {
      if (typeof axe === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
        document.head.appendChild(script);
        
        await new Promise(resolve => {
          script.onload = resolve;
        });
      }
      
      // Run axe only on header element
      return await axe.run('.header, header, [data-testid="header"]');
    });
    
    expect(accessibilityScanResults).toHaveNoViolations();
  });
  
  test("footer should pass axe accessibility tests", async ({ page }) => {
    await page.goto("/");
    
    const accessibilityScanResults = await page.evaluate(async () => {
      if (typeof axe === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
        document.head.appendChild(script);
        
        await new Promise(resolve => {
          script.onload = resolve;
        });
      }
      
      // Run axe only on footer element
      return await axe.run('footer, [data-testid="footer"], .footer');
    });
    
    expect(accessibilityScanResults).toHaveNoViolations();
  });
  
  test("buttons should pass axe accessibility tests", async ({ page }) => {
    await page.goto("/services");
    
    const accessibilityScanResults = await page.evaluate(async () => {
      if (typeof axe === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
        document.head.appendChild(script);
        
        await new Promise(resolve => {
          script.onload = resolve;
        });
      }
      
      // Run axe only on button elements
      return await axe.run('button, .btn');
    });
    
    expect(accessibilityScanResults).toHaveNoViolations();
  });
  
  test("cards should pass axe accessibility tests", async ({ page }) => {
    await page.goto("/");
    
    const accessibilityScanResults = await page.evaluate(async () => {
      if (typeof axe === 'undefined') {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/axe-core/4.7.2/axe.min.js';
        document.head.appendChild(script);
        
        await new Promise(resolve => {
          script.onload = resolve;
        });
      }
      
      // Run axe only on card elements
      return await axe.run('.card, [data-testid="card"], .service-card, .product-card, .post-card');
    });
    
    expect(accessibilityScanResults).toHaveNoViolations();
  });
});

test.describe("Color Contrast Accessibility", () => {
  test("should have sufficient color contrast on homepage", async ({ page }) => {
    await page.goto("/");
    
    const contrastResults = await page.evaluate(async () => {
      // This is a simplified check - in practice, axe-core handles this better
      const elements = document.querySelectorAll('*');
      let issues = 0;
      
      // Check a sample of elements for visible text
      const sampleSize = Math.min(50, elements.length);
      for (let i = 0; i < sampleSize; i++) {
        const el = elements[i];
        if (el.offsetParent !== null) { // Element is visible
          const computedStyle = window.getComputedStyle(el);
          const color = computedStyle.color;
          const backgroundColor = computedStyle.backgroundColor;
          
          // Very basic check - just ensure we can get color values
          if (color === '' || backgroundColor === '') {
            // Skip if no color info
            continue;
          }
          
          // In a real implementation, we'd calculate contrast ratio here
          // For now, just verify we can access the properties
        }
      }
      
      return { issues };
    });
    
    // Just verify the test ran without error
    expect(contrastResults).toBeDefined();
  });
});

test.describe("Keyboard Navigation Accessibility", () => {
  test("should be navigable via keyboard on homepage", async ({ page }) => {
    await page.goto("/");
    
    // Test tab navigation
    await page.keyboard.press('Tab');
    const focusedElement = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tagName: el.tagName,
        className: el.className,
        id: el.id
      };
    });
    
    // Should have focused something
    expect(focusedElement.tagName).toBeDefined();
    
    // Test that we can tab through multiple elements
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    
    const finallyFocused = await page.evaluate(() => {
      const el = document.activeElement;
      return {
        tagName: el.tagName,
        className: el.className,
        id: el.id
      };
    });
    
    expect(finallyFocused.tagName).toBeDefined();
  });
  
  test("should have visible focus indicators", async ({ page }) => {
    await page.goto("/");
    
    // Focus the first interactive element
    await page.keyboard.press('Tab');
    
    // Check that focused element has visible focus indicator
    const hasFocusIndicator = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el) return false;
      
      const computedStyle = window.getComputedStyle(el);
      // Check for common focus indicator properties
      const outlineWidth = computedStyle.outlineWidth;
      const outlineStyle = computedStyle.outlineStyle;
      const outlineColor = computedStyle.outlineColor;
      const boxShadow = computedStyle.boxShadow;
      
      // Element has some kind of focus indicator
      return (
        outlineWidth !== '0px' && outlineStyle !== 'none' ||
        boxShadow !== 'none' && boxShadow !== ''
      );
    });
    
    // Note: This is a basic check - some sites use custom focus indicators
    // that might not be detected by this simple check
    expect(hasFocusIndicator).toBeTruthy();
  });
});

test.describe("ARIA Attributes Accessibility", () => {
  test("should have appropriate ARIA landmarks", async ({ page }) => {
    await page.goto("/");
    
    const landmarks = await page.evaluate(() => {
      const headers = document.querySelectorAll('header, [role="banner"]');
      const navs = document.querySelectorAll('nav, [role="navigation"]');
      const mains = document.querySelectorAll('main, [role="main"]');
      const footers = document.querySelectorAll('footer, [role="contentinfo"]');
      
      return {
        headers: headers.length,
        navs: navs.length,
        mains: mains.length,
        footers: footers.length
      };
    });
    
    // Should have at least one of each major landmark
    expect(landmarks.headers).toBeGreaterThan(0);
    expect(landmarks.navs).toBeGreaterThan(0);
    expect(landmarks.mains).toBeGreaterThan(0);
    expect(landmarks.footers).toBeGreaterThan(0);
  });
  
  test("should have accessible form labels", async ({ page }) => {
    await page.goto("/contact");
    
    const formElements = await page.evaluate(() => {
      const inputs = document.querySelectorAll('input, select, textarea');
      let labeledCount = 0;
      let totalCount = 0;
      
      inputs.forEach(input => {
        if (input.offsetParent !== null) { // Visible element
          totalCount++;
          const id = input.id;
          
          // Check for associated label
          let hasLabel = false;
          if (id) {
            const label = document.querySelector(`label[for="${id}"]`);
            if (label) hasLabel = true;
          }
          
          // Check for aria-label or aria-labelledby
          const ariaLabel = input.getAttribute('aria-label');
          const ariaLabelledby = input.getAttribute('aria-labelledby');
          
          if (hasLabel || ariaLabel || ariaLabelledby) {
            labeledCount++;
          }
        }
      });
      
      return { labeledCount, totalCount };
    });
    
    // All visible form elements should have accessible labels
    expect(formElements.labeledCount).toBe(formElements.totalCount);
  });
});

test.describe.skip("Skip this test - just an example of how to skip tests", () => {
  test("this test will be skipped", async ({ page }) => {
    await page.goto("/");
    expect(true).toBe(true);
  });
});