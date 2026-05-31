/**
 * monocart-reporter configuration.
 * Merges V8 coverage from Playwright page-context into a single Istanbul-style
 * HTML + lcov report at ./coverage/playwright/.
 *
 * Wired into playwright.config.mts via:
 *   reporter: [['monocart-reporter', { name: 'cloudless.gr E2E', ... }]]
 */
export default {
  name: "cloudless.gr E2E",
  outputFile: "./coverage/playwright/index.html",
  coverage: {
    name: "cloudless.gr Coverage",
    outputDir: "./coverage/playwright",
    reports: ["v8", "html", "lcov", "console-summary"],
    entryFilter: {
      // Only count files from your source tree, ignore framework/vendor
      "**/node_modules/**": false,
      "**/.next/**": false,
      "**/_next/static/chunks/main-app*": false,
      "**/_next/static/chunks/webpack*": false,
      "**/_next/static/chunks/framework*": false,
      "**/_next/static/chunks/polyfills*": false,
      "**/src/**": true,
    },
    sourceFilter: {
      "**/node_modules/**": false,
      "**/src/**": true,
    },
  },
};
