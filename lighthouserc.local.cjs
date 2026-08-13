/**
 * Local Lighthouse CI config for cloudless.gr production audits.
 *
 * Usage:
 *   pnpm lighthouse:audit
 *   pnpm lighthouse:audit -- --url=https://cloudless.gr/en/services
 *
 * CI config stays at `.github/lighthouserc.cjs` (flags + headers only;
 * treosh action supplies URLs). This file is for operator / agent runs.
 */
module.exports = {
  ci: {
    collect: {
      numberOfRuns: 1,
      url: [
        "https://cloudless.gr/en",
        "https://cloudless.gr/en/services",
        "https://cloudless.gr/en/store",
        "https://cloudless.gr/en/contact",
      ],
      settings: {
        // Match production edge: Worker → Tunnel → Pi. Block CF challenge JS
        // noise that tanks Best Practices in lab runs.
        chromeFlags:
          "--headless=new --no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage",
        preset: "desktop",
        throttlingMethod: "devtools",
        onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
        skipAudits: ["uses-http2"],
        extraHeaders: JSON.stringify({
          "X-Forwarded-Proto": "https",
        }),
        blockedUrlPatterns: [
          "*cdn-cgi/challenge-platform*",
          "*cdn-cgi/challenge-platform/*",
          "*challenges.cloudflare.com*",
        ],
      },
    },
    assert: {
      assertions: {
        "categories:performance": ["warn", { minScore: 0.65 }],
        "categories:accessibility": ["warn", { minScore: 0.9 }],
        "categories:best-practices": ["warn", { minScore: 0.9 }],
        "categories:seo": ["warn", { minScore: 0.9 }],
      },
    },
    upload: {
      target: "filesystem",
      outputDir: ".lighthouseci",
    },
  },
};
