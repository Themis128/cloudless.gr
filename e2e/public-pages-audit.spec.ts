/**
 * Comprehensive public-page audit — all locales, all static routes, dynamic samples.
 *
 * Reports two failure categories:
 *   broken  — HTTP ≥ 400 (page not found or server error)
 *   missing — page renders (HTTP < 400) but has no <h1> AND no <main>
 *
 * Run:
 *   npx playwright test e2e/public-pages-audit.spec.ts
 */
import { test, expect, type ConsoleMessage } from "@playwright/test";

// Serial: slow /mnt/d filesystem; one Turbopack compile at a time
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const LOCALES = ["en", "el", "fr", "de"] as const;

// Locale-stripped paths for every static public page
const STATIC_PATHS = [
  "",               // homepage (/en, /el, …)
  "/store",
  "/services",
  "/blog",
  "/contact",
  "/privacy",
  "/terms",
  "/docs",
  "/refund",
  "/cookies",
  "/work",
  "/case-studies",
] as const;

// Dynamic routes: sample URLs — 200, 3xx, or 404 all acceptable; 5xx is not
const DYNAMIC_SAMPLES: { label: string; url: string }[] = [
  { label: "/en/blog/:slug",           url: "/en/blog/hello-world" },
  { label: "/en/case-studies/:slug",   url: "/en/case-studies/sample" },
  { label: "/en/docs/:slug",           url: "/en/docs/getting-started" },
  { label: "/en/store/:id",            url: "/en/store/sample-product" },
  { label: "/en/store/success",        url: "/en/store/success" },
  { label: "/portal/:token",           url: "/portal/dummy-token" },
];

// Auth pages — only checked in the /en locale
const AUTH_PAGES = [
  "/en/auth/login",
  "/en/auth/signup",
  "/en/auth/forgot-password",
] as const;

// Third-party hosts whose failures are not actionable
const IGNORED_HOSTS = new Set([
  "js.hs-scripts.com",
  "p.typekit.net",
  "use.typekit.net",
]);

function isIgnoredRequest(url: string): boolean {
  try {
    const host = new URL(url).hostname;
    return IGNORED_HOSTS.has(host) || host.endsWith(".hs-scripts.com");
  } catch {
    return false;
  }
}

// Console-error patterns that are noisy but not actionable
const IGNORED_CONSOLE = /favicon|404 for|hydrat|next-route-announcer|Content Security Policy|connect-src.*invalid source|Notion.*Failed to fetch|object_not_found/i;

type IssueType = "broken" | "missing" | "console-error" | "page-error" | "request-failed";
type Issue = { route: string; type: IssueType; detail: string };

const issues: Issue[] = [];

// ── Static pages — every locale ───────────────────────────────────────────────

