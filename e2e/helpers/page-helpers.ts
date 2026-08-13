import { type Page, type Locator, expect } from "@playwright/test";

/**
 * Page Object Model helpers for E2E tests
 * Provides reusable page abstractions and common utilities
 */

// Base page with common navigation and utility methods
export class BasePage {
  constructor(protected page: Page) {}

  async navigate(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState("networkidle");
  }

  async waitForMainContent() {
    await this.page.waitForSelector("main", { timeout: 10_000 });
  }

  getHeading() {
    return this.page.locator("h1, .hero-heading, [data-testid='hero-heading']");
  }

  getNavigation() {
    return this.page.locator("nav, [data-testid='main-nav'], .main-navigation");
  }

  getFooter() {
    return this.page.locator("footer, [data-testid='footer'], .footer");
  }
}

// Responsive page helpers for viewport testing
export class ResponsivePage {
  constructor(protected page: Page) {}

  async setMobileViewport() {
    await this.page.setViewportSize({ width: 375, height: 667 });
  }

  async setTabletViewport() {
    await this.page.setViewportSize({ width: 768, height: 1024 });
  }

  async setDesktopViewport() {
    await this.page.setViewportSize({ width: 1280, height: 720 });
  }

  async navigate(path: string) {
    await this.page.goto(path);
    await this.page.waitForLoadState("networkidle");
  }
}

// Authenticated page helpers for login/logout flows
export class AuthenticatedPage {
  constructor(protected page: Page) {}

  async loginViaApi(email: string, password: string) {
    // Try API-based login first (faster and more reliable)
    try {
      const response = await this.page.request.post("/api/auth/login", {
        data: { email, password },
      });
      
      if (response.ok()) {
        // API login succeeded, cookies should be set
        return;
      }
    } catch (error) {
      // API login failed, fall back to UI login
      console.warn("API login failed, falling back to UI login:", error);
    }

    // Fallback: UI-based login
    await this.page.goto("/en/auth/login");
    await this.page.waitForSelector("form", { timeout: 5_000 });
    
    const emailInput = this.page.locator('input[name="email"], input[name="username"], input[type="email"]').first();
    const passwordInput = this.page.locator('input[name="password"], input[type="password"]').first();
    const submitButton = this.page.locator('button:has-text("Login"), button:has-text("Sign in"), button:has-text("Submit")').first();

    await emailInput.fill(email);
    await passwordInput.fill(password);
    await submitButton.click();
    
    // Wait for navigation after login
    await this.page.waitForTimeout(2000);
  }

  async logout() {
    // Try to find and click logout button/link
    const logoutButton = this.page.locator('button:has-text("Logout"), a:has-text("Logout"), button:has-text("Sign out"), a:has-text("Sign out")').first();
    
    if (await logoutButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      await logoutButton.click();
      await this.page.waitForTimeout(1000);
    }
  }
}

// Factory functions for creating page objects
export function createBasePage(page: Page): BasePage {
  return new BasePage(page);
}

export function createResponsivePage(page: Page): ResponsivePage {
  return new ResponsivePage(page);
}

export function createAuthenticatedPage(page: Page): AuthenticatedPage {
  return new AuthenticatedPage(page);
}

// Utility functions for common test assertions
export async function assertPageHasTitle(page: Page, expectedTitlePattern: string | RegExp) {
  await expect(page).toHaveTitle(expectedTitlePattern);
}

export async function assertElementVisible(page: Page, selector: string, timeout = 5000) {
  const element = page.locator(selector);
  await expect(element).toBeVisible({ timeout });
}

export async function assertElementContainsText(page: Page, selector: string, text: string | RegExp) {
  const element = page.locator(selector);
  await expect(element).toContainText(text);
}

export async function waitForElement(page: Page, selector: string, timeout = 5000) {
  await page.waitForSelector(selector, { timeout });
}

// Common selectors used across tests
export const SELECTORS = {
  // Navigation
  NAV: "nav, [data-testid='main-nav'], .main-navigation",
  FOOTER: "footer, [data-testid='footer'], .footer",
  
  // Common elements
  HEADING: "h1, h2, h3",
  HERO_HEADING: "h1, .hero-heading, [data-testid='hero-heading']",
  CTA_BUTTON: "a[href*='/services'], a[href*='/store'], .btn-primary, .cta-button",
  
  // Forms
  FORM: "form",
  EMAIL_INPUT: 'input[name="email"], input[name="your-email"], input[type="email"]',
  PASSWORD_INPUT: 'input[name="password"], input[type="password"]',
  SUBMIT_BUTTON: 'button:has-text("Submit"), button:has-text("Send"), button:has-text("Login"), button:has-text("Sign in")',
  
  // Feedback messages
  SUCCESS_MESSAGE: ".success, .confirmation, text=Thanks, text=Subscribed, text=Message sent",
  ERROR_MESSAGE: ".error, .alert, .invalid, text=Error, text=Invalid",
  
  // Loading states
  LOADING_SPINNER: ".spinner, .loading, [data-testid='loading']",
} as const;

// Re-export types
export type { Page, Locator };