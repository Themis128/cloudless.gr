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
    // entryFilter runs against the loaded bundle URL (e.g.
    // .../_next/static/chunks/app/[locale]/page-HASH.js), never a literal
    // `/src/` path — so a `**/src/**` allowlist drops every entry before the
    // source maps resolve. Exclude vendor/framework bundles, keep the rest,
    // and let sourceFilter restrict to src/ after remapping to originals.
    entryFilter: (entry: { url?: string }) => {
      const u = entry.url ?? "";
      if (u.includes("/node_modules/")) return false;
      if (/\/_next\/static\/chunks\/(framework|main-app|main|webpack|polyfills|pages)/.test(u)) return false;
      return true;
    },
    sourceFilter: (sourcePath: string) =>
      /(^|\/)src\//.test(sourcePath) && !sourcePath.includes("/node_modules/"),
  },
};
