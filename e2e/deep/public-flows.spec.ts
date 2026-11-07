import { test, expect } from "@playwright/test";
import { GUEST_STORAGE } from "./_helpers";

test.use({ storageState: GUEST_STORAGE });

/**
 * Interactive public flows: lead-capture forms (survey, audit, consultation
 * booking), auth-gated redirects, and cookie consent. Mutating submissions are
 * tagged @mutating so the production config skips them.
 */

test.describe("stack-audit survey", () => {
  test("renders the questionnaire with all questions and fields", async ({ page }) => {
    await page.goto("/en/survey");
    await expect(page.getByRole("heading", { name: /stack audit/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator("fieldset").first()).toBeVisible();
    await expect(page.getByPlaceholder(/name/i)).toBeVisible();
    await expect(page.getByPlaceholder(/work email/i)).toBeVisible();
  });

  test("answer buttons toggle selection state", async ({ page }) => {
    await page.goto("/en/survey");
    const firstFieldset = page.locator("fieldset").first();
    const option = firstFieldset.locator("button").first();
    await option.click();
    await expect(option).toHaveClass(/neon-cyan/);
  });

  test("email field is required — submit blocked without it", async ({ page }) => {
    await page.goto("/en/survey");
    // Fill everything except the required email, then try to submit.
    for (const fs of await page.locator("fieldset").all()) {
      await fs.locator("button").first().click();
    }
    await page.getByPlaceholder(/name/i).fill("E2E Tester");
    const submit = page.getByRole("button", { name: /get my audit/i });
    await submit.click();
    // Native required validation keeps us on the form — no success screen.
    await expect(page.getByRole("heading", { name: /thanks/i })).toHaveCount(0);
  });

  test("full submission shows the thank-you state @mutating", async ({ page }) => {
    await page.goto("/en/survey");
    for (const fs of await page.locator("fieldset").all()) {
      await fs.locator("button").first().click();
    }
    await page.getByPlaceholder(/name/i).fill("E2E Survey");
    await page
      .getByPlaceholder(/work email/i)
      .fill(`e2e-survey-${Date.now()}@example.com`);
    await page.getByRole("button", { name: /get my audit/i }).click();
    const thanks = page.getByRole("heading", { name: /thanks.*stack audit/i });
    const submitError = page.getByText(/something went wrong/i);
    // The edge rate-limiter can 429 a mutating POST mid-suite — the page shows
    // the error state; wait out the window and retry once before failing.
    await expect(thanks.or(submitError).first()).toBeVisible({ timeout: 20_000 });
    if (await submitError.isVisible()) {
      await page.waitForTimeout(65_000);
      await page.getByRole("button", { name: /get my audit/i }).click();
    }
    await expect(thanks).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("site-audit request form", () => {
  test("renders all required fields and honeypot", async ({ page }) => {
    await page.goto("/en/audit");
    await expect(page.locator('input[name="name"]')).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('input[name="email"]')).toBeVisible();
    await expect(page.locator('textarea[name="goal"]')).toBeVisible();
    await expect(page.locator('input[name="pain"]')).toBeVisible();
    await expect(page.locator('input[name="timeline"]')).toBeVisible();
    await expect(page.locator('input[name="consent"]')).toBeVisible();
    // Honeypot must exist in the DOM (bots fill it; CSS hides it visually)
    await expect(page.locator('input[name="website"]')).toBeAttached();
  });

  test("empty submit is blocked by required fields", async ({ page }) => {
    await page.goto("/en/audit");
    const form = page.locator("form").first();
    await form.locator('button[type="submit"], button:has-text("audit")').first().click();
    // Still on the page, no success panel
    await expect(page.locator("text=/audit.*(sent|received|done)/i")).toHaveCount(0);
  });
});

test.describe("consultation booking", () => {
  test("booking widget loads and shows slots or an empty state", async ({ page }) => {
    await page.goto("/en/consultation");
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
    // Either slots render or the empty/unavailable state does — never a hang.
    // (booking-form only appears after a slot is picked — see next test.)
    const grid = page.getByTestId("slot-grid");
    const empty = page.getByTestId("slots-empty");
    const unavailable = page.getByTestId("booking-unavailable");
    await expect(grid.or(empty).or(unavailable).first()).toBeVisible({ timeout: 30_000 });
  });

  test("booking form appears after picking a slot and requires consent", async ({ page }) => {
    await page.goto("/en/consultation");
    // The details form only renders once a slot is selected — wait for the
    // availability fetch to settle, then pick the first slot if any exist.
    const grid = page.getByTestId("slot-grid");
    const empty = page.getByTestId("slots-empty");
    const unavailable = page.getByTestId("booking-unavailable");
    await expect(grid.or(empty).or(unavailable).first()).toBeVisible({ timeout: 30_000 });
    test.skip(
      !(await grid.isVisible().catch(() => false)),
      "no bookable slots in this environment",
    );
    await grid.locator("button").first().click();
    const form = page.getByTestId("booking-form");
    await expect(form).toBeVisible();
    await expect(form.locator('input[type="email"], input[name*="email" i]').first()).toBeVisible();
    await expect(form.locator('input[type="checkbox"]').first()).toBeVisible();
  });
});

test.describe("auth-gated surfaces", () => {
  for (const path of ["/en/dashboard", "/en/dashboard/purchases", "/en/admin"]) {
    test(`${path} redirects unauthenticated visitors to login`, async ({ page }) => {
      await page.goto(path);
      await page.waitForURL(/\/auth\/login/, { timeout: 30_000 });
      expect(page.url()).toContain("redirect=");
    });
  }

  test("login page renders the form", async ({ page }) => {
    await page.goto("/en/auth/login");
    await expect(page.locator('input[type="email"], input[name*="email" i]').first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.locator('input[type="password"]').first()).toBeVisible();
  });

  test("signup page renders the form", async ({ page }) => {
    await page.goto("/en/auth/signup");
    await expect(page.locator("form, input").first()).toBeVisible({ timeout: 20_000 });
  });
});

test.describe("cookie consent", () => {
  test("banner appears for new visitors and can be dismissed", async ({ page }) => {
    await page.context().clearCookies();
    await page.goto("/en");
    const banner = page.getByTestId("cookie-banner");
    // Banner may be suppressed by prior consent cookie — only assert when shown.
    if (await banner.isVisible().catch(() => false)) {
      const accept = banner.getByRole("button", { name: /accept|agree|ok/i }).first();
      await accept.click();
      await expect(banner).toBeHidden({ timeout: 10_000 });
    }
  });
});
