// Page Object Helper Utilities for Comprehensive UI Testing
import { Page, Locator, expect } from "@playwright/test";

/**
 * Base page object class with common utilities
 */
export class BasePage {
  protected page: Page;
  protected baseURL: string;

  constructor(page: Page, baseURL: string = "") {
    this.page = page;
    this.baseURL = baseURL;
  }

  /**
   * Navigate to a page
   */
  async navigate(path: string = ""): Promise<void> {
    const url = this.baseURL + path;
    await this.page.goto(url);
    await this.waitForPageLoad();
  }

  /**
   * Wait for page to be fully loaded
   */
  async waitForPageLoad(timeout: number = 5000): Promise<void> {
    await this.page.waitForLoadState('networkidle', { timeout });
    // Wait for any potential hydration to complete
    await this.page.waitForTimeout(500);
  }

  /**
   * Wait for an element to be visible
   */
  async waitForVisible(
    selector: string | Locator,
    timeout: number = 5000
  ): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.waitFor({ state: 'visible', timeout });
  }

  /**
   * Wait for an element to be hidden
   */
  async waitForHidden(
    selector: string | Locator,
    timeout: number = 5000
  ): Promise<void> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    await locator.waitFor({ state: 'hidden', timeout });
  }

  /**
   * Click an element and wait for navigation
   */
  async clickAndNavigate(
    selector: string | Locator,
    options: {
      waitUntil?: 'load' | 'domcontentloaded' | 'networkidle';
      timeout?: number;
    } = {}
  ): Promise<void> {
    const { waitUntil = 'networkidle', timeout = 5000 } = options;
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    // Wait for navigation triggered by the click
    const [response] = await Promise.all([
      this.page.waitForNavigation({ waitUntil, timeout }),
      locator.click()
    ]);
    
    if (!response?.ok()) {
      throw new Error(`Navigation failed with status ${response?.status()}`);
    }
  }

  /**
   * Fill a form field
   */
  async fillField(
    selector: string | Locator,
    value: string,
    options: {
      clearFirst?: boolean;
      timeout?: number;
    } = {}
  ): Promise<void> {
    const { clearFirst = true, timeout = 5000 } = options;
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    await locator.waitFor({ state: 'visible', timeout });
    if (clearFirst) {
      await locator.fill('');
    }
    await locator.fill(value);
  }

  /**
   * Select an option from a dropdown
   */
  async selectOption(
    selector: string | Locator,
    value: string,
    options: {
      timeout?: number;
    } = {}
  ): Promise<void> {
    const { timeout = 5000 } = options;
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    await locator.waitFor({ state: 'visible', timeout });
    await locator.selectOption({ value });
  }

  /**
   * Check if an element exists
   */
  async elementExists(
    selector: string | Locator,
    timeout: number = 1000
  ): Promise<boolean> {
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    try {
      await locator.waitFor({ state: 'attached', timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get text content of an element
   */
  async getText(
    selector: string | Locator,
    options: {
      timeout?: number;
    } = {}
  ): Promise<string> {
    const { timeout = 5000 } = options;
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    await locator.waitFor({ state: 'visible', timeout });
    return locator.textContent() ?? '';
  }

  /**
   * Get attribute value of an element
   */
  async getAttribute(
    selector: string | Locator,
    attributeName: string,
    options: {
      timeout?: number;
    } = {}
  ): Promise<string | null> {
    const { timeout = 5000 } = options;
    const locator = typeof selector === 'string' ? this.page.locator(selector) : selector;
    
    await locator.waitFor({ state: 'visible', timeout });
    return locator.getAttribute(attributeName);
  }

  /**
   * Take a screenshot with a descriptive name
   */
  async takeScreenshot(name: string, options: {
    fullPage?: boolean;
    clip?: {
      x: number;
      y: number;
      width: number;
      height: number;
    };
  } = {}): Promise<Buffer> {
    const { fullPage = false, clip } = options;
    return this.page.screenshot({
      path: `test-results/screenshots/${name}-${Date.now()}.png`,
      fullPage,
      clip
    });
  }

  /**
   * Wait for a specific network request
   */
  async waitForRequest(
    url: string | RegExp,
    options: {
      timeout?: number;
    } = {}
  ): Promise<void> {
    const { timeout = 5000 } = options;
    await this.page.waitForRequest(url, { timeout });
  }

  /**
   * Wait for a specific network response
   */
  async waitForResponse(
    url: string | RegExp,
    options: {
      timeout?: number;
      status?: number;
    } = {}
  ): Promise<void> {
    const { timeout = 5000, status } = options;
    await this.page.waitForResponse(url, { timeout, status });
  }

  /**
   * Check if the current URL matches a pattern
   */
  async urlMatches(
    pattern: string | RegExp,
    options: {
      timeout?: number;
    } = {}
  ): Promise<boolean> {
    const { timeout = 5000 } = options;
    try {
      await this.page.waitForURL(pattern, { timeout });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get the current URL
   */
  getCurrentURL(): Promise<string> {
    return this.page.url();
  }

  /**
   * Go back in history
   */
  async goBack(): Promise<void> {
    await this.page.goBack();
    await this.waitForPageLoad();
  }

  /**
   * Go forward in history
   */
  async goForward(): Promise<void> {
    await this.page.goForward();
    await this.waitForPageLoad();
  }

  /**
   * Refresh the page
   */
  async refresh(): Promise<void> {
    await this.page.reload();
    await this.waitForPageLoad();
  }
}

/**
 * Specialized page object for authenticated pages
 */
export class AuthenticatedPage extends BasePage {
  constructor(page: Page, baseURL: string = "") {
    super(page, baseURL);
  }

  /**
   * Check if user is authenticated
   */
  async isAuthenticated(): Promise<boolean> {
    // This would typically check for auth indicators in the UI
    // Implementation depends on your auth system
    try {
      // Example: check for user avatar or logout button
      const userAvatar = this.page.locator('[data-testid="user-avatar"], .user-avatar, [href*="/logout"]');
      return await this.elementExists(userAvatar, 1000);
    } catch {
      return false;
    }
  }

  /**
   * Get user profile information from UI
   */
  async getUserProfile(): Promise<{
    name?: string;
    email?: string;
    avatarUrl?: string;
  }> {
    const profile: {
      name?: string;
      email?: string;
      avatarUrl?: string;
    } = {};
    
    try {
      // Try to get user name
      const nameElement = this.page.locator('[data-testid="user-name"], .user-name, .user-fullname');
      if (await this.elementExists(nameElement, 1000)) {
        profile.name = await this.getText(nameElement);
      }
      
      // Try to get user email
      const emailElement = this.page.locator('[data-testid="user-email"], .user-email');
      if (await this.elementExists(emailElement, 1000)) {
        profile.email = await this.getText(emailElement);
      }
      
      // Try to get avatar URL
      const avatarElement = this.page.locator('[data-testid="user-avatar"] img, .user-avatar img');
      if (await this.elementExists(avatarElement, 1000)) {
        profile.avatarUrl = await this.getAttribute(avatarElement, 'src');
      }
    } catch (e) {
      // Silently fail - not all profiles will have all fields
    }
    
    return profile;
  }

  /**
   * Log out the user
   */
  async logout(): Promise<void> {
    // Try common logout selectors
    const logoutSelectors = [
      '[data-testid="logout"]',
      '.logout-btn',
      'a[href*="logout"]',
      'button:has-text("Logout")',
      'a:has-text("Logout")'
    ];
    
    for (const selector of logoutSelectors) {
      if (await this.elementExists(selector, 1000)) {
        await this.clickAndNavigate(selector);
        return;
      }
    }
    
    throw new Error('Could not find logout button');
  }
}

/**
 * Specialized page object for responsive testing
 */
export class ResponsivePage extends BasePage {
  constructor(page: Page, baseURL: string = "") {
    super(page, baseURL);
  }

  /**
   * Set viewport to mobile dimensions
   */
  async setMobileViewport(): Promise<void> {
    await this.page.setViewportSize({ width: 375, height: 667 }); // iPhone SE
  }

  /**
   * Set viewport to tablet dimensions
   */
  async setTabletViewport(): Promise<void> {
    await this.page.setViewportSize({ width: 768, height: 1024 }); // iPad
  }

  /**
   * Set viewport to desktop dimensions
   */
  async setDesktopViewport(): Promise<void> {
    await this.page.setViewportSize({ width: 1920, height: 1080 }); // Full HD
  }

  /**
   * Test responsive breakpoints
   */
  async testBreakpoints(
    breakpoints: Array<{
      name: string;
      width: number;
      height: number;
      callback: (page: Page) => Promise<void>;
    }>
  ): Promise<void> {
    for (const breakpoint of breakpoints) {
      await this.page.setViewportSize({ 
        width: breakpoint.width, 
        height: breakpoint.height 
      });
      await this.waitForPageLoad(1000);
      await breakpoint.callback(this.page);
    }
  }
}

/**
 * Factory functions for creating page objects
 */
export function createBasePage(page: Page, baseURL: string = ""): BasePage {
  return new BasePage(page, baseURL);
}

export function createAuthenticatedPage(page: Page, baseURL: string = ""): AuthenticatedPage {
  return new AuthenticatedPage(page, baseURL);
}

export function createResponsivePage(page: Page, baseURL: string = ""): ResponsivePage {
  return new ResponsivePage(page, baseURL);
}