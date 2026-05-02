/**
 * Smoke tests — fastest possible "is the standby alive" gate.
 *
 * These hit the public surface of cloudless.online (the standby's vanity
 * hostname, always routes APIGW → Lambda → Funnel → Pi). If any of these
 * fail, every other test in this suite will too — so they're the canary.
 */
import { test, expect } from "@playwright/test";
import { isHealthBody, isLikelyAppResponse, probeHealth } from "./_helpers";

test.describe("k3s smoke", () => {
  test("/api/health returns 200 with valid app body", async ({ request }) => {
    const r = await probeHealth(request);
    expect(r.status, "health endpoint must return 200").toBe(200);
    expect(isHealthBody(r.body), `unexpected body: ${r.body.slice(0, 200)}`).toBe(true);
  });

  test("response carries expected security headers", async ({ request }) => {
    const r = await probeHealth(request);
    expect(r.headers["strict-transport-security"]).toBeTruthy();
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["x-frame-options"]).toBe("DENY");
    expect(r.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(r.headers["permissions-policy"]).toContain("camera=()");
  });

  test("response signature is the cloudless.gr Next.js app", async ({ request }) => {
    const r = await probeHealth(request);
    expect(
      isLikelyAppResponse(r.headers),
      "expected app's CSP; got something else (proxy/LB error page?)",
    ).toBe(true);
  });

  test("homepage loads (i18n redirect to /en|/el|/fr)", async ({ page }) => {
    const r = await page.goto("/", { waitUntil: "domcontentloaded" });
    expect(r?.status(), "homepage navigation must succeed").toBeLessThan(400);
    // After i18n redirect, URL should land on a locale-prefixed path.
    expect(page.url()).toMatch(/\/(en|el|fr)(\/|$)/);
  });

  test("standby front door resolves to AWS range, not Pi LAN", async ({ request }) => {
    // The standby always goes via APIGW. Any AWS-owned IPv4 range works
    // (3.x, 13.x, 18.x, 50.x, 52.x, 54.x). A LAN/CGNAT IP would mean DNS
    // resolution somehow bypassed Route 53 — that's a misconfiguration.
    const r = await request.get("https://cloudless.online/api/health");
    expect(r.status()).toBe(200);
    // Server header from APIGW or Lambda integration usually contains
    // "AmazonS3"/"awselb"/"Server: ..." — we just verify it's not nginx
    // or pihole-FTL (which would mean LAN bypass).
    const server = (r.headers()["server"] ?? "").toLowerCase();
    expect(server).not.toContain("nginx");
    expect(server).not.toContain("pihole");
  });
});
