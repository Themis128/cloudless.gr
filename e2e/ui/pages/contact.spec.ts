import { test, expect } from "@playwright/test";

/**
 * Contact page — aligned with docs/product/PUBLIC-FORMS-AND-CHECKOUT.md
 * and the live ContactFormSection UI (localePrefix: always).
 */
test.describe("Contact Page", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
  });

  test("should load successfully", async ({ page }) => {
    await expect(page).toHaveTitle(/contact|cloudless/i);
    await expect(page.locator("h1").first()).toBeVisible();
  });

  test("should have contact form fields and submit", async ({ page }) => {
    const form = page.getByTestId("contact-form");
    await expect(form).toBeVisible({ timeout: 20_000 });
    await expect(form.locator('input[name="name"]')).toBeVisible();
    await expect(form.locator('input[name="email"]')).toBeVisible();
    await expect(form.locator('textarea[name="message"]')).toBeVisible();
    await expect(form.locator('button[type="submit"]')).toBeVisible();
  });

  test("should show direct contact email in sidebar", async ({ page }) => {
    const info = page.getByTestId("contact-info");
    await expect(info).toBeVisible();
    await expect(
      info.locator('a[href="mailto:tbaltzakis@cloudless.gr"]').first(),
    ).toBeVisible();
  });

  test("empty submit stays on contact (HTML required)", async ({ page }) => {
    const form = page.getByTestId("contact-form");
    await expect(form).toBeVisible({ timeout: 20_000 });
    await form.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/en\/contact/);
  });

  test("invalid email is blocked by the browser", async ({ page }) => {
    const form = page.getByTestId("contact-form");
    await expect(form).toBeVisible({ timeout: 20_000 });
    await form.locator('input[name="name"]').fill("Test User");
    await form.locator('input[name="email"]').fill("not-an-email");
    await form.locator('textarea[name="message"]').fill("Probe message");
    await form.locator('button[type="submit"]').click();
    await expect(page).toHaveURL(/\/en\/contact/);
    const email = form.locator('input[name="email"]');
    const valid = await email.evaluate((el: HTMLInputElement) => el.validity.valid);
    expect(valid).toBe(false);
  });

  test("well-formed submit hits /api/contact with non-5xx", async ({ page }) => {
    const form = page.getByTestId("contact-form");
    await expect(form).toBeVisible({ timeout: 20_000 });

    // Cookie banner can sit over the submit control — dismiss if present.
    await page
      .getByRole("button", { name: /accept all/i })
      .click({ timeout: 3_000 })
      .catch(() => {});

    const responsePromise = page.waitForResponse(
      (r) => r.url().includes("/api/contact") && r.request().method() === "POST",
      { timeout: 20_000 },
    );

    await form.locator('input[name="name"]').fill("E2E Contact User");
    await form.locator('input[name="email"]').fill("e2e-contact@example.com");
    await form.locator('textarea[name="message"]').fill("Automated contact probe — ignore.");
    await form.locator('input[name="privacyConsent"]').check({ force: true });
    await form.locator('button[type="submit"]').click();

    const response = await responsePromise;
    expect(response.status()).toBeGreaterThanOrEqual(200);
    expect(response.status()).toBeLessThan(500);
  });

  test("nav logo returns to locale home", async ({ page }) => {
    const logo = page.getByTestId("main-nav").locator("a").filter({ visible: true }).first();
    await logo.click();
    await expect(page).toHaveURL(/\/en\/?$/);
  });

  test("nav services / store / blog links work", async ({ page }) => {
    const nav = page.getByTestId("main-nav");
    await nav.locator('a[href*="/services"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/en\/services/);

    await page.goto("/en/contact", { waitUntil: "domcontentloaded" });
    await nav.locator('a[href*="/store"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/en\/store/);

    await page.goto("/en/contact", { waitUntil: "domcontentloaded" });
    await nav.locator('a[href*="/blog"]').filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/en\/blog/);
  });

  test("form labels are associated", async ({ page }) => {
    const form = page.getByTestId("contact-form");
    await expect(form).toBeVisible({ timeout: 20_000 });
    await expect(page.locator('label[for="name"]')).toBeVisible();
    await expect(page.locator('label[for="email"]')).toBeVisible();
    await expect(page.locator('label[for="message"]')).toBeVisible();
  });

  test("mobile viewport still shows form", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/en/contact", { waitUntil: "domcontentloaded" });
    await expect(page.locator("h1").first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("contact-form")).toBeVisible({ timeout: 20_000 });
  });
});
