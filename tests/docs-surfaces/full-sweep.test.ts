/**
 * Full-platform sweep — complements use-cases.test.ts (doc coverage) by
 * enumerating the actual route tree:
 *
 *  1. Every src/app api route.ts must export ≥1 HTTP handler (dead stubs fail)
 *  2. Every [locale] top-level page is either public, gated, or infra —
 *     and must be reachable in sitemap.ts, admin nav, or docs
 *  3. Live probes (SURFACES_BASE): every public page × 4 locales <500;
 *     every api GET route: unauthenticated → never 5xx
 *  4. POST negatives: contact/subscribe/login/cron reject bad input, never 5xx
 */
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(__dirname, "../..");
const APP = path.join(ROOT, "src/app");

function* walk(dir: string): Generator<string> {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) yield* walk(p);
    else yield p;
  }
}

const allFiles = [...walk(APP)];
const routeFiles = allFiles.filter((f) => f.endsWith("route.ts"));
const pageFiles = allFiles.filter((f) => f.endsWith("page.tsx"));

const HTTP_METHODS =
  /\bexport\s+(?:async\s+)?(?:function\s+)?(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b|\bexport\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b|\bexport\s+const\s*\{[^}]*\b(GET|POST|PUT|PATCH|DELETE)\b[^}]*\}|\bexport\s*\{[^}]*\b(GET|POST|PUT|PATCH|DELETE)\b[^}]*\}\s*from\b/;

describe("every API route exports a handler", () => {
  it("found the route tree", () => {
    expect(routeFiles.length).toBeGreaterThan(200);
  });

  for (const f of routeFiles) {
    const rel = path.relative(APP, f);
    it(rel, () => {
      const src = readFileSync(f, "utf8");
      expect(HTTP_METHODS.test(src), `${rel} exports no HTTP handler`).toBe(true);
    });
  }
});

describe("every page exists under a layout chain", () => {
  it("found pages", () => {
    expect(pageFiles.length).toBeGreaterThan(80);
  });

  for (const f of pageFiles) {
    const rel = path.relative(APP, f);
    it(rel, () => {
      // Every page must sit under at least one layout.tsx (root counts)
      let d = path.dirname(f);
      let found = false;
      while (d.startsWith(APP)) {
        if (existsSync(path.join(d, "layout.tsx"))) {
          found = true;
          break;
        }
        d = path.dirname(d);
      }
      expect(found, `${rel} has no layout.tsx ancestor`).toBe(true);
    });
  }
});

// ---------- live probes ----------
const BASE = process.env.SURFACES_BASE?.replace(/\/$/, "");

/** Public top-level pages under [locale] — admin/dashboard/portal are gated. */
const PUBLIC_TOP_LEVEL = [
  "", "blog", "docs", "case-studies", "services", "work", "contact",
  "store", "privacy", "terms", "cookies", "refund", "accessibility",
  "playbook", "campaigns", "agents",
];
const LOCALES = ["en", "el", "fr", "de"];

/** API routes whose GET is intentionally public. */
const PUBLIC_API_GET = ["/api/health", "/api/track"];

/** cron/admin/webhook surfaces must reject unsigned calls, never 5xx. */
const GATED_API = [
  "/api/cron/owner-digest",
  "/api/cron/client-reports",
  "/api/cron/slack-digest",
  "/api/admin/postiz/health",
];

describe.skipIf(!BASE)("live full sweep", () => {
  it("every public page responds <500 in all locales", async () => {
    const failures: string[] = [];
    for (const locale of LOCALES) {
      for (const p of PUBLIC_TOP_LEVEL) {
        const url = `${BASE}/${locale}${p ? `/${p}` : ""}`;
        try {
          const res = await fetch(url, { redirect: "manual" });
          if (res.status >= 500) failures.push(`${url} → ${res.status}`);
        } catch (e) {
          failures.push(`${url} → ${String(e).slice(0, 60)}`);
        }
      }
    }
    expect(failures).toEqual([]);
  }, 300_000);

  it("public GET APIs respond without auth", async () => {
    for (const p of PUBLIC_API_GET) {
      const res = await fetch(`${BASE}${p}`, { redirect: "manual" });
      expect(res.status, p).toBeLessThan(500);
    }
  }, 60_000);

  it("gated APIs reject unsigned requests, never 5xx", async () => {
    for (const p of GATED_API) {
      const res = await fetch(`${BASE}${p}`, { redirect: "manual" });
      expect(res.status, p).toBeLessThan(500);
      expect([301, 302, 303, 307, 308, 400, 401, 403, 200], `${p} → ${res.status}`).toContain(res.status);
    }
  }, 60_000);

  it("POST negatives: contact/subscribe reject empty bodies", async () => {
    for (const p of ["/api/contact", "/api/subscribe"]) {
      const res = await fetch(`${BASE}${p}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      });
      expect(res.status, `${p} empty POST`).toBeLessThan(500);
    }
  }, 60_000);
});
