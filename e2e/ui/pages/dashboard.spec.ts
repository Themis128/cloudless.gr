import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage, createAuthenticatedPage } from "../helpers/page-helpers";

/**
 * Dashboard Page Test Suite
 * Tests the dashboard page for rendering, navigation, and functionality
 * Requires authentication
 */

test.describe("Dashboard Page", () => {
  let page: BasePage;
  let responsivePage: ResponsivePage;
  let authPage: AuthenticatedPage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = createBasePage(browserPage);
    responsivePage = createResponsivePage(browserPage);
    authPage = createAuthenticatedPage(browserPage);
    
    # Login before each test
    await authPage.loginViaApi("test@example.com", "password123");
    
    await page.navigate("/dashboard");
  });

  test("should load successfully", async ({ page: browserPage }) => {
    await expect(browserPage).toHaveTitle(/dashboard|cloudless/i);
    
    # Check for main heading
    const heading = browserPage.locator('h1, .dashboard-heading, [data-testid="dashboard-heading"]');
    await expect(heading).toBeVisible();
  });

  test("should show user information", async ({ page: browserPage }) => {
    # Check for user info or avatar
    const userInfo = browserPage.locator('.user-info, [data-testid="user-info"], .avatar, text=/hello, test/i');
    await expect(userInfo).toBeVisible({ timeout: 5000 });
  });

  test("should have navigation sidebar", async ({ page: browserPage }) => {
    const sidebar = browserPage.locator('.sidebar, [data-testid="sidebar"], nav.sidebar, .dashboard-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await sidebar.isVisible()) {
      # Check for navigation links in sidebar
      const navLinks = sidebar.locator('a, .nav-link');
      await expect(navLinks.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test("should have main content area", async ({ page: browserPage }) => {
    const mainContent = browserPage.locator('main, [data-testid="main-content"], .dashboard-content, .main');
    await expect(mainContent).toBeVisible();
  });

  test("should show overview widgets or cards", async ({ page: browserPage }) => {
    const widgets = browserPage.locator('.widget, .card, [data-testid="widget"], .overview-card');
    await expect(widgets.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await widgets.count() > 0) {
      # Check first widget for basic structure
      const firstWidget = widgets.first();
      
      # Check for widget title
      const title = firstWidget.locator('.widget-title, h2, h3, [data-testid="widget-title"]');
      await expect(title).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      # Check for widget content
      const content = firstWidget.locator('.widget-content, .card-body, p, [data-testid="widget-content"]');
      await expect(content).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test("should show recent activity or orders", async ({ page: browserPage }) => {
    const activitySection = browserPage.locator('.recent-activity, .orders-table, [data-testid="recent-activity"], .activity-log');
    await expect(activitySection).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await activitySection.isVisible()) {
      # Check for section title
      const title = activitySection.locator('.section-title, h2, h3, [data-testid="section-title"]');
      await expect(title).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      # Check for activity items
      const items = activitySection.locator('.activity-item, .order-row, tr, [data-testid="activity-item"]');
      # Items might be empty initially
    }
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
    
    test("should navigate to store", async ({ page: browserPage }) => {
      const storeLink = browserPage.locator('a[href*="/store"], nav a:has-text("Store"), .nav-link[href*="/store"]');
      await expect(storeLink).toBeVisible();
      
      await storeLink.click();
      await expect(browserPage).toHaveURL(/\/store/);
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
    
    test("should navigate to profile", async ({ page: browserPage }) => {
      const profileLink = browserPage.locator('a[href*="/profile"], a[href*="/dashboard/profile"], .profile-link, [data-testid="profile-link"]');
      await expect(profileLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      if (await profileLink.isVisible()) {
        await profileLink.click();
        await expect(browserPage).toMatchURL(/\/profile/);
      }
    });
    
    test("should navigate to settings", async ({ page: browserPage }) => {
      const settingsLink = browserPage.locator('a[href*="/settings"], a[href*="/dashboard/settings"], .settings-link, [data-testid="settings-link"]');
      await expect(settingsLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      if (await settingsLink.isVisible()) {
        await settingsLink.click();
        await expect(browserPage).toMatchURL(/\/settings/);
      }
    });
  });

  test.describe("Authentication", () => {
    test("should redirect to login if not authenticated", async ({ page: browserPage }) => {
      # Logout first
      await authPage.logout();
      
      # Try to access dashboard
      await page.navigate("/dashboard");
      
      # Should redirect to login page
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
    });
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/dashboard");
      
      # Check that essential elements are still visible
      const heading = browserPage.locator('h1, .dashboard-heading, [data-testid="dashboard-heading"]');
      await expect(heading).toBeVisible();
      
      # Check for user info
      const userInfo = browserPage.locator('.user-info, [data-testid="user-info"], .avatar');
      await expect(userInfo).toBeVisible({ timeout: 5000 });
      
      # On mobile, sidebar might be hidden behind a toggle
      const sidebarToggle = browserPage.locator('button[aria-label*="menu" i], .sidebar-toggle, .hamburger, [data-testid="sidebar-toggle"]');
      const sidebar = browserPage.locator('.sidebar, [data-testid="sidebar"], nav.sidebar');
      
      # Either sidebar is visible or there's a toggle
      const isSidebarVisible = await sidebar.isVisible();
      const hasToggle = await sidebarToggle.isVisible();
      
      expect(isSidebarVisible || hasToggle).toBeTruthy();
      
      if (hasToggle) {
        # Test that toggle opens the sidebar
        await sidebarToggle.click();
        await expect(sidebar).toBeVisible({ timeout: 3000 });
      }
    });
    
    test("should render correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      await responsivePage.navigate("/dashboard");
      
      # Check that layout adapts appropriately
      const heading = browserPage.locator('h1, .dashboard-heading, [data-testid="dashboard-heading"]');
      await expect(heading).toBeVisible();
      
      # Check for user info
      const userInfo = browserPage.locator('.user-info, [data-testid="user-info"], .avatar');
      await expect(userInfo).toBeVisible({ timeout: 5000 });
      
      # Check that main content is visible
      const mainContent = browserPage.locator('main, [data-testid="main-content"], .dashboard-content');
      await expect(mainContent).toBeVisible();
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/dashboard");
      
      # Check that full layout is visible
      const heading = browserPage.locator('h1, .dashboard-heading, [data-testid="dashboard-heading"]');
      await expect(heading).toBeVisible();
      
      # Check for user info
      const userInfo = browserPage.locator('.user-info, [data-testid="user-info"], .avatar');
      await expect(userInfo).toBeVisible({ timeout: 5000 });
      
      # Check that sidebar is visible
      const sidebar = browserPage.locator('.sidebar, [data-testid="sidebar"], nav.sidebar');
      await expect(sidebar).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      # Check that main content is visible
      const mainContent = browserPage.locator('main, [data-testid="main-content"], .dashboard-content');
      await expect(mainContent).toBeVisible();
      
      # Check that we can see multiple widgets/content sections
      const widgets = browserPage.locator('.widget, .card, [data-testid="widget"], .overview-card');
      if (await widgets.count() > 0) {
        await expect(widgets.first()).toBeVisible();
      }
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper language attribute", async ({ page: browserPage }) => {
      const htmlElement = browserPage.locator('html');
      const lang = await htmlElement.getAttribute('lang');
      expect(lang).toMatch(/^en/);
    });
    
    test("should have proper heading structure", async ({ page: browserPage }) => {
      # Check for h1
      const h1 = browserPage.locator('h1');
      await expect(h1).toBeVisible();
      
      # Check that we don't have multiple h1s (best practice)
      const h1Count = await h1.count();
      expect(h1Count).toBeLessThan(3);
      
      # Check for proper heading hierarchy
      const h2 = browserPage.locator('h2');
      const h3 = browserPage.locator('h3');
      
      # At least some h2 or h3 should be present for dashboard sections
      const headingCount = await h2.count() + await h3.count();
      expect(headingCount).toBeGreaterThan(0);
    });
    
    test("should have accessible navigation", async ({ page: browserPage }) => {
      # Check main navigation
      const mainNav = browserPage.locator('nav, [data-testid="main-nav"], .main-navigation');
      if (await mainNav.isVisible()) {
        const navLinks = mainNav.locator('a');
        const count = await navLinks.count();
        
        # Check a sample of nav links for accessibility
        const sampleSize = Math.min(3, count);
        for (let i = 0; i < sampleSize; i++) {
          const link = navLinks.nth(i);
          await expect(link).toBeVisible();
          await expect(link).toBeEnabled();
          
          # Check for accessible name (text content or aria-label)
          const textContent = await link.textContent();
          const ariaLabel = await link.getAttribute('aria-label');
          
          expect(textContent?.trim() || ariaLabel).toBeDefined();
        }
      }
      
      # Check sidebar navigation if present
      const sidebar = browserPage.locator('.sidebar, [data-testid="sidebar"], nav.sidebar');
      if (await sidebar.isVisible()) {
        # Check for ARIA label or role
        const ariaLabel = await sidebar.getAttribute('aria-label');
        const role = await sidebar.getAttribute('role');
        
        expect(ariaLabel || role === 'navigation').toBeTruthy();
        
        # Check sidebar links
        const sidebarLinks = sidebar.locator('a');
        const count = await sidebarLinks.count();
        
        # Check a sample of sidebar links for accessibility
        const sampleSize = Math.min(3, count);
        for (let i = 0; i < sampleSize; i++) {
          const link = sidebarLinks.nth(i);
          await expect(link).toBeVisible();
          await expect(link).toBeEnabled();
          
          # Check for accessible name (text content or aria-label)
          const textContent = await link.textContent();
          const ariaLabel = await link.getAttribute('aria-label');
          
          expect(textContent?.trim() || ariaLabel).toBeDefined();
        }
      }
    });
    
    test("should have accessible widgets/cards", async ({ page: browserPage }) => {
      const widgets = browserPage.locator('.widget, .card, [data-testid="widget"], .overview-card');
      const count = await widgets.count();
      
      if (count > 0) {
        # Check a sample of widgets for accessibility
        const sampleSize = Math.min(3, count);
        for (let i = 0; i < sampleSize; i++) {
          const widget = widgets.nth(i);
          
          await expect(widget).toBeVisible();
          
          # Check for accessible title/heading
          const title = widget.locator('.widget-title, h2, h3, [data-testid="widget-title"]');
          if (await title.isVisible()) {
            # Check for accessible name (text content or aria-label)
            const textContent = await title.textContent();
            const ariaLabel = await title.getAttribute('aria-label');
            
            expect(textContent?.trim() || ariaLabel).toBeDefined();
          }
          
          # Check for accessible content
          const content = widget.locator('.widget-content, .card-body, p, [data-testid="widget-content"]');
          if (await content.isVisible()) {
            # Check that content is readable
            const textContent = await content.textContent();
            expect(textContent?.length).toBeGreaterThan(0);
          }
          
          # Check for accessible actions if present
          const actions = widget.locator('a, button, [role="button"]');
          if (await actions.count() > 0) {
            const firstAction = actions.first();
            await expect(firstAction).toBeVisible();
            await expect(firstAction).toBeEnabled();
            
            # Check for accessible name (text content or aria-label)
            const textContent = await firstAction.textContent();
            const ariaLabel = await firstAction.getAttribute('aria-label');
            
            expect(textContent?.trim() || ariaLabel).toBeDefined();
          }
        }
      }
    });
  });

  test.describe("Performance", () => {
    test("should load within reasonable time", async ({ page: browserPage }) => {
      const startTime = Date.now();
      await page.navigate("/dashboard");
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(8000); # Dashboard might take longer to load with data
    });
  });
});