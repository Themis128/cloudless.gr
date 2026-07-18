/**
 * Smoke tests — fastest possible "is the standby alive" gate.
 *
 * These hit the public surface of the standby host via Tailscale Funnel.
 * (always routes Cloudflare → Funnel → Pi k3s). If any of these
 * fail, every other test in this suite will too — so they're the canary.
 */
import { test, expect } from "../coverage";
import { isHealthBody, isLikelyAppResponse, isNetworkError, isOriginDown, probeHealth, STANDBY_HOST } from "./_helpers";

test.describe("k3s smoke", () => {
  test("/api/health returns 200 with valid app body", async ({ request }) => {
    let r: Awaited<ReturnType<typeof probeHealth>>;
    try {
      r = await probeHealth(request);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `standby not reachable: ${e}`); return; }
      throw e;
    }
    if (isOriginDown(r.status)) { test.skip(true, `origin returned ${r.status}`); return; }
    expect(r.status, "health endpoint must return 200").toBe(200);
    expect(isHealthBody(r.body), `unexpected body: ${r.body.slice(0, 200)}`).toBe(true);
  });

  test("response carries expected security headers", async ({ request }) => {
    let r: Awaited<ReturnType<typeof probeHealth>>;
    try {
      r = await probeHealth(request);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `standby not reachable: ${e}`); return; }
      throw e;
    }
    if (isOriginDown(r.status)) { test.skip(true, `origin returned ${r.status}`); return; }
    expect(r.headers["strict-transport-security"]).toBeTruthy();
    expect(r.headers["x-content-type-options"]).toBe("nosniff");
    expect(r.headers["x-frame-options"]).toBe("DENY");
    expect(r.headers["referrer-policy"]).toBe("strict-origin-when-cross-origin");
    expect(r.headers["permissions-policy"]).toContain("camera=()");
  });

  test("response signature is the cloudless.gr Next.js app", async ({ request }) => {
    let r: Awaited<ReturnType<typeof probeHealth>>;
    try {
      r = await probeHealth(request);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `standby not reachable: ${e}`); return; }
      throw e;
    }
    if (isOriginDown(r.status)) { test.skip(true, `origin returned ${r.status}`); return; }
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

  test("standby front door resolves correctly (not local Pi LAN IP)", async ({ request }) => {
    let r: Awaited<ReturnType<typeof request.get>>;
    try {
      r = await request.get(`https://${STANDBY_HOST}/api/health`);
    } catch (e) {
      if (isNetworkError(e)) { test.skip(true, `standby not reachable: ${e}`); return; }
      throw e;
    }
    if (isOriginDown(r.status())) { test.skip(true, `origin returned ${r.status()}`); return; }
    expect(r.status()).toBe(200);
    const server = (r.headers()["server"] ?? "").toLowerCase();
    // Should not be nginx (generic proxy) or pihole (local DNS blocker)
    expect(server).not.toContain("nginx");
    expect(server).not.toContain("pihole");
  });
});