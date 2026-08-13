import path from "path";
import { defineConfig, devices } from "@playwright/test";

const rootDir = import.meta.dirname ?? path.resolve();
const isCi = !!process.env.CI;
const isCoverage = process.env.COVERAGE === "1";

/** k3s specs target the live cluster via playwright.k3s.config.mts only. */
const ignoreK3s = "**/k3s/**";

export default defineConfig({
  testDir: path.join(rootDir, "e2e"),
  testMatch: "**/*.spec.{ts,mts}",
  // Project-level testIgnore replaces this — keep ignoreK3s on every project below.
  testIgnore: [ignoreK3s],
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 1,
  workers: 2,

  // Pre-flight health gate — fails fast if the dev server is stale/unhealthy
  // instead of producing ~130 confusing per-route failures.
  globalSetup: path.join(rootDir, "e2e/global-setup.mts"),
  // In coverage mode, merge server-side V8 coverage after the suite finishes.
  globalTeardown: isCoverage
    ? path.join(rootDir, "e2e/coverage/server-teardown.mts")
    : undefined,

  reporter: isCoverage
    ? [
        ["list"],
        [
          "monocart-reporter",
          {
            name: "cloudless.gr E2E",
            outputFile: "./coverage/playwright/index.html",
            coverage: {
              entryFilter: {
                "**/src/**": true,
                "**/_next/static/chunks/main-app*": false,
                "**/_next/static/chunks/webpack*": false,
                "**/_next/static/chunks/framework*": false,
                "**/_next/static/chunks/polyfills*": false,
              },
              sourceFilter: {
                "**/src/**": true,
                "**/node_modules/**": false,
              },
              reports: ["v8", "html", "lcov", "console-summary"],
              outputDir: "./coverage/playwright",
            },
          },
        ],
      ]
    : isCi
      ? "github"
      : [["html", { open: "never" }], ["list"]],

  timeout: 60_000,
  expect: { timeout: 20_000 },

  use: {
    baseURL: "http://localhost:4000/en",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    ignoreHTTPSErrors: true,
  },

  webServer: {
    command: "pnpm dev",
    // Hit a real route — bare `/` can 308 and confuse the readiness probe
    // while Next 16 is still compiling proxy.
    url: "http://127.0.0.1:4000/api/health",
    timeout: 180_000,
    // Local: reuse a healthy `pnpm dev`. CI always starts fresh.
    // Next 16 refuses a second `next dev` when .next/dev/lock exists — if we
    // spawn anyway and it exits 1, Playwright fails even though the URL is up.
    reuseExistingServer: !isCi,
    env: {
      NEXT_PUBLIC_E2E: "1",
      NEXT_PUBLIC_AUTH_PROVIDER: "d1",
      E2E_ADMIN_TOKEN: "e2e-admin-token-do-not-use-in-prod",
      E2E_USER_EMAIL: process.env.E2E_USER_EMAIL || "testuser@cloudless.gr",
      E2E_USER_PASSWORD: process.env.E2E_USER_PASSWORD || "TestPass123!",
      E2E_ADMIN_EMAIL: process.env.E2E_ADMIN_EMAIL || "testadmin@cloudless.gr",
      E2E_ADMIN_PASSWORD: process.env.E2E_ADMIN_PASSWORD || "AdminPass123!",
      PATH: `${process.env.PATH}:/home/tbaltzakis/.local/share/pnpm/bin`,
    },
  },

  projects: [
    {
      name: "setup",
      testMatch: "**/auth.setup.mts",
      testIgnore: [ignoreK3s],
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Reuse the storage state produced by the setup project so
        // authenticated tests (dashboard) have cookies ready.
        storageState: path.join(rootDir, "e2e/.auth/user.json"),
      },
      dependencies: ["setup"],
      // Project testIgnore replaces the top-level list — re-include k3s.
      testIgnore: [ignoreK3s, "**/ui/pages/admin.spec.ts"],
    },
    {
      name: "admin",
      use: {
        ...devices["Desktop Chrome"],
        // Use admin storage state for admin panel tests
        storageState: path.join(rootDir, "e2e/.auth/admin.json"),
      },
      dependencies: ["setup"],
      testMatch: "**/ui/pages/admin.spec.ts",
      testIgnore: [ignoreK3s],
    },
    {
      name: "mobile-chrome",
      use: {
        ...devices["Pixel 7"],
        storageState: path.join(rootDir, "e2e/.auth/user.json"),
      },
      dependencies: ["setup"],
      testIgnore: [ignoreK3s, "**/ui/pages/admin.spec.ts"],
    },
  ],
});