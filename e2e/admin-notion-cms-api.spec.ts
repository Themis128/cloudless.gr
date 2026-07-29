/**
 * Real-API coverage for the 4 admin Notion CMS endpoints that the existing
 * admin-api-deep.spec.ts misses (they're not in coverage-routes.ts/ADMIN_APIS):
 *
 *   /api/admin/notion/case-studies
 *   /api/admin/notion/faqs
 *   /api/admin/notion/services
 *   /api/admin/notion/testimonials
 *
 * All assertions hit the running dev/test server through Playwright's request
 * fixture — no vi.mock, no in-test stubs of production logic. Same pattern
 * already used by admin-api-deep.spec.ts.
 *
 * Two flows per endpoint:
 *   1. Unauthenticated      → must return 401/403 (data-leak guard)
 *   2. Admin storageState   → must return < 500 (auth recognized, validation
 *                             contracts honored)
 *
 * Extra contract checks the deep spec doesn't do:
 *   - POST with invalid JSON                  → 400 "Invalid JSON"
 *   - POST with empty body                    → 400 (required-field message)
 *   - PATCH with no pageId                    → 400 "pageId is required"
 *   - DELETE without pageId query param       → 400
 *   - Method-shape sanity: GET returns the expected count/array key
 */
import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const STORAGE = path.join(__dirname, ".auth", "admin.json");

function hasRealAuth(): boolean {
  try {
    const j = JSON.parse(fs.readFileSync(STORAGE, "utf8"));
    return Array.isArray(j.cookies) && j.cookies.length > 0;
  } catch {
    return false;
  }
}

interface Endpoint {
  url: string;
  /** key the GET response uses for the array (e.g. "caseStudies") */
  listKey: string;
  /** minimum body POST requires to pass validation */
  validPost: Record<string, unknown>;
  /** body that should trigger "required field" 400 */
  invalidPost: Record<string, unknown>;
}

const endpoints: Endpoint[] = [
  {
    url: "/api/admin/notion/case-studies",
    listKey: "caseStudies",
    validPost: { title: "e2e-test-case-study" },
    invalidPost: { title: "   " }, // route trims and rejects whitespace-only
  },
  {
    url: "/api/admin/notion/faqs",
    listKey: "faqs",
    validPost: { question: "e2e?", answer: "yes" },
    invalidPost: { answer: "missing question" },
  },
  {
    url: "/api/admin/notion/services",
    listKey: "services",
    validPost: { name: "e2e-test-service" },
    invalidPost: { description: "no name field" },
  },
  {
    url: "/api/admin/notion/testimonials",
    listKey: "testimonials",
    // both name and quote are required
    validPost: { name: "e2e Tester", quote: "Works as expected." },
    invalidPost: { name: "missing-quote" },
  },
];

test.describe("Admin Notion CMS APIs — unauthenticated", () => {
  for (const ep of endpoints) {
    test(`GET ${ep.url} rejects anon`, async ({ request }) => {
      const r = await request.get(ep.url, { failOnStatusCode: false });
      expect([401, 403]).toContain(r.status());
    });

    test(`POST ${ep.url} rejects anon`, async ({ request }) => {
      const r = await request.post(ep.url, {
        data: ep.validPost,
        failOnStatusCode: false,
      });
      expect([401, 403]).toContain(r.status());
    });

    test(`PATCH ${ep.url} rejects anon`, async ({ request }) => {
      const r = await request.patch(ep.url, {
        data: { pageId: "x" },
        failOnStatusCode: false,
      });
      expect([401, 403]).toContain(r.status());
    });

    test(`DELETE ${ep.url} rejects anon`, async ({ request }) => {
      const r = await request.delete(`${ep.url}?pageId=x`, {
        failOnStatusCode: false,
      });
      expect([401, 403]).toContain(r.status());
    });
  }

  test("Bearer with garbage token still rejected", async ({ request }) => {
    const r = await request.get("/api/admin/notion/case-studies", {
      headers: { Authorization: "Bearer garbage" },
      failOnStatusCode: false,
    });
    expect([401, 403]).toContain(r.status());
  });
});

test.describe("Admin Notion CMS APIs — authenticated", () => {
  test.use({ storageState: STORAGE });

  test.beforeEach(({}, testInfo) => {
    if (!hasRealAuth()) {
      testInfo.skip(
        true,
        "Skipping authenticated checks (E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set)"
      );
    }
  });

  for (const ep of endpoints) {
    test(`GET ${ep.url} responds non-5xx and matches shape`, async ({ request }) => {
      const r = await request.get(ep.url, { failOnStatusCode: false });
      expect(r.status(), `${ep.url} returned ${r.status()}`).toBeLessThan(500);

      // 200 with shape OR 503 if the corresponding Notion DB id isn't
      // configured in the env — both are valid contracts.
      if (r.status() === 200) {
        const body = await r.json();
        expect(body).toHaveProperty(ep.listKey);
        expect(Array.isArray(body[ep.listKey])).toBe(true);
        expect(typeof body.count).toBe("number");
        expect(body.count).toBe(body[ep.listKey].length);
      } else if (r.status() === 503) {
        const body = await r.json();
        expect(body.error).toMatch(/not configured/i);
      }
    });

    test(`POST ${ep.url} rejects invalid JSON with 400`, async ({ request }) => {
      const r = await request.post(ep.url, {
        headers: { "content-type": "application/json" },
        data: "{not-json",
        failOnStatusCode: false,
      });
      // 503 first (if DB unconfigured) is also acceptable — auth passed and
      // the route ran its config check before JSON parsing.
      if (r.status() !== 503) {
        expect(r.status()).toBe(400);
        const body = await r.json();
        expect(body.error).toMatch(/Invalid JSON/i);
      }
    });

    test(`POST ${ep.url} rejects body missing required field`, async ({ request }) => {
      const r = await request.post(ep.url, {
        data: ep.invalidPost,
        failOnStatusCode: false,
      });
      if (r.status() !== 503) {
        expect(r.status()).toBe(400);
        const body = await r.json();
        expect(body.error).toMatch(/required/i);
      }
    });

    test(`PATCH ${ep.url} rejects body without pageId`, async ({ request }) => {
      const r = await request.patch(ep.url, {
        data: { title: "no pageId here" },
        failOnStatusCode: false,
      });
      // PATCH does not gate on isConfiguredAsync in these routes (only GET
      // and POST do) so we expect a clean 400.
      expect(r.status()).toBe(400);
      const body = await r.json();
      expect(body.error).toMatch(/pageId is required/i);
    });

    test(`DELETE ${ep.url} rejects missing pageId query param`, async ({ request }) => {
      const r = await request.delete(ep.url, { failOnStatusCode: false });
      expect(r.status()).toBe(400);
      const body = await r.json();
      expect(body.error).toMatch(/pageId/i);
    });
  }
});
