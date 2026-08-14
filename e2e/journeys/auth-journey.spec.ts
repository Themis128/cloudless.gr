import { test, expect } from "@playwright/test";

/**
 * Auth journey — #email/#password on /en/auth/login; signup ids; e2e_admin cookie.
 */

test.describe("Authentication Journey", () => {
  test.describe("Login Flow", () => {
    test("login page exposes email, password, and submit", async ({ page }) => {
      await page.goto("/en/auth/login", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/auth\/login/);
      await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("#password")).toBeVisible();
      await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
    });

    test("invalid credentials stay on login and show an error", async ({ page }) => {
      await page.goto("/en/auth/login", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
      await page.locator("#email").fill(`invalid-${Date.now()}@example.com`);
      await page.locator("#password").fill("wrong-password-not-real");
      await page.getByRole("button", { name: /sign in/i }).click();
      await expect(page).toHaveURL(/\/auth\/login/);
      // Backend may return 401, 503 (auth not configured), or generic failure text.
      await expect(
        page
          .getByText(
            /invalid|incorrect|failed|unauthorized|not configured|unavailable|required/i,
          )
          .first(),
      ).toBeVisible({ timeout: 20_000 });
    });

    test("empty fields are blocked by required validation", async ({ page }) => {
      await page.goto("/en/auth/login", { waitUntil: "domcontentloaded" });
      const email = page.locator("#email");
      const password = page.locator("#password");
      await expect(email).toBeVisible({ timeout: 20_000 });
      await expect(email).toHaveAttribute("required", "");
      await expect(password).toHaveAttribute("required", "");
      await page.getByRole("button", { name: /sign in/i }).click();
      const emailMissing = await email.evaluate((el: HTMLInputElement) => el.validity.valueMissing);
      expect(emailMissing).toBe(true);
      await expect(page).toHaveURL(/\/auth\/login/);
    });
  });

  test.describe("Registration Flow", () => {
    test("signup page exposes name, email, password, confirm", async ({ page }) => {
      await page.goto("/en/auth/signup", { waitUntil: "domcontentloaded" });
      await expect(page).toHaveURL(/\/auth\/signup/);
      await expect(page.locator("#signup-email")).toBeVisible({ timeout: 20_000 });
      await expect(page.locator("#signup-password")).toBeVisible();
      await expect(page.locator("#signup-confirm-password")).toBeVisible();
      await expect(page.locator("#signup-name, input[name='name']").first()).toBeVisible();
      await expect(page.getByRole("button", { name: /create|sign up|register/i })).toBeVisible();
    });

    test("password mismatch shows validation error", async ({ page }) => {
      for (let attempt = 0; attempt < 3; attempt++) {
        await page.goto("/en/auth/signup", { waitUntil: "domcontentloaded" });
        if (!(await page.getByRole("heading", { name: /page not found/i }).count())) break;
        await page.waitForTimeout(500 * (attempt + 1));
      }
      await expect(page.locator("#signup-email")).toBeVisible({ timeout: 30_000 });
      await page.locator("#signup-name").fill("Test User");
      await page.locator("#signup-email").fill(`newuser-${Date.now()}@example.com`);
      await page.locator("#signup-password").fill("password12345");
      await page.locator("#signup-confirm-password").fill("different-password");
      await page.getByRole("button", { name: /create|sign up|register/i }).click();
      await expect(
        page.getByText(/passwords? (do )?not match|mismatch/i).first(),
      ).toBeVisible({ timeout: 15_000 });
      await expect(page).toHaveURL(/\/auth\/signup/);
    });

    test("empty signup fields are blocked by required validation", async ({ page }) => {
      await page.goto("/en/auth/signup", { waitUntil: "domcontentloaded" });
      const email = page.locator("#signup-email");
      await expect(email).toBeVisible({ timeout: 20_000 });
      await expect(email).toHaveAttribute("required", "");
      await page.getByRole("button", { name: /create|sign up|register/i }).click();
      const missing = await email.evaluate((el: HTMLInputElement) => el.validity.valueMissing);
      expect(missing).toBe(true);
      await expect(page).toHaveURL(/\/auth\/signup/);
    });
  });

  test.describe("Password Reset Flow", () => {
    test("forgot-password is reachable from login", async ({ page }) => {
      await page.goto("/en/auth/login", { waitUntil: "domcontentloaded" });
      await expect(page.locator("#email")).toBeVisible({ timeout: 20_000 });
      const forgot = page.getByTestId("forgot-password-link");
      await expect(forgot).toBeVisible({ timeout: 10_000 });
      await Promise.all([page.waitForURL(/\/auth\/forgot-password/), forgot.click()]);
      await expect(page.locator("#forgot-email, input[type='email']").first()).toBeVisible({
        timeout: 10_000,
      });
      await expect(page.getByRole("button", { name: /reset|send|submit/i })).toBeVisible();
    });
  });

  test.describe("Session via e2e admin bypass", () => {
    test.beforeEach(async ({ context }) => {
      await context.addCookies([
        { name: "e2e_admin", value: "1", url: "http://localhost:4000" },
      ]);
    });

    test("e2e_admin cookie reaches admin area", async ({ page }) => {
      await page.goto("/en/admin", { waitUntil: "domcontentloaded" });
      if (!page.url().includes("/admin")) {
        test.skip(true, "e2e_admin bypass not active in this environment");
      }
      await expect(page.locator("h1, h2, main").first()).toBeVisible({ timeout: 30_000 });
    });
  });
});
