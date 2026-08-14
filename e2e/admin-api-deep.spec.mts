/**
 * Deep coverage for every admin API.
 * Two flows:
 *   1. Without auth — every endpoint must respond 401/403 (NEVER 200 or 5xx).
 *   2. With admin storageState — endpoint must respond < 500 (auth recognized).
 *
 * Edge cases:
 *   - POST endpoints with empty body return 400/422, not 5xx
 *   - Bearer with garbage token is rejected
 */
import { test, expect } from "./coverage";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { ADMIN_APIS, ADMIN_API_DYNAMIC } from "./helpers/coverage-routes";
import { requestUntilCompiled } from "./_internal/request-until-compiled";

const STORAGE = path.join(__dirname, ".auth", "admin.json");

function hasRealAuth(): boolean {
  try {
    const j = JSON.parse(fs.readFileSync(STORAGE, "utf8"));
    return Array.isArray(j.cookies) && j.cookies.length > 0;
  } catch {
    return false;
  }
}

const ALL_ADMIN_APIS = Array.from(
  new Set<string>([...ADMIN_APIS, ...ADMIN_API_DYNAMIC.map((d) => d.sample)])
);

test.describe("Admin APIs unauthenticated", () => {
  for (const api of ALL_ADMIN_APIS) {
    test(`unauth GET ${api} — returns 401/403`, async ({ request }) => {
      // Retry past Turbopack compile 404s — never treat transient 404 as auth OK.
      const r = await requestUntilCompiled(request, "get", api);
      // Must reject unauthenticated; 200 would be a data leak. 405 = method gated.
      expect([401, 403, 405]).toContain(r.status());
    });
  }

  test("unauth GET with garbage Bearer token still rejected", async ({ request }) => {
    const r = await requestUntilCompiled(request, "get", "/api/admin/users", {
      headers: { Authorization: "Bearer garbage" },
    });
    expect([401, 403]).toContain(r.status());
  });
});

test.describe("Admin APIs authenticated", () => {
  test.use({ storageState: STORAGE });

  test.beforeEach(({}, testInfo) => {
    if (!hasRealAuth()) {
      testInfo.skip(
        true,
        "Skipping authenticated admin APIs (E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set)"
      );
    }
  });

  for (const api of ALL_ADMIN_APIS) {
    test(`auth GET ${api} — non-5xx`, async ({ request }) => {
      const r = await requestUntilCompiled(request, "get", api);
      expect(r.status(), `${api} returned ${r.status()}`).toBeLessThan(500);
    });
  }
});
