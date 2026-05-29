/**
 * Cloudflare tunnel health — verifies the tunnel is routing traffic
 * correctly to each backend service.
 *
 * All infra subdomains route through a Cloudflare tunnel on omv-main
 * → Traefik → k3s services.
 *
 * Catches: cloudflared daemon crash, tunnel credential expiry,
 * ingress rule misconfiguration, Traefik routing failure.
 */
import { test, expect } from "@playwright/test";

const K3S_HOST = process.env.K3S_HOST ?? "cloudless.gr";
const runInfra = !!process.env.INFRA_SMOKE;

test.describe("Cloudflare tunnel routing", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure tests");

  test("oncall.* — routes to Grafana OnCall backend", async ({ request }) => {
    const r = await request.get(`https://oncall.${K3S_HOST}/`, {
      maxRedirects: 5,
      failOnStatusCode: false,
    });
    expect(r.status()).toBeLessThan(502);
    expect(r.headers()["cf-ray"]).toBeTruthy();
  });

  test("ntfy.* — routes to ntfy push server", async ({ request }) => {
    const r = await request.get(`https://ntfy.${K3S_HOST}/v1/health`, {
      failOnStatusCode: false,
    });
    expect(r.status()).toBe(200);
    const body = await r.json();
    expect(body.healthy).toBe(true);
  });

  test("manage.* — routes to Cloudless Manager (oauth2-proxy)", async ({ request }) => {
    const r = await request.get(`https://manage.${K3S_HOST}/`, {
      maxRedirects: 0,
      failOnStatusCode: false,
    });
    expect([200, 301, 302, 401, 403].includes(r.status())).toBe(true);
  });

  test("ha.* — routes to Home Assistant", async ({ request }) => {
    const r = await request.get(`https://ha.${K3S_HOST}/`, {
      maxRedirects: 5,
      failOnStatusCode: false,
    });
    expect(r.status()).toBeLessThan(502);
  });

  test("logs.* — routes to Pi alert-api", async ({ request }) => {
    const r = await request.get(`https://logs.${K3S_HOST}/health`, {
      failOnStatusCode: false,
      timeout: 10_000,
    });
    expect(r.status()).toBe(200);
  });

  test("tunnel responses include Cloudflare headers on all subdomains", async ({ request }) => {
    const subs = ["oncall", "ntfy", "manage", "ha", "logs"];
    for (const sub of subs) {
      const r = await request.get(`https://${sub}.${K3S_HOST}/`, {
        maxRedirects: 5,
        failOnStatusCode: false,
        timeout: 10_000,
      });
      const cfRay = r.headers()["cf-ray"] ?? "";
      expect(cfRay.length, `${sub}: missing cf-ray header`).toBeGreaterThan(0);
    }
  });
});
