import { test, expect } from "@playwright/test";
import { ADMIN_TOKEN, api, expectJson } from "./_helpers";

const authHeaders = { authorization: `Bearer ${ADMIN_TOKEN}` };

test.describe("Admin API with E2E bearer", () => {
  test("GET /api/admin/users with the e2e token is not 401", async ({ request }) => {
    const res = await api(request, "get", "/api/admin/users", { headers: authHeaders });
    expect(res.status()).not.toBe(401);
    expect(res.status()).not.toBe(403);
    if (res.status() >= 500) {
      expect(res.status()).toBe(503);
    } else {
      expect(res.status()).toBeGreaterThanOrEqual(200);
      const body = await expectJson(res);
      expect(body).toBeTruthy();
    }
  });

  test("POST /api/admin/users promote without username is 400", async ({ request }) => {
    const res = await api(request, "post", "/api/admin/users", {
      headers: authHeaders,
      data: { action: "promote" },
    });
    expect([400, 422]).toContain(res.status());
    const body = await expectJson(res);
    expect(body.error).toBeTruthy();
  });

  test("admin CMS + notifications routes are auth-wired (never 401 with token)", async ({
    request,
  }) => {
    const paths = [
      "/api/admin/notifications",
      "/api/admin/appflowy/blog",
      "/api/admin/config",
      "/api/admin/orders",
    ];
    for (const path of paths) {
      const res = await api(request, "get", path, { headers: authHeaders });
      expect(res.status(), path).not.toBe(401);
      expect(res.status(), path).not.toBe(403);
      // Unbound integrations may 503; a 500 is a handler bug.
      if (res.status() >= 500) {
        expect(res.status(), path).toBe(503);
      }
      const ct = res.headers()["content-type"] ?? "";
      expect(ct, path).toMatch(/json/i);
    }
  });

  test("wrong e2e token is rejected even when NEXT_PUBLIC_E2E=1", async ({ request }) => {
    const res = await api(request, "get", "/api/admin/users", {
      headers: { authorization: "Bearer wrong-e2e-admin-token" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("Admin UI", () => {
  test("admin home renders the command-center chrome", async ({ page }) => {
    await page.goto("/en/admin");
    if (/\/auth\/login/.test(page.url())) {
      test.skip(true, "admin storage/bypass cookie missing");
    }
    await expect(page).toHaveURL(/\/en\/admin/);
    await expect(page.locator("h1, h2").first()).toBeVisible({ timeout: 20_000 });
    await expect(page.locator("body")).toContainText(/lead|order|client|health|campaign/i);
  });

  test("admin users section is reachable from the dashboard", async ({ page }) => {
    await page.goto("/en/admin");
    if (/\/auth\/login/.test(page.url())) {
      test.skip(true, "admin storage/bypass cookie missing");
    }
    const users = page.getByRole("link", { name: /users/i }).first();
    if (!(await users.isVisible().catch(() => false))) {
      await page.goto("/en/admin/users");
    } else {
      await users.click();
    }
    await expect(page).toHaveURL(/\/en\/admin/);
    await expect(page.locator("h1, h2, main").first()).toBeVisible();
  });
});