for (const locale of LOCALES) {
  for (const path of STATIC_PATHS) {
    const route = `/${locale}${path}`;

    test(`static ${route}`, async ({ page }) => {
      const consoleErrors: string[] = [];
      const pageErrors: string[] = [];
      const failedReqs: string[] = [];

      page.on("console", (msg: ConsoleMessage) => {
        if (msg.type() === "error" && !IGNORED_CONSOLE.test(msg.text())) {
          consoleErrors.push(msg.text());
        }
      });
      page.on("pageerror", (err) => pageErrors.push(err.message));
      page.on("requestfailed", (req) => {
        if (!isIgnoredRequest(req.url())) {
          failedReqs.push(`${req.method()} ${req.url()} — ${req.failure()?.errorText}`);
        }
      });

      const response = await page.goto(route, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      const status = response?.status() ?? 0;

      if (status >= 400) {
        issues.push({ route, type: "broken", detail: `HTTP ${status}` });
      }
      consoleErrors.forEach((e) => issues.push({ route, type: "console-error", detail: e }));
      pageErrors.forEach((e) => issues.push({ route, type: "page-error", detail: e }));
      failedReqs.forEach((e) => issues.push({ route, type: "request-failed", detail: e }));

      expect(status, `${route} → HTTP ${status}`).toBeLessThan(400);

      // Check for actual content (h1 or main). Actively wait for either to
      // become visible — a fixed isVisible() timeout resolves false the instant
      // the element isn't mounted yet, racing Turbopack's first-compile streaming
      // of a cold route in dev mode. Dev first compiles + Suspense streaming can
      // keep the route-level loading.tsx fallback on screen past 15s under
      // parallel workers, so use a generous 30s deadline.
      const hasContent = await page
        .locator("h1, main")
        .first()
        .waitFor({ state: "visible", timeout: 30_000 })
        .then(() => true)
        .catch(() => false);

      if (!hasContent) {
        issues.push({ route, type: "missing", detail: "no <h1> or <main> element" });
      }
      expect(hasContent, `${route}: no <h1> or <main> element`).toBeTruthy();
    });
  }
}

// ── Dynamic pages ─────────────────────────────────────────────────────────────

for (const { label, url } of DYNAMIC_SAMPLES) {
  test(`dynamic ${label}`, async ({ page }) => {
    const resp = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const status = resp?.status() ?? 0;

    // 404 is acceptable (slug not in CMS yet); 5xx and other 4xx are not
    const acceptable = status < 400 || status === 404;
    if (!acceptable) {
      issues.push({ route: url, type: "broken", detail: `HTTP ${status}` });
    }
    expect(acceptable, `${label} (${url}): unexpected HTTP ${status}`).toBeTruthy();

    // Body must render even on 404 (our custom 404 page)
    await expect(page.locator("body")).toBeVisible();
  });
}

// ── Auth pages ────────────────────────────────────────────────────────────────

for (const route of AUTH_PAGES) {
  test(`auth ${route}`, async ({ page }) => {
    const resp = await page.goto(route, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    const status = resp?.status() ?? 0;
    if (status >= 400) {
      issues.push({ route, type: "broken", detail: `HTTP ${status}` });
    }
    expect(status, `${route} → HTTP ${status}`).toBeLessThan(400);
  });
}

// ── Root redirect ─────────────────────────────────────────────────────────────

test("root / redirects to a locale prefix", async ({ page }) => {
  const resp = await page.goto("/", { waitUntil: "commit" });
  // next-intl / proxy may finish the locale redirect after the first commit.
  await page.waitForURL(/\/(en|el|fr|de)(\/|$|\?)/, { timeout: 15_000 });
  expect(page.url()).toMatch(/\/(en|el|fr|de)/);
  expect(resp?.status() ?? 0).toBeLessThan(500);
});

// ── Summary ───────────────────────────────────────────────────────────────────

test.afterAll(() => {
  if (issues.length === 0) {
    console.log("\n=== PUBLIC PAGE AUDIT: All clean ✓ ===\n");
    return;
  }

  const broken  = issues.filter((i) => i.type === "broken");
  const missing = issues.filter((i) => i.type === "missing");
  const other   = issues.filter(
    (i) => i.type !== "broken" && i.type !== "missing",
  );

  console.log(`\n=== PUBLIC PAGE AUDIT — ${issues.length} issue(s) ===`);

  if (broken.length > 0) {
    console.log(`\nBROKEN PAGES (${broken.length}):`);
    broken.forEach((i) => console.log(`  ${i.route}  →  ${i.detail}`));
  }

  if (missing.length > 0) {
    console.log(`\nMISSING CONTENT (${missing.length}) — rendered but no <h1>/<main>:`);
    missing.forEach((i) => console.log(`  ${i.route}  →  ${i.detail}`));
  }

  if (other.length > 0) {
    console.log(`\nOTHER ISSUES (${other.length}):`);
    other.forEach((i) =>
      console.log(`  ${i.route}  [${i.type}]  ${i.detail}`),
    );
  }

  console.log("\n================================================\n");
});
