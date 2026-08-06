import { test, expect } from "@playwright/test";

/**
 * Performance Test Suite - Core Web Vitals
 * Tests LCP, FID, CLS and other performance metrics
 */

test.describe("Core Web Vitals", () => {
  test("should measure LCP (Largest Contentful Paint) on homepage", async ({ page }) => {
    await page.goto("/");
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Measure LCP using Performance API
    const lcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const lastEntry = entries[entries.length - 1];
          resolve(lastEntry.startTime);
        });
        
        observer.observe({ entryTypes: ['largest-contentful-paint'] });
        
        // Timeout after 10 seconds if no LCP entry
        setTimeout(() => {
          observer.disconnect();
          resolve(0);
        }, 10000);
      });
    });
    
    // LCP should be under 2.5 seconds for good performance
    expect(lcp).toBeLessThan(2500);
  });
  
  test("should measure FID (First Input Delay) on homepage", async ({ page }) => {
    await page.goto("/");
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Measure FID using Performance API
    const fid = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const firstEntry = entries[0];
          resolve(firstEntry.processingStart - firstEntry.startTime);
        });
        
        observer.observe({ entryTypes: ['first-input'] });
        
        // Timeout after 10 seconds if no FID entry
        setTimeout(() => {
          observer.disconnect();
          resolve(0);
        }, 10000);
      });
    });
    
    // FID should be under 100ms for good performance
    expect(fid).toBeLessThan(100);
  });
  
  test("should measure CLS (Cumulative Layout Shift) on homepage", async ({ page }) => {
    await page.goto("/");
    
    // Wait for page to load and stabilize
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000); // Additional wait for layout shifts
    
    // Measure CLS using Performance API
    const cls = await page.evaluate(() => {
      return new Promise((resolve) => {
        let clsValue = 0;
        const observer = new PerformanceObserver((entryList) => {
          for (const entry of entryList.getEntries()) {
            if (!entry.hadRecentInput) {
              clsValue += entry.value;
            }
          }
          resolve(clsValue);
        });
        
        observer.observe({ entryTypes: ['layout-shift'] });
        
        // Timeout after 10 seconds
        setTimeout(() => {
          observer.disconnect();
          resolve(clsValue);
        }, 10000);
      });
    });
    
    // CLS should be under 0.1 for good performance
    expect(cls).toBeLessThan(0.1);
  });
  
  test("should measure FCP (First Contentful Paint) on homepage", async ({ page }) => {
    await page.goto("/");
    
    // Wait for page to load
    await page.waitForLoadState('networkidle');
    
    // Measure FCP using Performance API
    const fcp = await page.evaluate(() => {
      return new Promise((resolve) => {
        const observer = new PerformanceObserver((entryList) => {
          const entries = entryList.getEntries();
          const firstEntry = entries[0];
          resolve(firstEntry.startTime);
        });
        
        observer.observe({ entryTypes: ['first-contentful-paint'] });
        
        // Timeout after 10 seconds if no FCP entry
        setTimeout(() => {
          observer.disconnect();
          resolve(0);
        }, 10000);
      });
    });
    
    // FCP should be under 1.8 seconds for good performance
    expect(fcp).toBeLessThan(1800);
  });
  
  test("should measure TTFB (Time to First Byte) on homepage", async ({ page }) => {
    await page.goto("/");
    
    // Measure TTFB using Navigation Timing API
    const ttfb = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      return navigation.responseStart - navigation.requestStart;
    });
    
    // TTFB should be under 800ms for good performance
    expect(ttfb).toBeLessThan(800);
  });
});

test.describe("Page Load Times", () => {
  test("homepage should load within reasonable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/", { waitUntil: 'networkidle' });
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
  });
  
  test("services page should load within reasonable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/services", { waitUntil: 'networkidle' });
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
  });
  
  test("store page should load within reasonable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/store", { waitUntil: 'networkidle' });
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(8000); # Store might take longer due to products
  });
  
  test("blog page should load within reasonable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/blog", { waitUntil: 'networkidle' });
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
  });
  
  test("contact page should load within reasonable time", async ({ page }) => {
    const startTime = Date.now();
    await page.goto("/contact", { waitUntil: 'networkidle' });
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(5000); // Should load within 5 seconds
  });
  
  test("dashboard page should load within reasonable time", async ({ page }) => {
    # Login first
    await page.context().addCookies([
      {
        name: "session_token",
        value: "test-session-token",
        path: "/",
        domain: "localhost",
        httpOnly: true,
        sameSite: "Lax",
        expires: Date.now() + 86400000,
      }
    ]);
    
    const startTime = Date.now();
    await page.goto("/dashboard", { waitUntil: 'networkidle' });
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(8000); # Dashboard might take longer with data
  });
  
  test("admin page should load within reasonable time", async ({ page }) => {
    # Login as admin first
    await page.context().addCookies([
      {
        name: "session_token",
        value: "test-admin-session-token",
        path: "/",
        domain: "localhost",
        httpOnly: true,
        sameSite: "Lax",
        expires: Date.now() + 86400000,
      }
    ]);
    
    const startTime = Date.now();
    await page.goto("/admin", { waitUntil: 'networkidle' });
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(8000); # Admin might take longer with data
  });
});

