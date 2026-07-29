// Chrome flags for GitHub Actions ubuntu-latest runners.
// Playwright Chromium (and system Chrome) both require --no-sandbox inside
// the GitHub runner environment; without it the browser silently hangs on
// startup and LHCI times out waiting for the DevTools connection.
//
// Block Cloudflare challenge-platform scripts — they inject deprecations +
// Permissions-Policy violations that tank Best Practices (~79) even when
// Bot Fight Mode is off (managed JS detection / cdn-cgi/challenge-platform).
module.exports = {
  ci: {
    collect: {
      settings: {
        chromeFlags: "--no-sandbox --disable-setuid-sandbox --disable-dev-shm-usage",
        blockedUrlPatterns: [
          "*cdn-cgi/challenge-platform*",
          "*cdn-cgi/challenge-platform/*",
          "*challenges.cloudflare.com*",
        ],
      },
    },
  },
};
