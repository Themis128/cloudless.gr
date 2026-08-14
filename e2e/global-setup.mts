/**
 * Pre-flight health gate. Runs once before the whole Playwright suite.
 *
 * Why this exists: `webServer.reuseExistingServer` is `true` for local runs
 * (see playwright.config.mts), so Playwright will happily reuse whatever
 * process already holds port 4000 — including a stale dev server started on a
 * pre-routing-fix checkout. When the proxy/routing isn't wired, *every* route
 * 404s and next-auth's client gets the 404 HTML page ("Unexpected token '<'").
 * That turns one broken server into ~130 confusing, unrelated test failures.
 *
 * This gate hits the two route classes the suite depends on — an API route
 * handler (/api/health) and a locale-prefixed page (/en) — and fails the run
 * immediately with one clear message if either is wrong. Fail fast, fail loud.
 */
import type { FullConfig } from "@playwright/test";
import { E2E_ORIGIN } from "./_port";

const BASE_URL = E2E_ORIGIN;

async function probe(
  pathname: string,
  accept: string,
  expect: (res: Response, body: string) => string | null
): Promise<void> {
  const url = `${BASE_URL}${pathname}`;
  let res: Response;
  let body: string;
  try {
    res = await fetch(url, { headers: { accept } });
    body = await res.text();
  } catch (err) {
    throw new Error(
      `[e2e:preflight] Could not reach ${url}: ${(err as Error).message}\n` +
        `The dev server on port 4000 is not responding. Start it with \`pnpm dev\` or let Playwright launch it.`
    );
  }

  const problem = expect(res, body);
  if (problem) {
    throw new Error(
      `[e2e:preflight] ${url} is unhealthy — ${problem}\n` +
        `Got HTTP ${res.status}; body starts: ${body.slice(0, 80).replace(/\s+/g, " ")}\n\n` +
        `This usually means a STALE dev server is on port 4000 (reuseExistingServer is on for local\n` +
        `runs). Routing/proxy isn't wired, so every route 404s and next-auth returns the HTML 404 page.\n` +
        `Fix: kill the old server and let Playwright start a fresh one —\n` +
        `    lsof -ti:4000 | xargs -r kill && pnpm test:e2e`
    );
  }
}

export default async function globalSetup(_config: FullConfig): Promise<void> {
  // /api/health — proves API route handlers resolve (not the 404 HTML page).
  await probe("/api/health", "application/json", (res, body) => {
    if (res.status !== 200) return "expected HTTP 200 from the health route";
    try {
      const json = JSON.parse(body) as { status?: string };
      // "ok" = fully healthy (D1 connected). "degraded" = server is up but
      // D1 isn't reachable (e.g. local dev without wrangler bindings) — the
      // server is still functional for most tests, so accept both.
      if (json.status !== "ok" && json.status !== "degraded") {
        return `expected status "ok" or "degraded", got "${json.status}"`;
      }
    } catch {
      return "health route did not return JSON (served the 404 HTML page?)";
    }
    return null;
  });

  // /en — proves the proxy ran and next-intl resolved the locale-prefixed page.
  // Request HTML (not JSON) — this is a page route, so we send what a real
  // browser navigation sends; an `application/json` Accept would misrepresent
  // the request and could trip content negotiation.
  await probe("/en", "text/html", (res) => {
    if (res.status >= 400) return "expected the home page to render (proxy + next-intl not wired?)";
    return null;
  });

  console.log("[e2e:preflight] Server is healthy — /api/health and /en both resolve.");

  // Warm heavy admin API modules so Turbopack has compiled them before the
  // full suite hammers the server (avoids persistent 404 flakes on first hit).
  const warmPaths = [
    "/api/admin/appflowy/blog",
    "/api/admin/appflowy/docs",
    "/api/admin/appflowy/submissions",
    "/api/admin/appflowy/tasks",
    "/api/admin/appflowy/faqs",
    "/api/admin/appflowy/case-studies",
    "/api/admin/appflowy/services",
    "/api/admin/appflowy/testimonials",
    "/api/admin/users",
    "/api/admin/client-portals",
    "/api/admin/workspaces",
    "/api/admin/integrations/status",
    "/api/admin/ops/monitor",
    "/api/admin/analytics/datalake",
    "/api/admin/ai/analytics-orchestration",
    "/api/admin/ai/analytics-orchestration/pdf",
    "/api/admin/cost",
    "/api/admin/insights",
    "/api/admin/insights/revenue",
    "/en/auth/login",
    "/en/auth/signup",
    "/api/auth/session",
    "/api/auth/login",
    "/api/contact",
    "/api/subscribe",
    "/api/checkout",
    "/api/webhooks/stripe",
    "/api/webhooks/espocrm",
    "/api/user/purchases",
  ];
  for (const pathname of warmPaths) {
    for (let attempt = 0; attempt < 8; attempt++) {
      try {
        const isPost = pathname.includes("analytics-orchestration");
        const res = await fetch(`${BASE_URL}${pathname}`, {
          method: isPost ? "POST" : "GET",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: isPost ? "{}" : undefined,
        });
        if (res.status !== 404) break;
      } catch {
        // Server still settling — retry.
      }
      await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
    }
  }
  console.log("[e2e:preflight] Warmed admin API compile paths.");

  const e2eToken = process.env.E2E_ADMIN_TOKEN || "e2e-admin-token-do-not-use-in-prod";
  const adminProbe = await fetch(`${BASE_URL}/api/admin/users`, {
    headers: { Authorization: `Bearer ${e2eToken}`, Accept: "application/json" },
  });
  if (adminProbe.status === 401 || adminProbe.status === 403) {
    throw new Error(
      `[e2e:preflight] GET /api/admin/users returned ${adminProbe.status} with the e2e admin token.\n` +
        `The process on ${BASE_URL} was not started with E2E_ADMIN_TOKEN (a leftover \`pnpm dev\`).\n` +
        `Fix: stop that server (or use E2E_PORT=4010) and let Playwright start the suite server.`
    );
  }
}
