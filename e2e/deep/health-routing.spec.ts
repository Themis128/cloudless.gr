import { test, expect } from "@playwright/test";
import { api, expectJson, GUEST_STORAGE } from "./_helpers";

test.use({ storageState: GUEST_STORAGE });

test.describe("Health and API routing pin", () => {
  test("/api/health is 200 JSON with status, timestamp, version, authProvider", async ({
    request,
  }) => {
    const res = await api(request, "get", "/api/health");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"] ?? "").toMatch(/no-store/i);
    const body = await expectJson(res);
    // Live D1 may be unreachable in local e2e → "degraded"; still require a
    // coherent JSON health contract (not a hard dependency on CF credentials).
    expect(["ok", "degraded"]).toContain(body.status);
    expect(String(body.timestamp)).toMatch(/^\d{4}-/);
    expect(body.version).toBeTruthy();
    expect(body.authProvider).toBe("d1");
    expect(["d1-http", "local-or-binding"]).toContain(body.authDb);
    expect(body.dbConnected).toBe(body.status === "ok");
  });

  test("/api/auth/session is never an HTML 404 from [locale]", async ({ request }) => {
    const res = await api(request, "get", "/api/auth/session");
    const ct = res.headers()["content-type"] ?? "";
    expect(ct).toMatch(/json/i);
    expect(ct).not.toMatch(/text\/html/);
    expect(res.status()).toBe(200);
    const body = await expectJson(res);
    expect("user" in body).toBe(true);
  });

  test("locale-looking API paths are not captured as [locale]=api", async ({ request }) => {
    const res = await api(request, "get", "/api/auth/session");
    const text = await res.text();
    expect(text).not.toMatch(/<html/i);
    expect(text).not.toMatch(/This page could not be found/i);
  });
});
