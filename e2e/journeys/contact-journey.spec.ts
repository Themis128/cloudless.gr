import { test, expect, type Page } from "@playwright/test";

/**
 * Contact journey — form fields by label/id/name; locale /en paths.
 */

async function openMobileNavIfNeeded(page: Page) {
  const hamburger = page.locator('button[aria-label*="menu" i]').first();
  if (await hamburger.isVisible().catch(() => false)) {
    await hamburger.click();
  }
}

async function contactFields(page: Page) {
  const form = page.getByTestId("contact-form").or(page.locator("form")).first();
  const name = page.locator("#name, input[name='name']").first();
  const email = page.locator("#email, input[name='email']").first();
  const message = page.locator("#message, textarea[name='message']").first();
  return { form, name, email, message };
}

test.describe("Contact User Journey", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/en", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/en\/?$/);
  });

  test("navigate to contact from homepage", async ({ page }) => {
    await openMobileNavIfNeeded(page);
    await page.getByRole("link", { name: /contact/i }).filter({ visible: true }).first().click();
    await expect(page).toHaveURL(/\/contact/);
  });

  test("contact form shows name, email, message", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "domcontentloaded" });
    const { name, email, message } = await contactFields(page);
    await expect(name).toBeVisible({ timeout: 20_000 });
    await expect(email).toBeVisible();
    await expect(message).toBeVisible();
  });

  test("empty submit stays on contact (required validation)", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "domcontentloaded" });
    const { name } = await contactFields(page);
    await expect(name).toBeVisible({ timeout: 20_000 });
    await page.getByRole("button", { name: /send|submit|message/i }).first().click();
    await expect(page).toHaveURL(/\/contact/);
    const missing = await name.evaluate((el: HTMLInputElement) => el.validity.valueMissing);
    expect(missing).toBe(true);
  });

  test("invalid email is blocked by native validation", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "domcontentloaded" });
    const { name, email, message } = await contactFields(page);
    await expect(email).toBeVisible({ timeout: 20_000 });
    await name.fill("Test User");
    await email.fill("not-an-email");
    await message.fill("Test message");
    await page.getByRole("button", { name: /send|submit|message/i }).first().click();
    await expect(page).toHaveURL(/\/contact/);
    const invalid = await email.evaluate((el: HTMLInputElement) => !el.validity.valid);
    expect(invalid).toBe(true);
  });

  test("contact info panel is present", async ({ page }) => {
    await page.goto("/en/contact", { waitUntil: "domcontentloaded" });
    const info = page.getByTestId("contact-info").or(page.locator("main"));
    await expect(info.first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/cloudless|email|@/i).first()).toBeVisible();
  });
});
