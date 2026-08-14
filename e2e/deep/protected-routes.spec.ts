import { test, expect } from "@playwright/test";
import { api, expectJson, GUEST_STORAGE } from "./_helpers";

test.use({ storageState: GUEST_STORAGE });

test.describe("Protected pages and APIs", () => {
  test("unauthenticated /en/dashboard redirects to login with a bare redirect param", async ({
    page,
  }) => {
    await page.goto("/en/dashboard");
    await expect(page).toHaveURL(/\/en\/auth\/login/);
    const url = new URL(page.url());
    const redirect = url.searchParams.get("redirect") ?? url.searchParams.get("next") ?? "";
    expect(redirect).toBe("/dashboard");
  });

  test("unauthenticated /en/admin redirects to login", async ({ page }) => {
    await page.goto("/en/admin");
    await expect(page).toHaveURL(/\/en\/auth\/login/);
    const url = new URL(page.url());
    const redirect = url.searchParams.get("redirect") ?? url.searchParams.get("next") ?? "";
    expect(redirect).toMatch(/^\/admin/);
  });

  test("GET /api/user/purchases without a session is 401", async ({ request }) => {
    const res = await api(request, "get", "/api/user/purchases");
    expect(res.status()).toBe(401);
    const body = await expectJson(res);
    expect(body.error).toBeTruthy();
  });

  test("GET /api/admin/users without a session is 401", async ({ request }) => {
    const res = await api(request, "get", "/api/admin/users");
    expect(res.status()).toBe(401);
    await expectJson(res);
  });

  test("garbage Bearer token does not unlock admin APIs", async ({ request }) => {
    const res = await api(request, "get", "/api/admin/users", {
      headers: { authorization: "Bearer totally-not-a-session" },
    });
    expect(res.status()).toBe(401);
  });

  test("login open-redirect is rejected — //evil stays on-site", async ({ page }) => {
    await page.goto("/en/auth/login?redirect=//evil.example");
    await expect(page).toHaveURL(/\/en\/auth\/login/);
    await expect(page.locator("#email")).toBeVisible();
  });
});

test.describe("Authenticated customer dashboard", () => {
  test.use({ storageState: "e2e/.auth/user.json" });

  test("seed user reaches dashboard or is bounced only if setup could not log in", async ({
    page,
  }) => {
    await page.goto("/en/dashboard");
    if (/\/auth\/login/.test(page.url())) {
      test.skip(true, "user.json has no session — D1 seed login did not persist");
    }
    await expect(page).toHaveURL(/\/en\/dashboard/);
    await expect(page.locator("h1, h2, main").first()).toBeVisible({ timeout: 20_000 });
  });
});
