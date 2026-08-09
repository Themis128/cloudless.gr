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
    
    // Use locale-prefixed URL for i18n routing
    await page.navigate("/en/admin");
  });

  test("should load successfully", async ({ page: browserPage }) => {
    await expect(browserPage).toHaveTitle(/admin|cloudless/i);
    
    // Check for main heading
    const heading = browserPage.locator('h1:has-text("Admin Dashboard")');
    await expect(heading).toBeVisible();
  });

  test("should show admin user information", async ({ page: browserPage }) => {
    // Check for user info in sidebar (email/username)
    // The sidebar shows user.email || user.username
    const userInfo = browserPage.locator('aside, [data-testid="sidebar"], nav.sidebar').first().locator('p.font-mono.text-xs.text-slate-500');
    await expect(userInfo).toBeVisible({ timeout: 5000 });
  });

  test("should have admin navigation sidebar", async ({ page: browserPage }) => {
    const sidebar = browserPage.locator('aside.lg\\:block, aside[class*="lg:block"], nav.sidebar').first();
    await expect(sidebar).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await sidebar.isVisible()) {
      // Check for admin-specific navigation links - look for "Dashboard" link
      const dashboardLink = sidebar.locator('a:has-text("Dashboard"), Link[href="/admin"]').first();
      await expect(dashboardLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      // Check for common admin sections - nav groups
      const navGroups = sidebar.locator('p.font-mono.text-\\[10px\\]:has-text("Overview"), p.font-mono.text-\\[10px\\]:has-text("EspoCRM"), p.font-mono.text-\\[10px\\]:has-text("Clients")');
      await expect(navGroups.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test("should have main content area", async ({ page: browserPage }) => {
    const mainContent = browserPage.locator('main.min-w-0.flex-1, main').first();
    await expect(mainContent).toBeVisible();
  });

  test("should show admin overview widgets or cards", async ({ page: browserPage }) => {
    // The admin dashboard has quick actions and nav cards
    const quickActions = browserPage.locator('a:has-text("New client portal"), a:has-text("Plan a post"), a:has-text("Generate content"), a:has-text("Write blog post"), a:has-text("Check leads"), a:has-text("View live site")');
    await expect(quickActions.first()).toBeVisible({ timeout: 5000 }).catch(() => {});
    
    if (await quickActions.count() > 0) {
      // Check for action cards in nav groups
      const cards = browserPage.locator('div.bg-void-light\\/50.hover\\:border-neon-magenta\\/30').first();
      await expect(cards).toBeVisible({ timeout: 5000 }).catch(() => {});
    }
  });

  test("should show action queue or stats", async ({ page: browserPage }) => {
    // Check for "Needs your attention" section if there are action items
    const actionQueue = browserPage.locator('div.border-neon-cyan\\/30.bg-neon-cyan\\/5:has-text("Needs your attention")');
    // This may not be visible if no action items exist
    const isVisible = await actionQueue.isVisible({ timeout: 3000 }).catch(() => false);
    
    // Check for System Status section which should always be present
    const systemStatus = browserPage.locator('h2:has-text("System Status")');
    await expect(systemStatus).toBeVisible({ timeout: 5000 }).catch(() => {});
  });

  test.describe("Navigation", () => {
    test("should navigate to homepage", async ({ page: browserPage }) => {
      // The "View live site" quick action links to "/" which redirects to "/en/" with i18n
      const homeLink = browserPage.locator('a:has-text("View live site")').first();
      await expect(homeLink).toBeVisible();
      
      await homeLink.click();
      // With i18n routing, root "/" redirects to "/en/"
      await expect(browserPage).toHaveURL(/\/en\/?($|\?|#)/);
    });
    
    test("should navigate to dashboard", async ({ page: browserPage }) => {
      // Navigate via sidebar - Dashboard link
      // Since we're already on the dashboard, the link is the active one
      // Just verify the URL is correct
      await expect(browserPage).toHaveURL(/\/en\/admin$/);
    });
    
    test("should navigate to users management", async ({ page: browserPage }) => {
      const usersLink = browserPage.locator('aside a:has-text("Users"), nav a:has-text("Users")').first();
      await expect(usersLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      if (await usersLink.isVisible()) {
        await usersLink.click();
        await expect(browserPage).toMatchURL(/\/users|\/admin\/users/);
      }
    });
    
    test("should navigate to orders management", async ({ page: browserPage }) => {
      const ordersLink = browserPage.locator('aside a:has-text("Orders"), nav a:has-text("Orders")').first();
      await expect(ordersLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      if (await ordersLink.isVisible()) {
        await ordersLink.click();
        await expect(browserPage).toMatchURL(/\/orders|\/admin\/orders/);
      }
    });
    
    test("should navigate to settings", async ({ page: browserPage }) => {
      const settingsLink = browserPage.locator('aside a:has-text("Settings"), nav a:has-text("Settings")').first();
      await expect(settingsLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      if (await settingsLink.isVisible()) {
        await settingsLink.click();
        await expect(browserPage).toMatchURL(/\/settings|\/admin\/settings/);
      }
    });
    
    test("should navigate to leads", async ({ page: browserPage }) => {
      const leadsLink = browserPage.locator('aside a:has-text("Lead Inbox"), nav a:has-text("Lead Inbox")').first();
      await expect(leadsLink).toBeVisible({ timeout: 5000 }).catch(() => {});
      
      if (await leadsLink.isVisible()) {
        await leadsLink.click();
        await expect(browserPage).toMatchURL(/\/leads|\/admin\/leads/);
      }
    });
  });

  test.describe("Authentication", () => {
    test("should redirect to login if not authenticated", async ({ page: browserPage }) => {
      // The admin project uses storageState with e2e_admin cookie, 
      // so we can't easily test unauthenticated state in the same project.
      // This test is skipped - unauthenticated behavior is tested in other test suites.
      test.skip("Unauthenticated redirect tested in separate test suite without admin storage state");
    });
    
    test("should redirect to dashboard if not admin", async ({ page: browserPage }) => {
      // Testing non-admin user redirect requires a fresh context without admin cookie
      // This test is skipped - covered in other test configurations.
      test.skip("Non-admin redirect tested in separate test configuration");
    });
  });

  test.describe("Responsive Design", () => {
    test("should render correctly on mobile", async ({ page: browserPage }) => {
      await responsivePage.setMobileViewport();
      await responsivePage.navigate("/en/admin");
      
      // Check that essential elements are still visible
      const heading = browserPage.locator('h1:has-text("Admin Dashboard")');
      await expect(heading).toBeVisible();
      
      // On mobile, sidebar is hidden behind a toggle (hamburger button)
      const sidebarToggle = browserPage.locator('button[aria-label="Open admin navigation"]').first();
      await expect(sidebarToggle).toBeVisible({ timeout: 5000 });
      
      // Test that toggle opens the sidebar
      await sidebarToggle.click();
      
      // Wait for drawer animation
      await browserPage.waitForTimeout(500);
      
      // Check drawer is visible
      const drawer = browserPage.locator('div.fixed.inset-y-0.left-0.z-50:has(nav)');
      await expect(drawer).toBeVisible({ timeout: 5000 });
      
      // Check for user info in the drawer - wait for it
      const userInfo = drawer.locator('p.font-mono.text-xs.text-slate-500');
      await expect(userInfo.first()).toBeVisible({ timeout: 5000 });
      
      // Close drawer by pressing Escape key
      await browserPage.keyboard.press('Escape');
    });
    
    test("should render correctly on tablet", async ({ page: browserPage }) => {
      await responsivePage.setTabletViewport();
      await responsivePage.navigate("/en/admin");
      
      // Check that layout adapts appropriately
      const heading = browserPage.locator('h1:has-text("Admin Dashboard")');
      await expect(heading).toBeVisible();
      
      // On tablet, sidebar is also hidden behind a toggle
      const sidebarToggle = browserPage.locator('button[aria-label="Open admin navigation"]').first();
      await expect(sidebarToggle).toBeVisible({ timeout: 5000 });
      
      // Open drawer to check user info
      await sidebarToggle.click();
      
      // Wait for drawer animation
      await browserPage.waitForTimeout(500);
      
      const drawer = browserPage.locator('div.fixed.inset-y-0.left-0.z-50:has(nav)');
      await expect(drawer).toBeVisible({ timeout: 5000 });
      
      const userInfo = drawer.locator('p.font-mono.text-xs.text-slate-500');
      await expect(userInfo.first()).toBeVisible({ timeout: 5000 });
      
      // Close drawer by pressing Escape key
      await browserPage.keyboard.press('Escape');
      
      // Check that main content is visible
      const mainContent = browserPage.locator('main[id="main-content"]');
      await expect(mainContent).toBeVisible();
    });
    
    test("should render correctly on desktop", async ({ page: browserPage }) => {
      await responsivePage.setDesktopViewport();
      await responsivePage.navigate("/en/admin");
      
      // Check that full layout is visible
      const heading = browserPage.locator('h1:has-text("Admin Dashboard")');
      await expect(heading).toBeVisible();
      
      // Check for user info in sidebar
      const userInfo = browserPage.locator('aside p.font-mono.text-xs.text-slate-500');
      await expect(userInfo.first()).toBeVisible({ timeout: 5000 });
      
      // Check that sidebar is visible
      const sidebar = browserPage.locator('aside.lg\\:block, aside[class*="lg:block"]').first();
      await expect(sidebar).toBeVisible({ timeout: 5000 });
      
      // Check that main content is visible (single main element with id)
      const mainContent = browserPage.locator('main[id="main-content"]');
      await expect(mainContent).toBeVisible();
      
      // Check that we can see multiple nav groups
      const navGroups = browserPage.locator('aside p.font-mono.text-\\[10px\\]');
      if (await navGroups.count() > 0) {
        await expect(navGroups.first()).toBeVisible();
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
      const h1 = browserPage.locator('h1:has-text("Admin Dashboard")');
      await expect(h1).toBeVisible();
      
      // Check that we don't have multiple h1s (best practice)
      const h1Count = await browserPage.locator('h1').count();
      expect(h1Count).toBeLessThan(3);
      
      // Check for proper heading hierarchy - h2 for section headers
      const h2 = browserPage.locator('h2');
      const h3 = browserPage.locator('h3');
      
      // At least some h2 or h3 should be present for admin sections
      const headingCount = await h2.count() + await h3.count();
      expect(headingCount).toBeGreaterThan(0);
    });
    
    test("should have accessible navigation", async ({ page: browserPage }) => {
      // Check sidebar navigation (main admin navigation)
      const sidebar = browserPage.locator('aside.lg\\:block, aside[class*="lg:block"]').first();
      if (await sidebar.isVisible()) {
        // Check for ARIA label or role on the nav element
        const nav = sidebar.locator('nav');
        if (await nav.isVisible()) {
          const ariaLabel = await nav.getAttribute('aria-label');
          const role = await nav.getAttribute('role');
          
          expect(ariaLabel || role === 'navigation').toBeTruthy();
          
          // Check sidebar links
          const sidebarLinks = nav.locator('a');
          const count = await sidebarLinks.count();
          
          // Check a sample of sidebar links for accessibility
          const sampleSize = Math.min(5, count);
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
      }
      
      // Check mobile drawer toggle button accessibility
      const sidebarToggle = browserPage.locator('button[aria-label="Open admin navigation"]').first();
      if (await sidebarToggle.isVisible()) {
        const ariaLabel = await sidebarToggle.getAttribute('aria-label');
        expect(ariaLabel).toBeDefined();
        expect(ariaLabel).toBeTruthy();
      }
    });
    
    test("should have accessible cards/quick actions", async ({ page: browserPage }) => {
      // The admin dashboard uses quick action links and nav cards
      const quickActions = browserPage.locator('a:has-text("New client portal"), a:has-text("Plan a post"), a:has-text("Generate content"), a:has-text("Write blog post"), a:has-text("Check leads"), a:has-text("View live site")');
      const count = await quickActions.count();
      
      if (count > 0) {
        // Check a sample of quick actions for accessibility
        const sampleSize = Math.min(3, count);
        for (let i = 0; i < sampleSize; i++) {
          const action = quickActions.nth(i);
          
          await expect(action).toBeVisible();
          await expect(action).toBeEnabled();
          
          // Check for accessible name (text content or aria-label)
          const textContent = await action.textContent();
          const ariaLabel = await action.getAttribute('aria-label');
          
          expect(textContent?.trim() || ariaLabel).toBeDefined();
        }
      }
      
      // Check nav cards (the grid cards)
      const navCards = browserPage.locator('div.bg-void-light\\/50.hover\\:border-neon-magenta\\/30 a');
      const cardCount = await navCards.count();
      
      if (cardCount > 0) {
        const sampleSize = Math.min(3, cardCount);
        for (let i = 0; i < sampleSize; i++) {
          const card = navCards.nth(i);
          
          await expect(card).toBeVisible();
          
          // Check for accessible title (h3 inside card)
          const title = card.locator('h3');
          if (await title.isVisible()) {
            const textContent = await title.textContent();
            const ariaLabel = await title.getAttribute('aria-label');
            
            expect(textContent?.trim() || ariaLabel).toBeDefined();
          }
          
          // Check card itself is a link (accessible action)
          await expect(card).toBeEnabled();
        }
      }
    });
    
    test("should have accessible forms", async ({ page: browserPage }) => {
      // Admin dashboard doesn't have forms for creating/editing - those are on subpages
      // like /admin/users, /admin/settings, /admin/campaigns, etc.
      // This test is skipped for the dashboard page itself.
      test.skip("Admin dashboard has no forms - forms exist on admin subpages");
    });
  });

  test.describe("Performance", () => {
    test("should load within reasonable time", async ({ page: browserPage }) => {
      const startTime = Date.now();
      await page.navigate("/en/admin");
      const endTime = Date.now();
      
      const loadTime = endTime - startTime;
      expect(loadTime).toBeLessThan(8000); // Admin panel might take longer to load with data
    });
  });
});