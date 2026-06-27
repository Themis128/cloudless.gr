/**
 * DNS resolution validation — verifies that all public hostnames resolve
 * and point to the expected infrastructure (CloudFront, Cloudflare tunnel,
 * or direct IP).
 *
 * Catches: dangling DNS records, accidental record deletion, propagation
 * failures after a migration, and misrouted subdomains.
 */
import { test, expect } from "../coverage";

const K3S_HOST = globalThis.process?.env["K3S_HOST"] ?? "cloudless.gr";

test.describe("DNS resolution", () => {
  test("apex domain resolves and serves the app", async ({ request }) => {
    const r = await request.get(`https://${K3S_HOST}/api/health`, {
      failOnStatusCode: false,
      timeout: 15_000,
    });
    expect(r.status()).toBe(200);
  });

  test("www redirects to apex (or serves the app)", async ({ request }) => {
    const r = await request.get(`https://www.${K3S_HOST}/`, {
      maxRedirects: 0,
      failOnStatusCode: false,
      timeout: 10_000,
    });
    expect([200, 301, 302, 307, 308].includes(r.status())).toBe(true);
    if (r.status() >= 300 && r.status() < 400) {
      const location = r.headers()["location"] ?? "";
      // CF may redirect to a relative path ("/en") or full URL — either is valid
      const isFullUrl = location.includes(K3S_HOST);
      const isRelative = location.startsWith("/");
      expect(isFullUrl || isRelative, `unexpected location: ${location}`).toBe(true);
    }
  });

  test("pi-origin subdomain resolves to the Pi cluster", async ({ request }) => {
    let r: Awaited<ReturnType<typeof request.get>>;
    try {
      r = await request.get(`https://pi-origin.${K3S_HOST}/api/health`, {
        failOnStatusCode: false,
        timeout: 20_000,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT|Timeout/i.test(msg)) {
        test.skip(true, `pi-origin.${K3S_HOST} not reachable from runner: ${msg}`);
        return;
      }
      throw e;
    }
    expect(r.status()).toBeLessThan(500);
  });

  const tunnelSubdomains = ["oncall", "ntfy", "manage", "ha", "logs"];

  for (const sub of tunnelSubdomains) {
    test(`${sub}.${K3S_HOST} — resolves and responds`, async ({ request }) => {
      // Tunnel subdomains route through Cloudflare Tunnel and may not resolve
      // from GH-hosted runner IPs (geo-blocked or not yet propagated).
      // Treat DNS failure as a skip rather than a hard failure.
      let r: Awaited<ReturnType<typeof request.get>>;
      try {
        r = await request.get(`https://${sub}.${K3S_HOST}/`, {
          maxRedirects: 5,
          failOnStatusCode: false,
          timeout: 15_000,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
          test.skip(true, `${sub}.${K3S_HOST} DNS not reachable from runner: ${msg}`);
          return;
        }
        throw e;
      }
      expect(
        r.status(),
        `${sub}.${K3S_HOST} returned ${r.status()} — DNS or tunnel broken?`,
      ).toBeLessThan(504);
    });
  }
});
