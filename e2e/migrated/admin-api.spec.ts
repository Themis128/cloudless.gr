import { test, expect, type APIRequestContext } from "@playwright/test";

/**
 * Migrated from __tests__/admin-*.test.ts (Vitest → Playwright).
 *
 * Admin API surface:
 *
 * - Admin routes wrap requireAdmin(request). Unauthenticated requests must
 *   get 401/403 — never widen that set to absorb 404 load flakes.
 * - Under full-suite load, Next/Turbopack can 404 a real route while the
 *   module compiles. We retry on 404 only, then assert 401/403
 *   (see CLAUDE.md e2e conventions).
 * - Tests use a cookie-less request context so the chromium project's
 *   user storageState does not contaminate "unauth" checks.
 */

const ORIGIN = "http://localhost:4000";

/** Retry until the route is compiled (non-404) or attempts are exhausted. */
async function waitStatus(
  fetchOnce: () => Promise<number>,
  attempts = 12
): Promise<number> {
  let last = 0;
  for (let attempt = 0; attempt < attempts; attempt++) {
    last = await fetchOnce();
    if (last !== 404) return last;
    await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
  }
  return last;
}

async function unauthGet(request: APIRequestContext, path: string): Promise<number> {
  return waitStatus(async () => {
    const r = await request.get(`${ORIGIN}${path}`);
    return r.status();
  });
}

async function unauthPost(request: APIRequestContext, path: string): Promise<number> {
  return waitStatus(async () => {
    const r = await request.post(`${ORIGIN}${path}`, { data: {} });
    return r.status();
  });
}

test.describe.configure({ mode: "serial" });

test.describe("Admin API — auth-gated mounted routes", () => {
  // Cookie-less context — do not inherit chromium user storageState.
  let api: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({
      baseURL: ORIGIN,
      extraHTTPHeaders: { Accept: "application/json" },
    });
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  const mounted = [
    "/api/admin/calendar",
    "/api/admin/kpi",
    "/api/admin/appflowy/blog",
    "/api/admin/appflowy/docs",
    "/api/admin/appflowy/submissions",
    "/api/admin/appflowy/tasks",
    "/api/admin/ab-tests",
    "/api/admin/client-portals",
    "/api/admin/users",
    "/api/admin/workspaces",
    "/api/admin/orders",
    "/api/admin/integrations/status",
    "/api/admin/notifications",
    "/api/admin/ops/monitor",
    "/api/admin/analytics/datalake",
    "/api/admin/cost",
    "/api/admin/insights",
  ];
  for (const route of mounted) {
    test(`GET ${route} rejects unauthenticated requests with 401/403`, async () => {
      const status = await unauthGet(api, route);
      expect([401, 403]).toContain(status);
    });
  }
});

test.describe("Admin API — unmounted parent paths", () => {
  let api: APIRequestContext;

  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext({
      baseURL: ORIGIN,
      extraHTTPHeaders: { Accept: "application/json" },
    });
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  const unmounted = [
    "/api/admin/analytics",
    "/api/admin/campaigns",
    "/api/admin/crm",
    "/api/admin/email",
    "/api/admin/pipeline",
    "/api/admin/projects",
  ];
  for (const route of unmounted) {
    test(`GET ${route} is the not-found HTML page (no API exposed)`, async () => {
      const r = await api.get(`${ORIGIN}${route}`);
      const ct = r.headers()["content-type"] ?? "";
      if (r.status() === 401 || r.status() === 403) return;
      expect(ct).toMatch(/text\/html/i);
    });
  }
});

test.describe("Admin API — cache control", () => {
  test("GET /api/admin/cache returns 401 or 405", async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: ORIGIN });
    try {
      const status = await unauthGet(api, "/api/admin/cache");
      expect([401, 403, 405]).toContain(status);
    } finally {
      await api.dispose();
    }
  });
});

test.describe("Admin API — POST endpoints require auth", () => {
  test("POST /api/admin/ai/analytics-orchestration without auth → 401", async ({ playwright }) => {
    const api = await playwright.request.newContext({ baseURL: ORIGIN });
    try {
      const status = await unauthPost(api, "/api/admin/ai/analytics-orchestration");
      expect([401, 403]).toContain(status);
    } finally {
      await api.dispose();
    }
  });

  test("POST /api/admin/ai/analytics-orchestration/pdf without auth → 401", async ({
    playwright,
  }) => {
    const api = await playwright.request.newContext({ baseURL: ORIGIN });
    try {
      const status = await unauthPost(api, "/api/admin/ai/analytics-orchestration/pdf");
      expect([401, 403]).toContain(status);
    } finally {
      await api.dispose();
    }
  });
});

test.describe("Admin API — datalake gold serving", () => {
  const token = process.env.E2E_ADMIN_TOKEN || "e2e-admin-token-do-not-use-in-prod";

  test("GET /api/admin/analytics/datalake with E2E admin returns gold payload shape", async ({
    playwright,
  }) => {
    const api = await playwright.request.newContext({
      baseURL: ORIGIN,
      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    try {
      let status = 0;
      let body: {
        cache?: string;
        source?: string;
        sections?: Array<{ section: string }>;
      } = {};
      for (let attempt = 0; attempt < 12; attempt++) {
        const r = await api.get(`${ORIGIN}/api/admin/analytics/datalake`);
        status = r.status();
        if (status !== 404) {
          body = (await r.json().catch(() => ({}))) as typeof body;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
      expect(status).toBe(200);
      expect(body.cache).toBe("cloudflare");
      expect(["gold", "hot_only", "empty"]).toContain(body.source);
      expect(Array.isArray(body.sections)).toBe(true);
      const names = (body.sections ?? []).map((s) => s.section);
      expect(names).toContain("freshness");
      expect(names).toContain("stripe_revenue");
      expect(names).toContain("top_keywords");
    } finally {
      await api.dispose();
    }
  });

  test("GET /api/admin/insights with E2E admin returns index shape", async ({ playwright }) => {
    const api = await playwright.request.newContext({
      baseURL: ORIGIN,
      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    try {
      let status = 0;
      let body: { source?: string; domains?: unknown; generated_at?: string } = {};
      for (let attempt = 0; attempt < 12; attempt++) {
        const r = await api.get(`${ORIGIN}/api/admin/insights`);
        status = r.status();
        if (status !== 404) {
          body = (await r.json().catch(() => ({}))) as typeof body;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
      expect(status).toBe(200);
      expect(body.source).toBe("datalake-gold");
      expect(Array.isArray(body.domains)).toBe(true);
    } finally {
      await api.dispose();
    }
  });

  test("GET /api/admin/insights/revenue returns insight shape", async ({ playwright }) => {
    const api = await playwright.request.newContext({
      baseURL: ORIGIN,
      extraHTTPHeaders: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });
    try {
      let status = 0;
      let body: {
        domain?: string;
        summary?: string;
        bullets?: unknown;
        error?: string;
      } = {};
      for (let attempt = 0; attempt < 12; attempt++) {
        const r = await api.get(`${ORIGIN}/api/admin/insights/revenue`);
        status = r.status();
        if (status !== 404) {
          body = (await r.json().catch(() => ({}))) as typeof body;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 400 * (attempt + 1)));
      }
      expect(status).toBe(200);
      expect(body.domain).toBe("revenue");
      expect(typeof body.summary === "string" || body.error).toBeTruthy();
      expect(Array.isArray(body.bullets)).toBe(true);
    } finally {
      await api.dispose();
    }
  });
});
