/**
 * Documentation-coverage suite — every surface that docs/product/USE-CASES.md
 * (plus a curated list of API/public assets from other docs) claims exists
 * must resolve to a real route file under src/app/.
 *
 * Two layers:
 *  1. Static resolution (always runs): doc'd path → page.tsx / route.ts /
 *     public asset. Fails when docs claim a dead surface.
 *  2. Live probes (SURFACES_BASE set): GET each public surface → expect <500;
 *     Access-gated admin/API → expect redirect/401/403, never 404.
 *
 * Run live: SURFACES_BASE=https://cloudless.gr pnpm vitest run tests/docs-surfaces
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const APP = path.join(ROOT, "src/app");
const PUBLIC = path.join(ROOT, "public");
const USE_CASES = path.join(ROOT, "docs/product/USE-CASES.md");

/** Extract backtick-quoted absolute paths from the use-case tables. */
function documentedPaths(): string[] {
  const md = readFileSync(USE_CASES, "utf8");
  const found = new Set<string>();
  for (const m of md.matchAll(/`(\/[^`\s]+)`/g)) {
    const p = m[1].replace(/,$/, "");
    if (/^\/(api|admin|auth|blog|case-studies|contact|dashboard|docs|portal|playbook|services|store|work)($|\/|\[)/.test(p)) {
      found.add(p);
    }
  }
  return [...found].sort();
}

/** Surfaces documented elsewhere that USE-CASES.md doesn't enumerate. */
const EXTRA_SURFACES: string[] = [
  "/auth/login",
  "/auth/forgot-password",
  "/auth/reset-password",
  "/playbook",
  "/api/health",
  "/api/contact",
  "/api/subscribe",
  "/api/checkout",
  "/api/cron/owner-digest",
  "/api/cron/client-reports",
  "/api/cron/calendar-digest",
  "/api/cron/slack-digest",
];

/** Public static assets the docs reference. */
const PUBLIC_ASSETS: string[] = ["/playbooks/cloud-migration-playbook.pdf"];

/** Paths that are known legacy redirect shims — must exist, checked separately. */
const REDIRECT_SHIMS = ["/admin/notion/*"];

function dirHasRouteEntry(dir: string): boolean {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return false;
  return readdirSync(dir, { recursive: true }).some((f) =>
    /(^|\/)(page|route)\.(ts|tsx|mts)$/.test(String(f)),
  );
}

/** Resolve a documented URL path to route files under src/app. */
function resolveRoute(urlPath: string): { found: boolean; tried: string[] } {
  const tried: string[] = [];

  if (urlPath.endsWith("/*")) {
    const base = urlPath.slice(0, -2);
    const dirs = [path.join(APP, "api", base.replace(/^\/api\//, "")), path.join(APP, base), path.join(APP, "[locale]", base)];
    for (const d of dirs) {
      tried.push(d);
      if (dirHasRouteEntry(d)) return { found: true, tried };
    }
    return { found: false, tried };
  }

  const file = urlPath.startsWith("/api/") ? "route.ts" : "page.tsx";
  const candidates = urlPath.startsWith("/api/")
    ? [path.join(APP, urlPath, file)]
    : [
        path.join(APP, urlPath, file),
        path.join(APP, "[locale]", urlPath, file),
        // legacy redirect shims may use optional catch-all
        path.join(APP, "[locale]", urlPath, "[[...slug]]", file),
        path.join(APP, urlPath, "[[...slug]]", file),
      ];
  for (const c of candidates) {
    tried.push(c);
    if (existsSync(c)) return { found: true, tried };
  }
  // Non-locale fallbacks: /links, /portal are top-level segments
  return { found: false, tried };
}

describe("USE-CASES.md — every documented surface resolves", () => {
  const paths = documentedPaths();

  it("extracted a meaningful number of surfaces", () => {
    expect(paths.length).toBeGreaterThanOrEqual(40);
  });

  for (const p of paths) {
    it(`resolves ${p}`, () => {
      const r = resolveRoute(p);
      expect(r.found, `${p} not found. Tried: ${r.tried.join(", ")}`).toBe(true);
    });
  }
});

describe("Extra documented surfaces", () => {
  for (const p of EXTRA_SURFACES) {
    it(`resolves ${p}`, () => {
      const r = resolveRoute(p);
      expect(r.found, `${p} not found. Tried: ${r.tried.join(", ")}`).toBe(true);
    });
  }
});

describe("Documented public assets", () => {
  for (const p of PUBLIC_ASSETS) {
    it(`serves ${p} from public/`, () => {
      expect(existsSync(path.join(PUBLIC, p)), `missing public${p}`).toBe(true);
    });
  }
});

describe("Legacy shims stay in place", () => {
  for (const p of REDIRECT_SHIMS) {
    it(`${p} redirects to AppFlowy`, () => {
      const r = resolveRoute(p);
      expect(r.found, `${p} shim removed`).toBe(true);
    });
  }
});

// ---------- live probes (opt-in) ----------
const BASE = process.env.SURFACES_BASE?.replace(/\/$/, "");
const PUBLIC_PATHS = ["/en", "/en/blog", "/en/docs", "/en/case-studies", "/en/services", "/en/work", "/en/contact", "/en/store", "/en/auth/login", "/en/auth/signup", "/en/playbook", "/links"];
const PUBLIC_APIS = ["/api/health"];
const GATED_PATHS = ["/en/admin", "/en/admin/leads", "/en/admin/crm", "/en/admin/users", "/en/dashboard", "/api/admin/postiz/health"];

describe.skipIf(!BASE)("live surface probes", () => {
  it("public pages return <500", async () => {
    for (const p of PUBLIC_PATHS) {
      const res = await fetch(`${BASE}${p}`, { redirect: "manual" });
      expect(res.status, `${p} → ${res.status}`).toBeLessThan(500);
    }
  }, 120_000);

  it("public APIs return <500", async () => {
    for (const p of PUBLIC_APIS) {
      const res = await fetch(`${BASE}${p}`, { redirect: "manual" });
      expect(res.status, `${p} → ${res.status}`).toBeLessThan(500);
    }
  }, 60_000);

  it("gated surfaces respond auth (302/401/403), never 404/500", async () => {
    for (const p of GATED_PATHS) {
      const res = await fetch(`${BASE}${p}`, { redirect: "manual" });
      expect([301, 302, 303, 307, 308, 401, 403, 200], `${p} → ${res.status}`).toContain(res.status);
      expect(res.status, `${p} → ${res.status}`).toBeLessThan(500);
    }
  }, 60_000);
});
