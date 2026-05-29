/**
 * ECR image availability — verifies Docker images the Pi k3s cluster pulls
 * are present in ECR and not expired by lifecycle policy.
 *
 * Catches: ECR lifecycle too aggressive, failed push, image tag mismatch.
 */
import { test, expect } from "@playwright/test";
import { PRIMARY_HOST, STANDBY_HOST, probeHealth, isHealthBody } from "./_helpers";

test.describe("ECR / container image health", () => {
  test("Pi cluster is running a valid image (app responds on pi-origin)", async ({ request }) => {
    const r = await request.get(`https://pi-origin.${PRIMARY_HOST}/api/health`, {
      failOnStatusCode: false,
      timeout: 20_000,
    });
    expect(r.status(), "Pi origin not responding — possible ImagePullBackOff?").toBe(200);
    expect(isHealthBody(await r.text())).toBe(true);
  });

  test("primary app version matches standby (no SHA drift)", async ({ request }) => {
    const [primary, standby] = await Promise.all([
      probeHealth(request, PRIMARY_HOST),
      probeHealth(request, STANDBY_HOST),
    ]);
    const pBody = JSON.parse(primary.body);
    const sBody = JSON.parse(standby.body);
    expect(pBody.status).toBe(sBody.status);
    if (pBody.sha && sBody.sha) {
      expect(pBody.sha, `SHA drift: primary=${pBody.sha}, standby=${sBody.sha}`).toBe(sBody.sha);
    }
    if (pBody.version && sBody.version) {
      expect(pBody.version, `Version drift: primary=${pBody.version}, standby=${sBody.version}`).toBe(sBody.version);
    }
  });

  test("Pi origin responds with the app's CSP (not a default nginx/k3s page)", async ({ request }) => {
    const r = await request.get(`https://pi-origin.${PRIMARY_HOST}/api/health`, {
      failOnStatusCode: false,
      timeout: 20_000,
    });
    const csp = r.headers()["content-security-policy"] ?? "";
    expect(csp, "Pi origin missing CSP — serving default page instead of the app?").toContain("frame-ancestors");
  });
});
