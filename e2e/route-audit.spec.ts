import { test, expect, type ConsoleMessage } from "@playwright/test";

// Slow filesystem on /mnt/d means first compile per route takes 10-90s.
// Run serially so Turbopack compiles one route at a time, and bump timeout.
test.describe.configure({ mode: "serial" });
test.setTimeout(180_000);

const ROUTES = [
  // Public pages — English
  "/en",
  "/en/store",
  "/en/services",
  "/en/blog",
  "/en/contact",
  "/en/privacy",
  "/en/terms",
  "/en/docs",
  "/en/refund",
  "/en/cookies",
  // Auth
  "/en/auth/login",
  "/en/auth/signup",
  "/en/auth/forgot-password",
  // All locales — homepage
  "/el",
  "/fr",
  "/de",
  // Other-locale public pages
  "/el/store",
  "/el/services",
  "/el/blog",
  "/fr/store",
  "/de/store",
  // Top-level (non-locale) routes
  "/portal/waiting",
  // Legacy unprefixed (should 307 to /en/*)
  "/",
  "/store",
  "/services",
  "/blog",
];

type Issue = {
  route: string;
  type: "console-error" | "page-error" | "request-failed" | "bad-status";
  detail: string;
};

const issues: Issue[] = [];

for (const route of ROUTES) {
  test(`audit ${route}`, async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];

    page.on("console", (msg: ConsoleMessage) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("requestfailed", (req) => {
      const url = req.url();
      if (url.includes("hs-scripts.com") || url.includes("typekit.net")) return;
      failedRequests.push(`${req.method()} ${url} - ${req.failure()?.errorText}`);
    });

    const response = await page.goto(route, { waitUntil: "domcontentloaded", timeout: 60_000 });
    const status = response?.status() ?? 0;

    if (status >= 400) {
      issues.push({ route, type: "bad-status", detail: `HTTP ${status}` });
    }
    consoleErrors.forEach((e) => issues.push({ route, type: "console-error", detail: e }));
    pageErrors.forEach((e) => issues.push({ route, type: "page-error", detail: e }));
    failedRequests.forEach((e) => issues.push({ route, type: "request-failed", detail: e }));

    expect(status, `${route} returned HTTP ${status}`).toBeLessThan(400);
  });
}

test.afterAll(() => {
  if (issues.length === 0) {
    console.log("\n=== ROUTE AUDIT: All clean ===\n");
    return;
  }
  console.log("\n=== ROUTE AUDIT ISSUES ===");
  const grouped: Record<string, Issue[]> = {};
  for (const i of issues) (grouped[i.route] ??= []).push(i);
  for (const [route, list] of Object.entries(grouped)) {
    console.log(`\n${route}`);
    for (const i of list) console.log(`  [${i.type}] ${i.detail}`);
  }
  console.log("\n===========================\n");
});
