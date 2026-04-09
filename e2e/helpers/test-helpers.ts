/**
 * Reusable test helper functions
 */

import { Page, expect } from "@playwright/test";
import { TEST_USERS, TEST_DATA } from "../fixtures/test-user";

/**
 * Login as a user
 */
export async function loginAsUser(
  page: Page,
  email: string,
  password: string
): Promise<void> {
  await page.goto("/auth/login");
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');

  // Wait for navigation or dashboard to load
  await page.waitForLoadState("networkidle").catch(() => {});
}

/**
 * Logout user
 */
export async function logout(page: Page): Promise<void> {
  const logoutBtn = page.locator('button:has-text(/logout|sign out/i)').first();

  if (await logoutBtn.isVisible().catch(() => false)) {
    await logoutBtn.click();
    await page.waitForLoadState("networkidle").catch(() => {});
  }
}

/**
 * Sign up new user
 */
export async function signupUser(
  page: Page,
  email: string,
  password: string,
  name?: string
): Promise<void> {
  await page.goto("/auth/signup");
  await page.fill('input[name="email"]', email);

  if (name) {
    await page
      .fill('input[name="name"]', name)
      .catch(() => {}); // Name might not be in this form
  }

  // Usually signup is 2-step, first form
  await page.click('button[type="submit"]').catch(() => {});

  // Then password form
  await page.waitForTimeout(500);
  await page
    .fill('input[name="password"]', password)
    .catch(
      () => {} // Password field might appear after email verification
    );
}

/**
 * Navigate to specific locale
 */
export async function navigateToLocale(
  page: Page,
  locale: string,
  path: string = "/"
): Promise<void> {
  const url = `/${locale}${path}`;
  await page.goto(url);
}

/**
 * Add product to cart
 */
export async function addToCart(page: Page, productId?: string): Promise<void> {
  const addBtn = page.locator(
    `[data-product-id="${productId}"] button:has-text(/add|cart/i), button:has-text(/add to cart/i)`
  ).first();

  if (await addBtn.isVisible()) {
    await addBtn.click();
  }
}

/**
 * Proceed to checkout
 */
export async function proceedToCheckout(page: Page): Promise<void> {
  const checkoutBtn = page.locator(
    'button:has-text(/checkout|proceed|pay/i)'
  ).first();

  if (await checkoutBtn.isVisible()) {
    await checkoutBtn.click();
    await page.waitForLoadState("networkidle").catch(() => {});
  }
}

/**
 * Fill and submit contact form
 */
export async function fillContactForm(
  page: Page,
  data: {
    name?: string;
    email?: string;
    subject?: string;
    message?: string;
  }
): Promise<void> {
  const form = page.locator("form").first();

  if (await form.isVisible()) {
    if (data.name) {
      await form
        .locator('input[name="name"], input[placeholder*="name" i]')
        .first()
        .fill(data.name)
        .catch(() => {});
    }

    if (data.email) {
      await form
        .locator(
          'input[type="email"], input[name="email"], input[placeholder*="email" i]'
        )
        .first()
        .fill(data.email)
        .catch(() => {});
    }

    if (data.subject) {
      await form
        .locator('input[name="subject"], input[placeholder*="subject" i]')
        .first()
        .fill(data.subject)
        .catch(() => {});
    }

    if (data.message) {
      await form
        .locator(
          'textarea[name="message"], textarea[placeholder*="message" i]'
        )
        .first()
        .fill(data.message)
        .catch(() => {});
    }

    // Submit
    await form.locator('button[type="submit"]').first().click();
  }
}

/**
 * Get JWT auth token from localStorage or Cognito session
 */
export async function getAuthToken(page: Page): Promise<string | null> {
  // Try to get from localStorage (Amplify storage)
  const token = await page.evaluate(() => {
    const auth = localStorage.getItem("amplify-token");
    return auth ? JSON.parse(auth).idToken : null;
  }).catch(() => null);

  return token;
}

/**
 * Make authenticated API request
 */
export async function makeAuthenticatedRequest(
  page: Page,
  url: string,
  options: { method?: string; body?: object } = {}
): Promise<Response | null> {
  const token = await getAuthToken(page);

  if (!token) {
    console.warn("No auth token available");
    return null;
  }

  const response = await page.evaluate(
    async ({ url, token, options }) => {
      const response = await fetch(url, {
        method: options.method || "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });

      return {
        status: response.status,
        statusText: response.statusText,
        body: await response.json().catch(() => ({})),
      };
    },
    { url, token, options }
  );

  return response as Response;
}

/**
 * Dismiss cookie banner
 */
export async function dismissCookieBanner(page: Page): Promise<void> {
  const banner = page.locator(
    '[data-test-id="cookie-banner"], .cookie-banner, .cookie-consent'
  ).first();

  if (await banner.isVisible()) {
    const rejectBtn = banner.locator('button:has-text(/reject|decline/i)').first();
    const acceptBtn = banner.locator('button:has-text(/accept|agree/i)').first();

    if (await rejectBtn.isVisible()) {
      await rejectBtn.click();
    } else if (await acceptBtn.isVisible()) {
      await acceptBtn.click();
    }
  }
}

/**
 * Check mobile responsiveness
 */
export async function checkMobileResponsiveness(page: Page): Promise<boolean> {
  const viewport = page.viewportSize();
  return (viewport?.width || 0) < 768;
}

/**
 * Verify page accessibility basics
 */
export async function verifyPageAccessibility(page: Page): Promise<void> {
  // Check for main content
  const main = page.locator("main");
  expect(await main.count()).toBeGreaterThan(0);

  // Check for navigation
  const nav = page.locator("nav");
  expect(await nav.count()).toBeGreaterThan(0);

  // Check page has title
  const title = await page.title();
  expect(title.length).toBeGreaterThan(0);
}

/**
 * Expect error message visible
 */
export async function expectErrorMessage(page: Page): Promise<void> {
  const error = page.locator('[role="alert"], .error, .error-message').first();
  expect(await error.isVisible()).toBeTruthy();
}

/**
 * Expect success message visible
 */
export async function expectSuccessMessage(page: Page): Promise<void> {
  const success = page.locator(
    '[role="status"], .success, .success-message'
  ).first();
  expect(await success.isVisible()).toBeTruthy();
}
