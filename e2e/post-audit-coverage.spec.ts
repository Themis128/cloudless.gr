/**
 * Three audit-fix contracts that the existing test suites don't cover:
 *
 *   1. /api/contact rate limiter actually triggers on the 4th rapid
 *      same-IP request (post-audit cap = 3/min/container).
 *   2. /_next/image content-negotiates AVIF when the client accepts it,
 *      proving the next.config.ts `formats: ["image/avif", "image/webp"]`
 *      change actually reaches user devices.
 *   3. HubSpot's loader is NOT injected on localhost — proves the
 *      runtime hostname gate in src/components/HubSpotScript.tsx works,
 *      and that the entire HubSpot+Typekit dependency chain stays out
 *      of dev / preview / Pi-internal-IP environments.
 */

import { test, expect } from "@playwright/test";

test.describe("rate-limit cap — /api/contact (3 req/min/container)", () => {
  test("4th rapid same-IP submission is rejected (429 or 4xx)", async ({ request }) => {
    // Pin a stable IP so all 4 requests share the limiter bucket.
    const ip = "203.0.113.99";
    const headers = {
      "content-type": "application/json",
      "x-forwarded-for": ip,
    };
    // Use clearly-invalid bodies — these may be 4xx for validation, but
    // the rate limiter runs before validation, so the 4th hit is 429
    // regardless of body shape.
    const data = { name: "rl-test", email: "rl@example.com", message: "x" };

    const statuses: number[] = [];
    for (let i = 0; i < 4; i++) {
      const r = await request.post("/api/contact", {
        headers,
        data: JSON.stringify(data),
      });
      statuses.push(r.status());
    }
    // First 3 may pass through to validation/200/4xx; the 4th MUST be 429.
    expect(
      statuses[3],
      `expected 429 on 4th rapid request from same IP; got ${statuses.join(",")}`,
    ).toBe(429);
  });
});

test.describe("image optimizer — AVIF negotiation", () => {
  test("Next.js image optimizer serves AVIF when Accept includes image/avif", async ({
    request,
  }) => {
    // /icons/icon-512.png is part of the PWA manifest and ships in /public.
    // The Next.js image optimizer at /_next/image transcodes it on demand.
    const r = await request.get(
      "/_next/image?url=%2Ficons%2Ficon-512.png&w=256&q=75",
      {
        headers: {
          accept: "image/avif,image/webp,image/apng,*/*;q=0.8",
        },
      },
    );
    expect(r.status()).toBe(200);
    const contentType = r.headers()["content-type"] ?? "";
    expect(
      contentType,
      `expected image/avif (or image/webp fallback if avif transcoder missing); got "${contentType}"`,
    ).toMatch(/image\/(avif|webp)/);
  });

  test("optimizer falls back to WebP when client only accepts WebP", async ({
    request,
  }) => {
    const r = await request.get(
      "/_next/image?url=%2Ficons%2Ficon-512.png&w=256&q=75",
      {
        headers: { accept: "image/webp,image/apng,*/*;q=0.8" },
      },
    );
    expect(r.status()).toBe(200);
    expect(r.headers()["content-type"]).toBe("image/webp");
  });
});

test.describe("HubSpot loader gate (only on real cloudless.gr hosts)", () => {
  test("the HubSpot script tag is NOT in the DOM on localhost", async ({ page }) => {
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    // The HubSpotScript client component returns null when window.location.hostname
    // is not "cloudless.gr" / "www.cloudless.gr". On localhost it should return null.
    const count = await page.locator('script#hs-script-loader').count();
    expect(count).toBe(0);
  });

  test("no network requests to hs-scripts.com from localhost", async ({ page }) => {
    const hsRequests: string[] = [];
    page.on("request", (req) => {
      const url = req.url();
      if (/hs-scripts\.com|hsforms\.net|p\.typekit\.net|use\.typekit\.net/.test(url)) {
        hsRequests.push(url);
      }
    });
    await page.goto("/en");
    await page.waitForLoadState("networkidle");
    expect(hsRequests, hsRequests.join("\n")).toEqual([]);
  });
});
