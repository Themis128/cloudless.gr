/**
 * Security headers (cloud-side, against the dev server).
 *
 * Mirrors e2e/k3s/security-headers.spec.ts but runs against the local
 * Next.js dev server via Playwright's webServer. This catches regressions
 * to src/proxy.ts before they ship — the k3s spec catches them only after
 * a deploy + Pi sync has landed, which is too late.
 *
 * Pinning the headers we *expect* (rather than the absence of bad ones)
 * gives a clear signal when any of these is unintentionally removed.
 */

import { test, expect } from "@playwright/test";

const PROBE = "/api/health";

test.describe("security headers — cloud", () => {
  test("HSTS preload-eligible", async ({ request }) => {
    const r = await request.get(PROBE);
    const hsts = r.headers()["strict-transport-security"] ?? "";
    expect(hsts).toContain("max-age=");
    expect(hsts).toContain("includeSubDomains");
    expect(hsts).toContain("preload");
  });

  test("X-Content-Type-Options nosniff", async ({ request }) => {
    const r = await request.get(PROBE);
    expect(r.headers()["x-content-type-options"]).toBe("nosniff");
  });

  test("X-Frame-Options DENY", async ({ request }) => {
    const r = await request.get(PROBE);
    expect(r.headers()["x-frame-options"]).toBe("DENY");
  });

  test("Referrer-Policy strict", async ({ request }) => {
    const r = await request.get(PROBE);
    expect(r.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  });

  test("X-Powered-By header is suppressed", async ({ request }) => {
    const r = await request.get(PROBE);
    // poweredByHeader: false in next.config.ts removes the implicit
    // X-Powered-By: Next.js. Cap on attack-surface fingerprinting.
    expect(r.headers()["x-powered-by"]).toBeUndefined();
  });

  test("Permissions-Policy hard-blocks 24 features (post-audit hardening)", async ({ request }) => {
    const r = await request.get(PROBE);
    const pp = r.headers()["permissions-policy"] ?? "";
    // Sample a representative subset of the locked-down directives.
    // If a future commit drops back to the legacy 3-directive form, this
    // catches it.
    for (const directive of [
      "accelerometer=()",
      "camera=()",
      "geolocation=()",
      "gyroscope=()",
      "hid=()",
      "magnetometer=()",
      "microphone=()",
      "midi=()",
      "serial=()",
      "usb=()",
      "xr-spatial-tracking=()",
    ]) {
      expect(pp, `expected "${directive}" in Permissions-Policy`).toContain(directive);
    }
    // Legitimate features kept as (self) — make sure they DIDN'T get hard-blocked.
    expect(pp).toContain("payment=(self)");
    expect(pp).toContain("fullscreen=(self)");
  });

  test("CSP header is set with all expected directives", async ({ request }) => {
    const r = await request.get(PROBE);
    const csp = r.headers()["content-security-policy"] ?? "";
    expect(csp.length, "expected CSP header").toBeGreaterThan(0);
    // Pinned directives — changes here are deliberate edits to src/proxy.ts.
    for (const piece of [
      "default-src 'self'",
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      // Meta Pixel form-post fallback hosts are appended to 'self'.
      "form-action 'self' https://www.facebook.com https://connect.facebook.net",
      "report-uri /api/csp-report",
      "report-to csp-endpoint",
    ]) {
      expect(csp, `expected "${piece}" in CSP`).toContain(piece);
    }
  });

  test("CSP allows Google Analytics and GTM hosts", async ({ request }) => {
    const r = await request.get(PROBE);
    const csp = r.headers()["content-security-policy"] ?? "";
    // script-src must allow the GTM loader
    expect(csp).toContain("https://www.googletagmanager.com");
    // connect-src must allow GA4 collection endpoints
    expect(csp).toContain("https://www.google-analytics.com");
    expect(csp).toContain("https://analytics.google.com");
  });

  test("CSP allows LinkedIn Insight Tag hosts", async ({ request }) => {
    const r = await request.get(PROBE);
    const csp = r.headers()["content-security-policy"] ?? "";
    expect(csp).toContain("https://snap.licdn.com");
    expect(csp).toContain("https://px.ads.linkedin.com");
  });

  test("Report-To header advertises the csp-endpoint group", async ({ request }) => {
    const r = await request.get(PROBE);
    const reportTo = r.headers()["report-to"] ?? "";
    expect(reportTo, "expected Report-To header").not.toBe("");
    const parsed = JSON.parse(reportTo);
    expect(parsed.group).toBe("csp-endpoint");
    expect(parsed.endpoints).toHaveLength(1);
    expect(parsed.endpoints[0].url).toBe("/api/csp-report");
  });

  test("CSP report endpoint accepts violation reports (204)", async ({ request }) => {
    const r = await request.post("/api/csp-report", {
      headers: { "content-type": "application/csp-report" },
      data: {
        "csp-report": {
          "document-uri": "http://localhost:4000/en",
          "violated-directive": "script-src",
          "blocked-uri": "https://evil.example/x.js",
          disposition: "report",
        },
      },
    });
    expect(r.status()).toBe(204);
  });

  test("CSP report endpoint accepts modern Reporting-API payload (204)", async ({ request }) => {
    const r = await request.post("/api/csp-report", {
      headers: { "content-type": "application/reports+json" },
      data: [
        {
          type: "csp-violation",
          body: {
            documentURL: "http://localhost:4000/en",
            effectiveDirective: "img-src",
            blockedURL: "https://tracker.example/p.gif",
            disposition: "enforce",
          },
        },
      ],
    });
    expect(r.status()).toBe(204);
  });
});
