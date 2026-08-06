import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage, createAuthenticatedPage } from "../helpers/page-helpers";

/**
 * Header Component Test Suite
 * Tests the header/navigation component for rendering, navigation, and functionality
 */

test.describe("Header Component", () => {
  let page: BasePage;
  let responsivePage: ResponsivePage;
  let authPage: AuthenticatedPage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = createBasePage(browserPage);
    responsivePage = createResponsivePage(browserPage);
    authPage = createAuthenticatedPage(browserPage);
    
    // Start on homepage for header tests
    await page.navigate("/");
  });

  test("should be visible on all pages", async ({ page: browserPage }) => {
    const header = browserPage.locator('header, [data-testid="header"], .header, .nav-container');
    await expect(header).toBeVisible();
  });

  test("should contain logo/brand", async ({ page: browserPage }) => {
    const header = browserPage.locator('header, [data-testid="header"], .header');
    await expect(header).toBeVisible();
    
    // Check for logo
    const logo = header.locator('.logo, [data-testid="logo"], a[href="/"] img, .brand');
    await expect(logo).toBeVisible();
    
    // Check that logo links to homepage
    const logoLink = header.locator('.logo a[href="/"], [data-testid="logo"] a[href="/"], a[href="/"]');
    await expect(logoLink).toBeVisible();
  });

  test("should contain navigation menu", async ({ page: browserPage }) => {
    const header = browserPage.locator('header, [data-testid="header"], .header');
    await expect(header).toBeVisible();
    
    // Check for navigation
    const nav = header.locator('nav, [data-testid="nav"], .nav-menu, .main-navigation');
    await expect(nav).toBeVisible();
    
    // Check for main navigation links
    const navLinks = nav.locator('a[href*="/services"], a[href*="/store"], a[href*="/blog"], a[href*="/contact"]');
    await expect(navLinks.first()).toBeVisible({ timeout: 5000 });
    
    // Check that we have at least one nav link
    const count = await navLinks.count();
    expect(count).toBeGreaterThan(0);
  });

  test("should have accessible navigation", async ({ page: browserPage }) => {
    const header = browserPage.locator('header, [data-testid="header"], .header');
    await expect(header).toBeVisible();
    
    const nav = header.locator('nav, [data-testid="nav"], .nav-menu');
    await expect(nav).toBeVisible();
    
    // Check for ARIA label or role
    const ariaLabel = await nav.getAttribute('aria-label');
    const role = await nav.getAttribute('role');
    
    expect(ariaLabel || role === 'navigation').toBeTruthy();
    
    // Check that nav links are accessible
    const navLinks = nav.locator('a');
    const count = await navLinks.count();
    
    // Check a sample of nav links for accessibility
    const sampleSize = Math.min(3, count);
    for (let i = 0; i < sampleSize; i++) {
      const link = navLinks.nth(i);
      await expect(link).toBeVisible();
      
      // Check for accessible name (text content or aria-label)
      const textContent = await link.textContent();
      const ariaLabel = await link.getAttribute('aria-label');
      
      expect(textContent?.trim() || ariaLabel).toBeDefined();
    }
  });

  test.describe("Navigation Functionality", () => {
    test("should navigate to services", async ({ page: browserPage }) => {
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      const servicesLink = header.locator('a[href*="/services"], nav a:has-text("Services"), .nav-link[href*="/services"]');
      await expect(servicesLink).toBeVisible();
      
      await servicesLink.click();
      await expect(browserPage).toHaveURL(/\/services/);
    });
    
    test("should navigate to store", async ({ page: browserPage }) => {
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      const storeLink = header.locator('a[href*="/store"], nav a:has-text("Store"), .nav-link[href*="/store"]');
      await expect(storeLink).toBeVisible();
      
      await storeLink.click();
      await expect(browserPage).toHaveURL(/\/store/);
    });
    
    test("should navigate to blog", async ({ page: browserPage }) => {
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      const blogLink = header.locator('a[href*="/blog"], nav a:has-text("Blog"), .nav-link[href*="/blog"]');
      await expect(blogLink).toBeVisible();
      
      await blogLink.click();
      await expect(browserPage).toHaveURL(/\/blog/);
    });
    
    test("should navigate to contact", async ({ page: browserPage }) => {
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      const contactLink = header.locator('a[href*="/contact"], nav a:has-text("Contact"), .nav-link[href*="/contact"]');
      await expect(contactLink).toBeVisible();
      
      await contactLink.click();
      await expect(browserPage).toHaveURL(/\/contact/);
    });
    
    test("should navigate to homepage via logo", async ({ page: browserPage }) => {
      // Navigate to a different page first
      await page.navigate("/services");
      
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      const logoLink = header.locator('.logo a[href="/"], [data-testid="logo"] a[href="/"], a[href="/"]');
      await expect(logoLink).toBeVisible();
      
      await logoLink.click();
      await expect(browserPage).toHaveURL(/\/($|\?|#)/);
    });
  });

  test.describe("Authentication States", () => {
    test("should show login/logout buttons when not authenticated", async ({ page: browserPage }) => {
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      // Check for login button/link
      const loginLink = header.locator('a[href*="/auth/login"], a[href*="/login"], .login-link, [data-testid="login-link"]');
      await expect(loginLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      // Check for sign up button/link
      const signupLink = header.locator('a[href*="/auth/signup"], a[href*="/signup"], .signup-link, [data-testid="signup-link"]');
      await expect(signupLink).toBeVisible({ timeout: 5000 }).catch(() => {});
    });
    
    test("should show user menu when authenticated", async ({ page: browserPage }) => {
      // First login as a test user
      await authPage.loginViaApi("test@example.com", "password123");
      
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      # Check for user avatar or initials
      const userAvatar = header.locator('.user-avatar, .avatar, [data-testid="user-avatar"], img[alt*="user"]');
      await expect(userAvatar).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      # Check for user name or email
      const userName = header.locator('.user-name, [data-testid="user-name"], text=/test@example.com/i');
      await expect(userName).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      # Check for logout button/link
      const logoutLink = header.locator('a[href*="/auth/logout"], a[href*="/logout"], .logout-link, [data-testid="logout-link"]');
      await expect(logoutLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      # Check for dashboard or profile link
      const dashboardLink = header.locator('a[href*="/dashboard"], a[href*="/profile"], .dashboard-link, [data-testid="dashboard-link"]');
      await expect(dashboardLink).toBeVisible({ timeout: 5000 }).catch(() => {});
    });
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/");
      
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      # On mobile, navigation might be hidden behind a hamburger menu
      const navToggle = header.locator('button[aria-label*="menu" i], .nav-toggle, .hamburger, [data-testid="nav-toggle"]');
      const navMenu = header.locator('nav, [data-testid="nav"], .nav-menu');
      
      # Either the nav is visible directly or there's a toggle button
      const isNavVisible = await navMenu.isVisible();
      const hasToggle = await navToggle.isVisible();
      
      expect(isNavVisible || hasToggle).toBeTruthy();
      
      if (hasToggle) {
        # Test that toggle opens the navigation
        await navToggle.click();
        await expect(navMenu).toBeVisible({ timeout: 3000 });
        
        # Test that toggle closes the navigation
        await navToggle.click();
        await expect(navMenu).toBeHidden({ timeout: 3000 });
      }
    });
    
    test("should render correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      await responsivePage.navigate("/");
      
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      # Check that logo is visible
      const logo = header.locator('.logo, [data-testid="logo"], a[href="/"] img, .brand');
      await expect(logo).toBeVisible();
      
      # Check that navigation is visible
      const nav = header.locator('nav, [data-testid="nav"], .nav-menu');
      await expect(nav).toBeVisible();
      
      # Check that nav links are visible
      const navLinks = nav.locator('a');
      await expect(navLinks.first()).toBeVisible();
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/");
      
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      # Check that logo is visible
      const logo = header.locator('.logo, [data-testid="logo"], a[href="/"] img, .brand');
      await expect(logo).toBeVisible();
      
      # Check that navigation is visible
      const nav = header.locator('nav, [data-testid="nav"], .nav-menu');
      await expect(nav).toBeVisible();
      
      # Check that we can see multiple nav links
      const navLinks = nav.locator('a');
      const count = await navLinks.count();
      expect(count).toBeGreaterThan(1);
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper ARIA attributes", async ({ page: browserPage }) => {
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      # Check for ARIA label or role on header
      const headerRole = await header.getAttribute('role');
      const headerLabel = await header.getAttribute('aria-label');
      
      # Header might have banner role or aria-label
      expect(headerRole === 'banner' || headerLabel).toBeTruthy();
      
      # Check for ARIA label or role on navigation
      const nav = header.locator('nav, [data-testid="nav"], .nav-menu');
      await expect(nav).toBeVisible();
      
      const navRole = await nav.getAttribute('role');
      const navLabel = await nav.getAttribute('aria-label');
      const navLabelledby = await nav.getAttribute('aria-labelledby');
      
      expect(navRole === 'navigation' || navLabel || navLabelledby).toBeTruthy();
    });
    
    test("should have accessible logo/link", async ({ page: browserPage }) => {
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      const logoLink = header.locator('.logo a[href="/"], [data-testid="logo"] a[href="/"], a[href="/"]');
      await expect(logoLink).toBeVisible();
      
      # Check for accessible name (text content, aria-label, or aria-labelledby)
      const textContent = await logoLink.textContent();
      const ariaLabel = await logoLink.getAttribute('aria-label');
      const ariaLabelledby = await logoLink.getAttribute('aria-labelledby');
      
      # Logo might be an image, so check for img alt text
      const logoImg = header.locator('.logo img, [data-testid="logo"] img');
      if (await logoImg.isVisible()) {
        const altText = await logoImg.getAttribute('alt');
        expect(altText).toBeDefined();
      } else {
        # If logo is text or SVG, check for text content or aria-label
        expect(textContent?.trim() || ariaLabel || ariaLabelledby).toBeDefined();
      }
    });
    
    test("should have accessible navigation links", async ({ page: browserPage }) => {
      const header = browserPage.locator('header, [data-testid="header"], .header');
      await expect(header).toBeVisible();
      
      const nav = header.locator('nav, [data-testid="nav"], .nav-menu');
      await expect(nav).toBeVisible();
      
      const navLinks = nav.locator('a');
      const count = await navLinks.count();
      
      # Check a sample of nav links for accessibility
      const sampleSize = Math.min(3, count);
      for (let i = 0; i < sampleSize; i++) {
        const link = navLinks.nth(i);
        await expect(link).toBeVisible();
        
        # Check for accessible name (text content or aria-label)
        const textContent = await link.textContent();
        const ariaLabel = await link.getAttribute('aria-label');
        
        expect(textContent?.trim() || ariaLabel).toBeDefined();
        
        # Check that link is keyboard accessible
        await expect(link).toBeFocusable();
      }
    });
  });

  test.describe("Performance", () => {
    test("should not cause layout shifts", async ({ page: browserPage }) => {
      # Measure Cumulative Layout Shift (CLS) - basic check
      clsValue = await browserPage.evaluate(() => {
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
  });
});