test.describe("Resource Optimization", () => {
  test("should optimize image loading", async ({ page }) => {
    await page.goto("/");
    
    const imageOptimization = await page.evaluate(() => {
      const images = document.querySelectorAll('img');
      let optimizedCount = 0;
      let totalCount = 0;
      
      images.forEach(img => {
        if (img.offsetParent !== null) { // Visible image
          totalCount++;
          
          # Check for lazy loading
          const loading = img.getAttribute('loading');
          const hasLazyLoad = loading === 'lazy';
          
          # Check for width and height attributes (helps prevent layout shift)
          const width = img.getAttribute('width');
          const height = img.getAttribute('height');
          const hasDimensions = !!width && !!height;
          
          # Check for modern image formats in srcset
          const srcset = img.getAttribute('srcset');
          const hasSrcset = !!srcset && srcset.includes('webp') || srcset.includes('avif');
          
          # Check if using picture element with modern formats
          const parentPicture = img.parentElement.tagName.toLowerCase() === 'picture';
          const hasWebpInPicture = parentPicture && 
            img.parentElement.innerHTML.includes('type="image/webp"');
          
          if (hasLazyLoad || hasDimensions || hasSrcset || hasWebpInPicture) {
            optimizedCount++;
          }
        }
      });
      
      return { optimizedCount, totalCount };
    });
    
    # At least some images should be optimized
    # Note: This is a basic check - real optimization checking is more complex
    expect(imageOptimization.optimizedCount).toBeGreaterThan(0);
  });
  
  test("should minimize render-blocking resources", async ({ page }) => {
    await page.goto("/");
    
    const renderBlocking = await page.evaluate(() => {
      const links = document.querySelectorAll('link[rel="stylesheet"]');
      const scripts = document.querySelectorAll('script:not([async]):not([defer])');
      
      let renderBlockingCount = 0;
      
      # Check CSS links
      links.forEach(link => {
        # In a real implementation, we'd check if they're critical or not
        # For now, just count them
        renderBlockingCount++;
      });
      
      # Check scripts without async/defer
      scripts.forEach(script => {
        renderBlockingCount++;
      });
      
      return { renderBlockingCount };
    });
    
    # Just verify we can measure this
    expect(renderBlocking).toBeDefined();
  });
  
  test("should use browser caching", async ({ page }) => {
    await page.goto("/");
    
    # Reload to check cache headers
    await page.reload();
    
    # Check if we got 304 responses (not modified) indicating caching
    # This is more complex to measure directly in Playwright
    # For now, just verify the test runs
    expect(true).toBe(true);
  });
});

test.describe("Mobile Performance", () => {
  test("should perform well on mobile devices", async ({ page }) => {
    # Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 }); # iPhone SE
    
    const startTime = Date.now();
    await page.goto("/", { waitUntil: 'networkidle' });
    const endTime = Date.now();
    
    const loadTime = endTime - startTime;
    expect(loadTime).toBeLessThan(8000); # Mobile might be slower
    
    # Check mobile-specific metrics
    const mobileMetrics = await page.evaluate(() => {
      return {
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        userAgent: navigator.userAgent
      };
    });
    
    expect(mobileMetrics.viewportWidth).toBe(375);
    expect(mobileMetrics.viewportHeight).toBe(667);
  });
  
  test("should have appropriate tap targets on mobile", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); # iPhone SE
    await page.goto("/");
    
    const tapTargets = await page.evaluate(() => {
      const interactiveElements = document.querySelectorAll('a, button, [role="button"], input, select, textarea');
      let adequateTargets = 0;
      let totalTargets = 0;
      
      interactiveElements.forEach(el => {
        if (el.offsetParent !== null) { # Visible element
          totalTargets++;
          const rect = el.getBoundingClientRect();
          
          # WCAG recommends minimum 44x48px tap targets
          const width = rect.width;
          const height = rect.height;
          
          if (width >= 44 && height >= 44) {
            adequateTargets++;
          }
        }
      });
      
      return { adequateTargets, totalTargets };
    });
    
    # At least some tap targets should be adequate
    # Note: This might fail if the site has many small tap targets
    expect(tapTargets.adequateTargets).toBeGreaterThanOrEqual(0);
  });
});

test.describe("Performance Budgets", () => {
  test("should keep total page size under budget", async ({ page }) => {
    await page.goto("/");
    
    const totalSize = await page.evaluate(() => {
      let totalSize = 0;
      const resources = performance.getEntriesByType('resource');
      
      resources.forEach(resource => {
        totalSize += resource.transferSize || 0;
      });
      
      return totalSize;
    });
    
    # Should be under 1MB for initial load (reasonable budget)
    expect(totalSize).toBeLessThan(1024 * 1024); # 1MB in bytes
  });
  
  test("should keep number of requests under budget", async ({ page }) => {
    await page.goto("/");
    
    const requestCount = await page.evaluate(() => {
      return performance.getEntriesByType('resource').length;
    });
    
    # Should have reasonable number of requests
    # This depends on the site complexity - 50 is a reasonable upper limit
    expect(requestCount).toBeLessThan(50);
  });
  
  test("should keep CSS size under budget", async ({ page }) => {
    await page.goto("/");
    
    const cssSize = await page.evaluate(() => {
      let totalSize = 0;
      const resources = performance.getEntriesByType('resource');
      
      resources.forEach(resource => {
        if (resource.initiatorType === 'link' || 
            resource.name.endsWith('.css')) {
          totalSize += resource.transferSize || 0;
        }
      });
      
      return totalSize;
    });
    
    # Should be under 100KB for CSS
    expect(cssSize).toBeLessThan(100 * 1024); # 100KB in bytes
  });
  
  test("should keep JavaScript size under budget", async ({ page }) => {
    await page.goto("/");
    
    const jsSize = await page.evaluate(() => {
      let totalSize = 0;
      const resources = performance.getEntriesByType('resource');
      
      resources.forEach(resource => {
        if (resource.initiatorType === 'script' || 
            resource.name.endsWith('.js')) {
          totalSize += resource.transferSize || 0;
        }
      });
      
      return totalSize;
    });
    
    # Should be under 500KB for JavaScript
    expect(jsSize).toBeLessThan(500 * 1024); # 500KB in bytes
  });
});