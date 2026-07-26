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

const BASE_URL = "http://localhost:4000";

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
      if (json.status !== "ok") return `expected {"status":"ok"}, got status="${json.status}"`;
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
}
