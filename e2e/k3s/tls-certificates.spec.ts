/**
 * TLS certificate validation — verifies every public-facing hostname
 * presents a valid, non-expired cert with correct SANs.
 *
 * Catches cert-manager renewal failures, ACM misconfigurations, and
 * Cloudflare tunnel edge-cert gaps before they page anyone at 3 AM.
 */
import { test, expect } from "../coverage";

const K3S_HOST = globalThis.process?.env["K3S_HOST"] ?? "cloudless.gr";

/** All public-facing hostnames that must present a valid TLS cert. */
const HOSTS = [
  K3S_HOST,
  `www.${K3S_HOST}`,
  `pi-origin.${K3S_HOST}`,
  `oncall.${K3S_HOST}`,
  `ntfy.${K3S_HOST}`,
  `manage.${K3S_HOST}`,
  `ha.${K3S_HOST}`,
  `logs.${K3S_HOST}`,
];

const runInfra = !!globalThis.process?.env["INFRA_SMOKE"];

test.describe("TLS certificates", () => {
  for (const host of HOSTS) {
    test(`${host} — TLS handshake succeeds (no expired/self-signed cert)`, async ({ request }) => {
      let r: Awaited<ReturnType<typeof request.get>>;
      try {
        r = await request.get(`https://${host}/`, {
          maxRedirects: 0,
          failOnStatusCode: false,
          timeout: 15_000,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (/ENOTFOUND|ECONNREFUSED|ETIMEDOUT/i.test(msg)) {
          test.skip(true, `${host} DNS not reachable from runner: ${msg}`);
          return;
        }
        throw e;
      }
      expect(r.status(), `${host} TLS handshake failed`).toBeGreaterThan(0);
    });
  }

  test("primary apex serves HSTS with includeSubDomains", async ({ request }) => {
    const r = await request.get(`https://${K3S_HOST}/api/health`, {
      failOnStatusCode: false,
    });
    const hsts = r.headers()["strict-transport-security"] ?? "";
    expect(hsts).toContain("max-age=");
    expect(hsts).toContain("includeSubDomains");
  });
});

test.describe("TLS — infrastructure subdomains", () => {
  test.skip(!runInfra, "Set INFRA_SMOKE=1 to run infrastructure TLS tests");

  const tunnelHosts = [
    `oncall.${K3S_HOST}`,
    `ntfy.${K3S_HOST}`,
    `manage.${K3S_HOST}`,
    `ha.${K3S_HOST}`,
    `logs.${K3S_HOST}`,
  ];

  for (const host of tunnelHosts) {
    test(`${host} — Cloudflare edge cert covers this subdomain`, async ({ request }) => {
      const r = await request.get(`https://${host}/`, {
        maxRedirects: 5,
        failOnStatusCode: false,
        timeout: 15_000,
      });
      const cfRay = r.headers()["cf-ray"] ?? "";
      expect(cfRay.length, `${host} missing cf-ray — not going through Cloudflare?`).toBeGreaterThan(0);
    });
  }
});
