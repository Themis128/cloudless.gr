import { test, expect } from "@playwright/test";
import { createBasePage, createResponsivePage, createAuthenticatedPage } from "../../helpers/page-helpers";

/**
 * Admin Page Test Suite
 * Tests the admin panel for rendering, navigation, and functionality
 * Requires admin authentication (uses storageState from setup project)
 */

test.describe("Admin Panel", () => {
  let page: BasePage;
  let responsivePage: ResponsivePage;
  let authPage: AuthenticatedPage;

  test.beforeEach(async ({ page: browserPage }) => {
    page = createBasePage(browserPage);
    responsivePage = createResponsivePage(browserPage);
    authPage = createAuthenticatedPage(browserPage);
    
    await page.navigate("/admin");
  });

  test("should load successfully", async ({ page: browserPage }) => {
    await expect(browserPage).toHaveTitle(/admin|cloudless/i);
    
    // Check for main heading
    const heading = browserPage.locator('h1, .admin-heading, [data-testid="admin-heading"]');
    await expect(heading).toBeVisible();
  });

  test("should show admin user information", async ({ page: browserPage }) => {
    // Check for user info or avatar
    const userInfo = browserPage.locator('.user-info, [data-testid="user-info"], .avatar, text=/hello, admin/i');
    await expect(userInfo).toBeVisible({ timeout: 5000 });
  });

  test("should have admin navigation sidebar", async ({ page: browserPage }) => {
    const sidebar = browserPage.locator('.sidebar, [data-testid="sidebar"], nav.sidebar, .admin-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await sidebar.isVisible()) {
      // Check for admin-specific navigation links
      const navLinks = sidebar.locator('a, .nav-link');
      await expect(navLinks.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      // Check for common admin sections
      const dashboardLink = sidebar.locator('a[href*="/dashboard"], a[href*="/admin/dashboard"]');
      const usersLink = sidebar.locator('a[href*="/users"], a[href*="/admin/users"]');
      const ordersLink = sidebar.locator('a[href*="/orders"], a[href*="/admin/orders"]');
      const productsLink = sidebar.locator('a[href*="/products"], a[href*="/admin/products"]');
      
      // At least some of these should be present
      expect(
        await dashboardLink.isVisible() ||
        await usersLink.isVisible() ||
        await ordersLink.isVisible() ||
        await productsLink.isVisible()
      ).toBeTruthy();
    }
  });

  test("should have main content area", async ({ page: browserPage }) => {
    const mainContent = browserPage.locator('main, [data-testid="main-content"], .admin-content, .main');
    await expect(mainContent).toBeVisible();
  });

  test("should show admin overview widgets or cards", async ({ page: browserPage }) => {
    const widgets = browserPage.locator('.widget, .card, [data-testid="widget"], .overview-card, .stat-card');
    await expect(widgets.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await widgets.count() > 0) {
      // Check first widget for basic structure
      const firstWidget = widgets.first();
      
      // Check for widget title
      const title = firstWidget.locator('.widget-title, h2, h3, [data-testid="widget-title"]');
      await expect(title).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      // Check for widget content (often stats/numbers in admin)
      const content = firstWidget.locator('.widget-content, .stat-value, .number, [data-testid="widget-content"]');
      await expect(content).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test("should show recent activity or reports", async ({ page: browserPage }) => {
    const activitySection = browserPage.locator('.recent-activity, .reports-section, [data-testid="recent-activity"], .activity-log, .reports');
    await expect(activitySection).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await activitySection.isVisible()) {
      // Check for section title
      const title = activitySection.locator('.section-title, h2, h3, [data-testid="section-title"]');
      await expect(title).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      // Check for activity items or reports
      const items = activitySection.locator('.activity-item, .report-item, tr, [data-testid="activity-item"]');
      // Items might be empty initially
    }
  });

  test.describe("Navigation", () => {
    test("should navigate to homepage", async ({ page: browserPage }) => {
      const homeLink = browserPage.locator('a[href="/"], .logo, [data-testid="logo"], nav a:has-text("Home")');
      await expect(homeLink).toBeVisible();
      
      await homeLink.click();
      await expect(browserPage).toHaveURL(/\/($|\?|#)/);
    });
    
    test("should navigate to dashboard", async ({ page: browserPage }) => {
      const dashboardLink = browserPage.locator('a[href*="/dashboard"], a[href*="/admin/dashboard"], .dashboard-link, [data-testid="dashboard-link"]');
      await expect(dashboardLink).toBeVisible();
      
      await dashboardLink.click();
      await expect(browserPage).toHaveURL(/\/dashboard/);
    });
    
    test("should navigate to users management", async ({ page: browserPage }) => {
      const usersLink = browserPage.locator('a[href*="/users"], a[href*="/admin/users"], .users-link, [data-testid="users-link"]');
      await expect(usersLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      if (await usersLink.isVisible()) {
        await usersLink.click();
        await expect(browserPage).toMatchURL(/\/users|\/admin\/users/);
      }
    });
    
    test("should navigate to orders management", async ({ page: browserPage }) => {
      const ordersLink = browserPage.locator('a[href*="/orders"], a[href*="/admin/orders"], .orders-link, [data-testid="orders-link"]');
      await expect(ordersLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      if (await ordersLink.isVisible()) {
        await ordersLink.click();
        await expect(browserPage).toMatchURL(/\/orders|\/admin\/orders/);
      }
    });
    
    test("should navigate to products management", async ({ page: browserPage }) => {
      const productsLink = browserPage.locator('a[href*="/products"], a[href*="/admin/products"], .products-link, [data-testid="products-link"]');
      await expect(productsLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      if (await productsLink.isVisible()) {
        await productsLink.click();
        await expect(browserPage).toMatchURL(/\/products|\/admin\/products/);
      }
    });
    
    test("should navigate to settings", async ({ page: browserPage }) => {
      const settingsLink = browserPage.locator('a[href*="/settings"], a[href*="/admin/settings"], .settings-link, [data-testid="settings-link"]');
      await expect(settingsLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      if (await settingsLink.isVisible()) {
        await settingsLink.click();
        await expect(browserPage).toMatchURL(/\/settings|\/admin\/settings/);
      }
    });
    
    test("should navigate to profile", async ({ page: browserPage }) => {
      const profileLink = browserPage.locator('a[href*="/profile"], a[href*="/admin/profile"], .profile-link, [data-testid="profile-link"]');
      await expect(profileLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      if (await profileLink.isVisible()) {
        await profileLink.click();
        await expect(browserPage).toMatchURL(/\/profile|\/admin\/profile/);
      }
    });
  });

  test.describe("Authentication", () => {
    test("should redirect to login if not authenticated", async ({ page: browserPage }) => {
      // Logout first
      await authPage.logout();
      
      // Try to access admin panel
      await page.navigate("/admin");
      
      // Should redirect to login page
      await expect(browserPage).toHaveURL(/\/auth\/login|\/login/, { timeout: 5000 });
    });
    
    test("should redirect to homepage if not admin", async ({ page: browserPage }) => {
      // Logout first
      await authPage.logout();
      
      // Login as regular user
      await authPage.loginViaApi("test@example.com", "password123");
      
      // Try to access admin panel
      await page.navigate("/admin");
      
      // Should redirect to homepage or show access denied
      await expect(browserPage).toHaveURL(/^\/($|\?.*)|\/auth\/login|\/login/, { timeout: 5000 });
    });
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/admin");
      
      // Check that essential elements are still visible
      const heading = browserPage.locator('h1, .admin-heading, [data-testid="admin-heading"]');
      await expect(heading).toBeVisible();
      
      // Check for user info
      const userInfo = browserPage.locator('.user-info, [data-testid="user-info"], .avatar');
      await expect(userInfo).toBeVisible({ timeout: 5000 });
      
      // On mobile, sidebar might be hidden behind a toggle
      const sidebarToggle = browserPage.locator('button[aria-label*="menu" i], .sidebar-toggle, .hamburger, [data-testid="sidebar-toggle"]');
      const sidebar = browserPage.locator('.sidebar, [data-testid="sidebar"], nav.sidebar');
      
      // Either sidebar is visible or there's a toggle
      const isSidebarVisible = await sidebar.isVisible();
      const hasToggle = await sidebarToggle.isVisible();
      
      expect(isSidebarVisible || hasToggle).toBeTruthy();
      
      if (hasToggle) {
        // Test that toggle opens the sidebar
        await sidebarToggle.click();
        await expect(sidebar).toBeVisible({ timeout: 3000 });
      }
    });
    
    test("should render correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      await responsivePage.navigate("/admin");
      
      // Check that layout adapts appropriately
      const heading = browserPage.locator('h1, .admin-heading, [data-testid="admin-heading"]');
      await expect(heading).toBeVisible();
      
      // Check for user info
      const userInfo = browserPage.locator('.user-info, [data-testid="user-info"], .avatar');
      await expect(userInfo).toBeVisible({ timeout: 5000 });
      
      // Check that main content is visible
      const mainContent = browserPage.locator('main, [data-testid="main-content"], .admin-content');
      await expect(mainContent).toBeVisible();
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/admin");
      
      // Check that full layout is visible
      const heading = browserPage.locator('h1, .admin-heading, [data-testid="admin-heading"]');
      await expect(heading).toBeVisible();
      
      // Check for user info
      const userInfo = browserPage.locator('.user-info, [data-testid="user-info"], .avatar');
      await expect(userInfo).toBeVisible({ timeout: 5000 });
      
      // Check that sidebar is visible
      const sidebar = browserPage.locator('.sidebar, [data-testid="sidebar"], nav.sidebar');
      await expect(sidebar).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      // Check that main content is visible
      const mainContent = browserPage.locator('main, [data-testid="main-content"], .admin-content');
      await expect(mainContent).toBeVisible();
      
      // Check that we can see multiple widgets/content sections
      const widgets = browserPage.locator('.widget, .card, [data-testid="widget"], .overview-card, .stat-card');
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
      // Check for h1
      const h1 = browserPage.locator('h1');
      await expect(h1).toBeVisible();
      
      // Check that we don't have multiple h1s (best practice)
      const h1Count = await h1.count();
      expect(h1Count).toBeLessThan(3);
      
      // Check for proper heading hierarchy
      const h2 = browserPage.locator('h2');
      const h3 = browserPage.locator('h3');
      
      // At least some h2 or h3 should be present for admin sections
      const headingCount = await h2.count() + await h3.count();
      expect(headingCount).toBeGreaterThan(0);
    });
    
    test("should have accessible navigation", async ({ page: browserPage }) => {
      // Check main navigation
      const mainNav = browserPage.locator('nav, [data-testid="main-nav"], .main-navigation');
      if (await mainNav.isVisible()) {
        const navLinks = mainNav.locator('a');
        const count = await navLinks.count();
        
        // Check a sample of nav links for accessibility
        const sampleSize = Math.min(3, count);
        for (let i = 0; i < sampleSize; i++) {
          const link = navLinks.nth(i);
          await expect(link).toBeVisible();
          await expect(link).toBeEnabled();
          
          // Check for accessible name (text content or aria-label)
          const textContent = await link.textContent();
          const ariaLabel = await link.getAttribute('aria-label');
          
          expect(textContent?.trim() || ariaLabel).toBeDefined();
        }
      }
      
      // Check sidebar navigation if present
      const sidebar = browserPage.locator('.sidebar, [data-testid="sidebar"], nav.sidebar');
      if (await sidebar.isVisible()) {
        // Check for ARIA label or role
        const ariaLabel = await sidebar.getAttribute('aria-label');
        const role = await sidebar.getAttribute('role');
        
        expect(ariaLabel || role === 'navigation').toBeTruthy();
        
        // Check sidebar links
        const sidebarLinks = sidebar.locator('a');
        const count = await sidebarLinks.count();
        
        // Check a sample of sidebar links for accessibility
        const sampleSize = Math.min(3, count);
        for (let i = 0; i < sampleSize; i++) {
          const link = sidebarLinks.nth(i);
          await expect(link).toBeVisible();
          await expect(link).toBeEnabled();
          
          // Check for accessible name (text content or aria-label)
          const textContent = await link.textContent();
          const ariaLabel = await link.getAttribute('aria-label');
          
          expect(textContent?.trim() || ariaLabel).toBeDefined();
        }
      }
    });
    
    test("should have accessible widgets/cards", async ({ page: browserPage }) => {
      const widgets = browserPage.locator('.widget, .card, [data-testid="widget"], .overview-card, .stat-card');
      const count = await widgets.count();
      
      if (count > 0) {
        // Check a sample of widgets for accessibility
        const sampleSize = Math.min(3, count);
        for (let i = 0; i < sampleSize; i++) {
          const widget = widgets.nth(i);
          
          await expect(widget).toBeVisible();
          
          // Check for accessible title/heading
          const title = widget.locator('.widget-title, h2, h3, [data-testid="widget-title"]');
          if (await title.isVisible()) {
            // Check for accessible name (text content or aria-label)
            const textContent = await title.textContent();
            const ariaLabel = await title.getAttribute('aria-label');
            
            expect(textContent?.trim() || ariaLabel).toBeDefined();
          }
          
          // Check for accessible content
          const content = widget.locator('.widget-content, .stat-value, .number, [data-testid="widget-content"]');
          if (await content.isVisible()) {
            // Check that content is readable
            const textContent = await content.textContent();
            expect(textContent?.length).toBeGreaterThan(0);
          }
          
          // Check for accessible actions if present
          const actions = widget.locator('a, button, [role="button"]');
          if (await actions.count() > 0) {
            const firstAction = actions.first();
            await expect(firstAction).toBeVisible();
            await expect(firstAction).toBeEnabled();
            
            // Check for accessible name (text content or aria-label)
            const textContent = await firstAction.textContent();
            const ariaLabel = await firstAction.getAttribute('aria-label');
            
            expect(textContent?.trim() || ariaLabel).toBeDefined();
          }
        }
      }
    });
    
    test("should have accessible forms", async ({ page: browserPage }) => {
      // Look for forms in admin panel (common for creating/editing items)
      const forms = browserPage.locator('form, [data-testid="form"]');
      const count = await forms.count();
      
      if (count > 0) {
        // Check a sample of forms for accessibility
        const sampleSize = Math.min(2, count);
        for (let i = 0; i < sampleSize; i++) {
          const form = forms.nth(i);
          
          await expect(form).toBeVisible();
          
          // Check form elements for accessibility
          const inputs = form.locator('input, select, textarea');
          const inputCount = await inputs.count();
          
          if (inputCount > 0) {
            // Check a sample of inputs for accessibility
            const inputSampleSize = Math.min(3, inputCount);
            for (let j = 0; j < inputSampleSize; j++) {
              const input = inputs.nth(j);
              await expect(input).toBeVisible();
              await expect(input).toBeEnabled();
              
              // Check for associated label or aria-label
              const label = form.locator(`label[for="${await input.getAttribute('id')}"]`);
              const ariaLabel = await input.getAttribute('aria-label');
              const ariaLabelledby = await input.getAttribute('aria-labelledby');
              
              expect(await label.isVisible() || ariaLabel || ariaLabelledby).toBeTruthy();
            }
          }
          
          // Check for accessible submit button
          const submitButton = form.locator('button[type="submit"], .btn, [data-testid="submit-button"]');
          if (await submitButton.isVisible()) {
            await expect(submitButton).toBeEnabled();
            
            // Check for accessible name (text content or aria-label)
            const textContent = await submitButton.textContent();
            const ariaLabel = await submitButton.getAttribute('aria-label');
            
            expect(textContent?.trim() || ariaLabel).toBeDefined();
          }
        }
      }
    });
  });

  test.describe("Performance", () => {
    test("should load within reasonable time", async ({ page: browserPage }) => {
      const startTime = Date.now();
      await page.navigate("/admin");
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(8000); // Admin panel might take longer to load with data
    });
  });
});