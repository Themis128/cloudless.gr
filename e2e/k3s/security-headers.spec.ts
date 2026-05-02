/**
 * Security headers — verifies the standby pipeline (Lambda proxy + Funnel
 * + Pi Traefik) doesn't strip or downgrade headers the app emits.
 *
 * Each hop has the potential to drop headers; this test pins the expected
 * surface so a regression on any layer fails CI.
 */
import { test, expect } from "@playwright/test";

const URL = "https://cloudless.online/api/health";

test.describe("k3s security headers", () => {
  test("HSTS preload-eligible", async ({ request }) => {
    const r = await request.get(URL);
    const hsts = r.headers()["strict-transport-security"] ?? "";
    expect(hsts).toContain("max-age=");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  test("X-Content-Type-Options nosniff", async ({ request }) => {
    const r = await request.get(URL);
    expect(r.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("X-Frame-Options DENY", async ({ request }) => {
    const r = await request.get(URL);
    expect(r.headers()["x-frame-options"]).toBe("DENY");
  });

  test("Referrer-Policy strict", async ({ request }) => {
    const r = await request.get(URL);
    expect(r.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("Permissions-Policy locks dangerous APIs", async ({ request }) => {
    const r = await request.get(URL);
    const pp = r.headers()["permissions-policy"] ?? "";
    expect(pp).toContain("camera=()");
    expect(pp).toContain("microphone=()");
    expect(pp).toContain("geolocation=()");
  });

  test("CSP report-only is set with allowed integrations", async ({ request }) => {
    const r = await request.get(URL);
    const csp = r.headers()["content-security-policy-report-only"] ?? "";
    expect(csp.length, "expected CSP-Report-Only header").toBeGreaterThan(0);
    // Stamp a few known directives — these are pinned to the app's source
    // and would change only on a deliberate CSP edit.
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
  });
});
