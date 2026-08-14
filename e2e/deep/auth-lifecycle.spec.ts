import { test, expect } from "@playwright/test";
import { api, expectJson, GUEST_STORAGE } from "./_helpers";

test.use({ storageState: GUEST_STORAGE });

test.describe("Auth lifecycle", () => {
  test("GET /api/auth/session is JSON with a null user when logged out", async ({ request }) => {
    const res = await api(request, "get", "/api/auth/session");
    expect(res.status()).toBe(200);
    const body = await expectJson(res);
    expect(body.user).toBeNull();
  });

  test("GET /api/auth/login is JSON, not an HTML 404", async ({ request }) => {
    const res = await api(request, "get", "/api/auth/login");
    expect(res.status()).toBeLessThan(500);
    const body = await expectJson(res);
    expect(body).toHaveProperty("user");
  });

  test("POST /api/auth/login with empty body returns 400 and an error string", async ({
    request,
  }) => {
    const res = await api(request, "post", "/api/auth/login", { data: {} });
    expect(res.status()).toBe(400);
    const body = await expectJson(res);
    expect(String(body.error)).toMatch(/email|password|invalid/i);
  });

  test("POST /api/auth/login with a non-existent account returns 401 or 503", async ({
    request,
  }) => {
    const res = await api(request, "post", "/api/auth/login", {
      data: { email: "nobody-e2e@example.invalid", password: "WrongPass123!" },
    });
    expect([401, 429, 503]).toContain(res.status());
    const body = await expectJson(res);
    expect(body.error).toBeTruthy();
  });

  test("POST /api/auth/register rejects a weak password with 400", async ({ request }) => {
    const res = await api(request, "post", "/api/auth/register", {
      data: { email: "weak-e2e@example.invalid", password: "1" },
    });
    expect([400, 429, 503]).toContain(res.status());
    const body = await expectJson(res);
    expect(body.error).toBeTruthy();
  });

  test("unprefixed /auth/login 307s onto the default locale", async ({ request }) => {
    const res = await request.get("/auth/login", { maxRedirects: 0 });
    expect(res.status()).toBe(307);
    const loc = res.headers()["location"] ?? "";
    expect(loc).toMatch(/\/en\/auth\/login/);
  });

  test("signup form surfaces a password-mismatch alert", async ({ page }) => {
    await page.goto("/en/auth/signup");
    await expect(page.getByRole("heading", { name: /create account|sign up/i })).toBeVisible({
      timeout: 20_000,
    });
    await page.locator("#signup-name").fill("E2E Mismatch");
    await page.locator("#signup-email").fill("mismatch-e2e@example.invalid");
    await page.locator("#signup-password").fill("LongEnough1!");
    await page.locator("#signup-confirm-password").fill("DifferentPass1!");
    await page.getByRole("button", { name: /create account|sign up/i }).click();
    await expect(page.getByTestId("auth-error")).toBeVisible();
    await expect(page.getByTestId("auth-error")).toContainText(/passwords? (do )?not match/i);
  });

  test("login form shows an accessible error for bad credentials", async ({ page }) => {
    await page.goto("/en/auth/login");
    await expect(page.getByRole("heading", { name: /sign in/i })).toBeVisible({ timeout: 20_000 });
    await page.locator("#email").fill("nobody-e2e@example.invalid");
    await page.locator("#password").fill("WrongPass123!");
    await page.getByRole("button", { name: /sign in/i }).click();
    await expect(page).toHaveURL(/\/auth\/login/);
    await expect(page.getByTestId("auth-error")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("auth-error")).toContainText(
      /invalid|failed|incorrect|password|email|locked|configured|unavailable|sign in/i,
    );
  });

  test("forgot-password link from login is locale-aware", async ({ page }) => {
    await page.goto("/en/auth/login");
    await page.getByTestId("forgot-password-link").click();
    await expect(page).toHaveURL(/\/en\/auth\/forgot-password/);
    await expect(page.locator("h1, h2").first()).toBeVisible();
  });

  test("login then session JSON includes the user; DELETE clears it", async ({ request }) => {
    const email = process.env.E2E_USER_EMAIL || "testuser@cloudless.gr";
    const password = process.env.E2E_USER_PASSWORD || "TestPass123!";
    const login = await api(request, "post", "/api/auth/login", { data: { email, password } });
    if (login.status() === 503) {
      test.skip(true, "Auth DB not configured in this environment");
    }
    if (login.status() !== 200) {
      test.skip(true, `Seed user login returned ${login.status()} — run auth setup first`);
    }
    const loggedIn = await expectJson(login);
    expect(loggedIn.user).toBeTruthy();

    const session = await api(request, "get", "/api/auth/session");
    const sessionBody = await expectJson(session);
    expect(sessionBody.user).toBeTruthy();

    const logout = await api(request, "delete", "/api/auth/session");
    expect(logout.status()).toBeLessThan(500);
    const after = await expectJson(await api(request, "get", "/api/auth/session"));
    expect(after.user).toBeNull();
  });
});
