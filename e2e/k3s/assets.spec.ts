/**
 * Static asset coverage — verifies the Next.js app's `_next/static/*`
 * chunks load cleanly through Lambda + Funnel. Image chunks are usually
 * the canary for Lambda response-size limits (6 MB hard cap for binary).
 */
import { test, expect } from "@playwright/test";

test.describe("k3s static assets", () => {
  test("homepage chunks all return 200", async ({ page }) => {
    const failures: { url: string; status: number; type: string }[] = [];
    page.on("response", (r) => {
      if (r.status() >= 400 && r.url().includes("/_next/static/")) {
        failures.push({ url: r.url(), status: r.status(), type: r.request().resourceType() });
      }
    });
    await page.goto("/en", { waitUntil: "networkidle" });
    expect(failures, JSON.stringify(failures, null, 2)).toEqual([]);
  });

  test("favicon is reachable", async ({ request }) => {
    const r = await request.get("https://cloudless.online/favicon.ico", {
      failOnStatusCode: false,
    });
    expect([200, 301, 302, 304].includes(r.status())).toBe(true);
  });

  test("no console errors on homepage load", async ({ page }) => {
    const errs: string[] = [];
    page.on("pageerror", (e) => errs.push(`pageerror: ${e.message}`));
    page.on("console", (m) => {
      if (m.type() === "error") errs.push(`console.error: ${m.text()}`);
    });
    await page.goto("/en", { waitUntil: "networkidle" });
    // Filter out 3rd-party noise that's expected (e.g. Sentry/HubSpot blocked
    // by extensions in some environments).
    const significant = errs.filter(
      (e) => !/(sentry|hubspot|stripe|facebook|hsforms|hs-scripts)/i.test(e),
    );
    expect(significant, JSON.stringify(significant, null, 2)).toEqual([]);
  });
});
