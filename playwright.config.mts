import path from "path";
import { defineConfig, devices } from "@playwright/test";

const rootDir = import.meta.dirname ?? path.resolve();
const isCi = !!process.env.CI;

const userStorage = path.join(rootDir, "e2e", ".auth", "user.json");
const adminStorage = path.join(rootDir, "e2e", ".auth", "admin.json");

/**
 * Playwright E2E configuration for cloudless.gr
 *
 * Projects:
 *   setup           — runs auth.setup.ts to produce signed-in storageState files
 *   chromium        — anonymous desktop tests (no storageState)
 *   mobile-chrome   — anonymous mobile tests
 *   chromium-user   — tests that need a logged-in non-admin user (uses user.json)
 *   chromium-admin  — tests that need an admin session (uses admin.json)
 *
 * The authenticated projects depend on `setup`; if E2E_USER_* / E2E_ADMIN_* env vars
 * aren't set, setup writes empty storageState files and auth-required tests skip.
 *
 * Run with:
 *   npx playwright test              # everything
 *   npx playwright test --project=chromium
 *   npx playwright test --ui
 */
export default defineConfig({
  globalSetup: "./e2e/global-setup.mts",
  globalTeardown: "./e2e/coverage/server-teardown.mts",
  testDir: path.join(rootDir, "e2e"),
  testIgnore: ["**/k3s/**"],
  fullyParallel: true,
  forbidOnly: isCi,
  retries: isCi ? 2 : 1,
  workers: isCi ? 1 : 6,
  reporter: process.env.COVERAGE === "1"
    ? [
        ["list"],
        ["monocart-reporter", {
          name: "cloudless.gr coverage",
          outputFile: "./coverage/playwright/index.html",
          coverage: {
            // entryFilter runs against the *loaded bundle* URL (e.g.
            // http://localhost:4000/_next/static/chunks/app/[locale]/page-HASH.js),
            // never a literal `/src/` path — so a `**/src/**` allowlist here drops
            // everything before source maps resolve. Exclude vendor/framework
            // bundles and let the rest through; sourceFilter restricts to src/
            // *after* the source maps remap bundles back to original files.
            entryFilter: (entry: { url?: string }) => {
              const u = entry.url ?? "";
              if (u.includes("/node_modules/")) return false;
              if (/\/_next\/static\/chunks\/(framework|main-app|main|webpack|polyfills|pages)/.test(u)) return false;
              return true;
            },
            sourceFilter: (sourcePath: string) =>
              /(^|\/)src\//.test(sourcePath) && !sourcePath.includes("/node_modules/"),
            reports: ["v8", "html", "lcov", "console-summary"],
            outputDir: "./coverage/playwright",
          },
        }],
      ]
    : isCi ? "github" : "html",
  timeout: 45_000,

  use: {
    baseURL: "http://localhost:4000",
    trace: process.env.COVERAGE === "1" ? "off" : "on-first-retry",
    screenshot: process.env.COVERAGE === "1" ? "off" : "only-on-failure",
    video: "off",
  },

  projects: [
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
    },
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
      testIgnore: [
        /auth\.setup\.ts/,
        /dashboard-deep\.spec\.ts/,
        /admin-pages-deep\.spec\.ts/,
        /admin-api-deep\.spec\.ts/,
        /remaining-coverage-deep\.spec\.ts/,
        /cron-deep\.spec\.ts/,
        /public-api-deep\.spec\.ts/,
        /k3s\//,
      ],
    },
    {
      name: "mobile-chrome",
      use: { ...devices["Pixel 7"] },
      testIgnore: [
        /auth\.setup\.ts/,
        /dashboard-deep\.spec\.ts/,
        /admin-pages-deep\.spec\.ts/,
        /admin-api-deep\.spec\.ts/,
        /remaining-coverage-deep\.spec\.ts/,
        /cron-deep\.spec\.ts/,
        /public-api-deep\.spec\.ts/,
        /k3s\//,
      ],
    },
    {
      name: "chromium-user",
      use: { ...devices["Desktop Chrome"], storageState: userStorage },
      testMatch: /dashboard-deep\.spec\.ts/,
      dependencies: ["setup"],
    },
    {
      name: "chromium-admin",
      use: { ...devices["Desktop Chrome"], storageState: adminStorage },
      testMatch: /(admin-pages-deep|admin-api-deep)\.spec\.ts/,
      dependencies: ["setup"],
    },
  ],

  webServer: {
    command: "pnpm dev",
    cwd: rootDir,
    url: "http://localhost:4000",
    // Don't reuse an existing dev server in coverage mode — we need our env to take effect
    reuseExistingServer: !isCi,
    timeout: 180_000,
    env: process.env.COVERAGE === "1"
      ? {
          NEXT_PUBLIC_E2E: "1",
          // V8 writes per-process coverage JSON into this dir; the
          // globalTeardown reads + merges them into the monocart report.
          NODE_V8_COVERAGE: path.join(rootDir, ".coverage-v8-server"),
        }
      : {
          NEXT_PUBLIC_E2E: "1",
        },
  },
});
